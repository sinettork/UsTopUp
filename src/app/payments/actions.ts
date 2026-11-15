"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BakongKHQR, IndividualInfo, khqrData } from "bakong-khqr";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isFrontendPreview } from "@/lib/preview-mode";

const paymentIdSchema = z.string().uuid();

function getBakongConfig() {
  const base = process.env.BAKONG_API_BASE_URL || "https://api-bakong.nbc.gov.kh";
  let parsedBase: URL;
  try { parsedBase = new URL(base); } catch { throw new Error("Bakong API URL is invalid."); }
  if (parsedBase.protocol !== "https:" || !["api-bakong.nbc.gov.kh", "sit-api-bakong.nbc.gov.kh"].includes(parsedBase.hostname)) {
    throw new Error("Bakong API URL must use the official Bakong Open API endpoint.");
  }
  const accessToken = process.env.BAKONG_ACCESS_TOKEN;
  const accountId = process.env.BAKONG_ACCOUNT_ID;
  const merchantName = process.env.BAKONG_MERCHANT_NAME;
  const merchantCity = process.env.BAKONG_MERCHANT_CITY;
  if (!accessToken || !accountId || !merchantName || !merchantCity) {
    throw new Error("Bakong payment is not configured. Add the server-only Bakong merchant settings.");
  }
  return { base: parsedBase.origin, accessToken, accountId, merchantName, merchantCity };
}

function goOrder(orderNumber: string, message?: string): never {
  const suffix = message ? `?payment_notice=${encodeURIComponent(message)}` : "";
  redirect(`/orders/${orderNumber}${suffix}`);
}

export async function startBakongPayment(formData: FormData) {
  if (isFrontendPreview()) redirect("/");
  const orderNumber = z.string().regex(/^UT-[0-9]{8}-[A-F0-9]{8}$/).safeParse(formData.get("order_number"));
  if (!orderNumber.success) redirect("/");
  if (process.env.NEXT_PUBLIC_CATALOG_PREVIEW === "true") goOrder(orderNumber.data, "Sample catalog mode is on. Payments are disabled until real prices are configured.");

  let config: ReturnType<typeof getBakongConfig>;
  try { config = getBakongConfig(); }
  catch (error) { goOrder(orderNumber.data, error instanceof Error ? error.message : "Bakong payment is unavailable."); }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/orders/${orderNumber.data}`)}`);

  const { data: paymentAllowed, error: limitError } = await supabase.rpc("check_user_rate_limit", {
    _action_key: "payment_create",
    _limit: 10,
    _window_seconds: 3600,
  });
  if (limitError || !paymentAllowed) goOrder(orderNumber.data, "Payment request limit reached. Please try again later.");

  let service: ReturnType<typeof createServiceClient>;
  try { service = createServiceClient(); }
  catch (error) { goOrder(orderNumber.data, error instanceof Error ? error.message : "Trusted payment storage is unavailable."); }

  const { data: attempt, error: beginError } = await supabase.rpc("begin_payment", {
    _order_number: orderNumber.data,
    _provider: "bakong",
  });
  if (beginError || !attempt?.[0]) goOrder(orderNumber.data, beginError?.message ?? "Could not start a payment attempt.");
  const payment = attempt[0];

  const { data: existingQr } = await supabase.from("payments")
    .select("qr_payload, qr_md5, status")
    .eq("id", payment.id)
    .maybeSingle();
  if (existingQr?.status === "pending" && existingQr.qr_payload && existingQr.qr_md5) {
    redirect(`/payments/${payment.id}`);
  }

  const currency = payment.currency.trim().toUpperCase();
  if (currency !== "USD" && currency !== "KHR") {
    goOrder(orderNumber.data, "Bakong supports USD or KHR. This order uses an unsupported currency.");
  }
  const fractionDigits = currency === "KHR" ? 0 : 2;
  const amount = payment.amount_minor / 10 ** fractionDigits;
  const qrCurrency = currency === "KHR" ? khqrData.currency.khr : khqrData.currency.usd;

  try {
    const generator = new BakongKHQR();
    const info = new IndividualInfo(config.accountId, config.merchantName, config.merchantCity, {
      currency: qrCurrency,
      amount,
      billNumber: payment.provider_reference,
      purposeOfTransaction: "Digital product order",
    });
    const generated = generator.generateIndividual(info);
    if (generated.status || !generated.data?.qr || !generated.data.md5) {
      await service.from("payment_events").insert({
        payment_id: payment.id,
        event_type: "bakong_qr_generation_failed",
        details: { message: generated.status?.message ?? "QR generation failed" },
      });
      throw new Error(generated.status?.message ?? "Could not create a Bakong QR code.");
    }

    const { error: updateError } = await service.from("payments").update({
      qr_payload: generated.data.qr,
      qr_md5: generated.data.md5.toLowerCase(),
    }).eq("id", payment.id).eq("status", "pending");
    if (updateError) throw new Error("Could not save the Bakong payment request. Please retry.");
    await service.from("payment_events").insert({
      payment_id: payment.id,
      event_type: "bakong_qr_generated",
      provider_event_id: generated.data.md5.toLowerCase(),
      details: { currency, amount },
    });
  } catch (error) {
    goOrder(orderNumber.data, error instanceof Error ? error.message : "Could not create a Bakong QR code.");
  }

  revalidatePath(`/orders/${orderNumber.data}`);
  redirect(`/payments/${payment.id}`);
}

export async function startPayWayPayment(formData: FormData) {
  if (isFrontendPreview()) redirect("/");
  const orderNumber = z.string().regex(/^UT-[0-9]{8}-[A-F0-9]{8}$/).safeParse(formData.get("order_number"));
  if (!orderNumber.success) redirect("/");
  if (process.env.NEXT_PUBLIC_CATALOG_PREVIEW === "true") goOrder(orderNumber.data, "Sample catalog mode is on. Payments are disabled until real prices are configured.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/orders/${orderNumber.data}`)}`);

  const { data: paymentAllowed, error: limitError } = await supabase.rpc("check_user_rate_limit", {
    _action_key: "payment_create", _limit: 10, _window_seconds: 3600,
  });
  if (limitError || !paymentAllowed) goOrder(orderNumber.data, "Payment request limit reached. Please try again later.");

  try {
    const service = createServiceClient();
    const { data: attempt, error } = await supabase.rpc("begin_payment", {
      _order_number: orderNumber.data,
      _provider: "aba_payway",
    });
    if (error || !attempt?.[0]) goOrder(orderNumber.data, error?.message ?? "Could not start PayWay checkout.");
    const payment = attempt[0];
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(payment.provider_reference)) {
      goOrder(orderNumber.data, "PayWay transaction reference is invalid.");
    }
    const { data: existing } = await supabase.from("payments")
      .select("id, provider_transaction_id, status")
      .eq("id", payment.id).maybeSingle();
    if (existing?.status === "pending" && existing.provider_transaction_id) {
      redirect(`/payments/${payment.id}/payway`);
    }
    const { error: updateError } = await service.from("payments")
      .update({ provider_transaction_id: payment.provider_reference })
      .eq("id", payment.id).eq("status", "pending");
    if (updateError) goOrder(orderNumber.data, "Could not prepare PayWay checkout.");
    redirect(`/payments/${payment.id}/payway`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    goOrder(orderNumber.data, "PayWay checkout is not configured. Please contact support.");
  }
}

const bakongResponseSchema = z.object({
  responseCode: z.number(),
  responseMessage: z.string().optional(),
  data: z.object({
    hash: z.string().min(1),
    toAccountId: z.string().min(1),
    currency: z.string().length(3),
    amount: z.union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)]),
  }).nullable(),
});

export async function checkBakongPayment(formData: FormData) {
  if (isFrontendPreview()) redirect("/");
  const paymentId = paymentIdSchema.safeParse(formData.get("payment_id"));
  if (!paymentId.success) redirect("/");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: payment } = await supabase.from("payments")
    .select("id, order_id, provider, provider_reference, provider_transaction_id, status, amount_minor, currency, qr_md5")
    .eq("id", paymentId.data)
    .maybeSingle();
  if (!payment || payment.provider !== "bakong") redirect("/");
  const { data: order } = await supabase.from("orders")
    .select("order_number")
    .eq("id", payment.order_id)
    .maybeSingle();
  if (!order) redirect("/");

  if (payment.status === "paid") goOrder(order.order_number, "Payment received and verified.");
  if (payment.status !== "pending" || !payment.qr_md5) goOrder(order.order_number, "This payment attempt is no longer pending.");

  const { data: checkAllowed, error: limitError } = await supabase.rpc("check_user_rate_limit", {
    _action_key: "payment_check",
    _limit: 20,
    _window_seconds: 3600,
  });
  if (limitError || !checkAllowed) goOrder(order.order_number, "Payment check limit reached. Please try again later.");

  let config: ReturnType<typeof getBakongConfig>;
  try { config = getBakongConfig(); }
  catch (error) { goOrder(order.order_number, error instanceof Error ? error.message : "Bakong verification is unavailable."); }

  let response: Response;
  try {
    response = await fetch(`${config.base}/v1/check_transaction_by_md5`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ md5: payment.qr_md5 }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    goOrder(order.order_number, "Bakong could not be reached. You can check the payment again shortly.");
  }

  if (!response.ok) goOrder(order.order_number, "Bakong could not verify the payment. Please try again shortly.");
  let verified: z.infer<typeof bakongResponseSchema>;
  try { verified = bakongResponseSchema.parse(await response.json()); }
  catch { goOrder(order.order_number, "Bakong returned an invalid verification response."); }
  if (verified.responseCode !== 0 || !verified.data) {
    goOrder(order.order_number, "Payment has not been received yet. Scan the QR and try again.");
  }
  const paidAmount = Number(verified.data.amount);
  const currency = verified.data.currency.toUpperCase();
  const fractionDigits = currency === "KHR" ? 0 : currency === "USD" ? 2 : -1;
  if (fractionDigits < 0 || !Number.isFinite(paidAmount)) {
    goOrder(order.order_number, "Bakong returned an unsupported payment amount.");
  }

  try {
    const service = createServiceClient();
    const { error } = await service.rpc("verify_bakong_payment", {
      _payment_id: payment.id,
      _transaction_hash: verified.data.hash,
      _verified_amount_minor: Math.round(paidAmount * 10 ** fractionDigits),
      _verified_currency: currency,
      _verified_to_account: verified.data.toAccountId,
      _expected_to_account: config.accountId,
      _provider_details: {
        currency,
        amount: paidAmount,
        toAccountId: verified.data.toAccountId,
        providerReference: payment.provider_reference,
      },
    });
    if (error) throw new Error("Bakong payment did not match this order. Contact support before paying again.");
  } catch {
    goOrder(order.order_number, "Payment verification could not be recorded. Contact support before paying again.");
  }

  revalidatePath(`/orders/${order.order_number}`);
  revalidatePath(`/payments/${payment.id}`);
  redirect(`/orders/${order.order_number}?payment=paid`);
}
