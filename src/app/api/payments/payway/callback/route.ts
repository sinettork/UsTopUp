import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getPayWayConfig, signPayWay, utcPayWayTime, verifyPayWayCallback } from "@/lib/payments/payway";

const callbackSchema = z.object({ tran_id: z.string().min(1).max(20), status: z.union([z.string(), z.number()]) }).passthrough();
const statusSchema = z.object({
  data: z.object({
    payment_status: z.string(),
    payment_amount: z.union([z.string(), z.number()]),
    payment_currency: z.string().length(3),
  }),
  status: z.object({ code: z.string(), tran_id: z.string() }),
});

export async function POST(request: Request) {
  let config: ReturnType<typeof getPayWayConfig>;
  try { config = getPayWayConfig(); } catch { return Response.json({ error: "PayWay is not configured." }, { status: 503 }); }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 16_384) return Response.json({ error: "Request too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as Record<string, unknown>;
  } catch { return Response.json({ error: "Invalid callback." }, { status: 400 }); }
  const callback = callbackSchema.safeParse(body);
  const signature = request.headers.get("x-payway-hmac-sha512") ?? "";
  if (!callback.success || !signature || !verifyPayWayCallback(body, signature, config.apiKey)) {
    return Response.json({ error: "Invalid PayWay signature." }, { status: 401 });
  }
  if (String(callback.data.status) !== "0") return Response.json({ received: true });

  const service = createServiceClient();
  const { data: payment, error: lookupError } = await service.from("payments")
    .select("id, provider, provider_transaction_id, status, amount_minor, currency")
    .eq("provider", "aba_payway").eq("provider_transaction_id", callback.data.tran_id).maybeSingle();
  if (lookupError) return Response.json({ error: "Payment lookup failed." }, { status: 500 });
  if (!payment) return Response.json({ error: "Unknown transaction." }, { status: 404 });
  if (payment.status === "paid") return Response.json({ received: true });
  if (payment.status !== "pending") return Response.json({ received: true });

  const reqTime = utcPayWayTime();
  const requestBody = {
    req_time: reqTime,
    merchant_id: config.merchantId,
    tran_id: callback.data.tran_id,
    hash: signPayWay(`${reqTime}${config.merchantId}${callback.data.tran_id}`, config.apiKey),
  };
  let providerResponse: Response;
  try {
    providerResponse = await fetch(`${config.base}/api/payment-gateway/v1/payments/check-transaction-2`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody), cache: "no-store", signal: AbortSignal.timeout(10000),
    });
  } catch { return Response.json({ error: "PayWay verification is temporarily unavailable." }, { status: 503 }); }
  if (!providerResponse.ok) return Response.json({ error: "PayWay verification failed." }, { status: 502 });
  let verified: z.infer<typeof statusSchema>;
  try { verified = statusSchema.parse(await providerResponse.json()); }
  catch { return Response.json({ error: "Invalid PayWay verification response." }, { status: 502 }); }
  if (verified.status.code !== "00" || verified.status.tran_id !== callback.data.tran_id || verified.data.payment_status !== "APPROVED") {
    return Response.json({ received: true, verified: false });
  }
  const amount = Number(verified.data.payment_amount);
  const currency = verified.data.payment_currency.toUpperCase();
  const digits = currency === "KHR" ? 0 : currency === "USD" ? 2 : -1;
  if (digits < 0 || !Number.isFinite(amount)) return Response.json({ error: "Unsupported payment amount." }, { status: 422 });

  const { error: verifyError } = await service.rpc("verify_payway_payment", {
    _payment_id: payment.id,
    _transaction_id: callback.data.tran_id,
    _verified_amount_minor: Math.round(amount * 10 ** digits),
    _verified_currency: currency,
    _provider_details: { tran_id: callback.data.tran_id, apv: body.apv ?? null, payment_status: verified.data.payment_status },
  });
  if (verifyError) return Response.json({ error: "Payment did not match the expected order." }, { status: 422 });
  return Response.json({ received: true, verified: true });
}
