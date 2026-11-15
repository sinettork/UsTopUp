import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPayWayConfig, signPayWay, utcPayWayTime } from "@/lib/payments/payway";
import { PayWayCheckoutForm } from "./checkout-form";

async function PayWayCheckoutContent({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: payment } = await supabase.from("payments")
    .select("id, order_id, provider, provider_reference, provider_transaction_id, status, amount_minor, currency")
    .eq("id", paymentId).maybeSingle();
  if (!payment || payment.provider !== "aba_payway") notFound();
  const { data: order } = await supabase.from("orders").select("order_number, customer_id")
    .eq("id", payment.order_id).maybeSingle();
  if (!order || order.customer_id !== user.id) notFound();
  if (payment.status !== "pending" || !payment.provider_transaction_id) redirect(`/orders/${order.order_number}`);

  let config;
  try { config = getPayWayConfig(); } catch { redirect(`/orders/${order.order_number}?payment_notice=PayWay%20is%20not%20configured`); }
  const currency = payment.currency.trim().toUpperCase();
  if (currency !== "USD" && currency !== "KHR") redirect(`/orders/${order.order_number}?payment_notice=Unsupported%20currency`);
  const amount = currency === "KHR" ? String(payment.amount_minor) : (payment.amount_minor / 100).toFixed(2);
  const fields: Record<string, string> = {
    req_time: utcPayWayTime(),
    merchant_id: config.merchantId,
    tran_id: payment.provider_transaction_id,
    amount,
    type: "purchase",
    payment_option: "",
    currency,
    return_url: `${config.site}/api/payments/payway/callback`,
    return_params: JSON.stringify({ paymentId: payment.id }),
  };
  fields.hash = signPayWay([
    "req_time", "merchant_id", "tran_id", "amount", "items", "shipping", "ctid", "pwt",
    "firstname", "lastname", "email", "phone", "type", "payment_option", "return_url",
    "cancel_url", "continue_success_url", "return_deeplink", "currency", "custom_fields", "return_params",
  ].map((key) => key === "items" ? "" : fields[key] ?? "").join(""), config.apiKey);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-12">
      <section className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Secure checkout</p>
        <h1 className="mt-2 text-2xl font-semibold">Continue with ABA PayWay</h1>
        <p className="mt-3 text-sm text-zinc-400">Order {order.order_number} · {currency} {amount}</p>
        <p className="mt-2 text-xs text-zinc-500">Your payment is confirmed only after PayWay verifies the transaction.</p>
        <div className="mt-6"><PayWayCheckoutForm action={config.checkoutUrl} fields={fields} /></div>
      </section>
    </main>
  );
}

export default function PayWayCheckoutPage(props: { params: Promise<{ paymentId: string }> }) {
  return <Suspense fallback={<main className="min-h-[70vh] bg-[#09090b] px-4 py-12 text-zinc-100"><div className="mx-auto h-64 max-w-2xl animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /></main>}><PayWayCheckoutContent {...props} /></Suspense>;
}
