import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3, ReceiptText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { startBakongPayment, startPayWayPayment } from "@/app/payments/actions";

export const metadata: Metadata = { title: "Order details | NexusPay" };

function formatPrice(amountMinor: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / 10 ** digits);
}

async function OrderContent({ params, searchParams }: PageProps<"/orders/[orderNumber]">) {
  const { orderNumber } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/orders/${orderNumber}`)}`);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, status, total_minor, currency, created_at")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!order && !orderError) notFound();
  if (orderError || !order) {
    return <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 text-center text-zinc-100"><div><h1 className="text-xl font-semibold">Order details unavailable</h1><p className="mt-2 text-sm text-zinc-400">Please try again later.</p><Link href="/" className="mt-5 inline-flex text-sm text-zinc-200 underline underline-offset-4">Back to catalog</Link></div></main>;
  }

  const [itemsResult, paymentResult] = await Promise.all([
    supabase.from("order_items").select("id, product_title, package_label, package_code, unit_price_minor, currency").eq("order_id", order.id),
    supabase.from("payments").select("id, provider, status, qr_payload, provider_transaction_id").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: items, error: itemsError } = itemsResult;
  const payment = paymentResult.data;
  const itemIds = (items ?? []).map((item) => item.id);
  const [inputsResult, fulfillmentResult] = itemIds.length ? await Promise.all([
    supabase.from("order_item_inputs").select("order_item_id, field_label, value").in("order_item_id", itemIds),
    supabase.from("fulfillment_jobs").select("order_item_id, status, completed_at").in("order_item_id", itemIds),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  const inputs = inputsResult.data;
  const fulfillmentJobs = fulfillmentResult.data;
  const orderStatus = order.status === "completed"
    ? "Completed"
    : order.status === "cancelled"
      ? "Cancelled"
      : order.status === "processing"
        ? "Payment confirmed"
        : payment?.status === "pending"
          ? "Payment pending"
          : "Awaiting payment";
  const orderStatusClass = order.status === "completed" || order.status === "processing"
    ? "border-emerald-900 bg-emerald-950/40 text-emerald-300"
    : order.status === "cancelled"
      ? "border-red-900 bg-red-950/40 text-red-300"
      : "border-amber-900 bg-amber-950/40 text-amber-300";

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800"><div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6"><Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"><ArrowLeft className="size-4" aria-hidden="true" /> Storefront</Link></div></header>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs text-zinc-500"><ReceiptText className="size-4" aria-hidden="true" /> Order receipt</div><h1 className="mt-2 text-2xl font-semibold tracking-tight">{order.order_number}</h1></div><span className={`rounded-full border px-3 py-1 text-xs font-medium ${orderStatusClass}`}>{orderStatus}</span></div>
            <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><Clock3 className="size-3.5" aria-hidden="true" />{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(order.created_at))} UTC</p>
          </div>

          {query.payment_notice && <p role="status" className="mx-5 mt-5 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 sm:mx-6">{query.payment_notice}</p>}
          {itemsError || inputsResult.error || fulfillmentResult.error || paymentResult.error ? (
            <p role="alert" className="m-5 rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300">Some order details could not be loaded.</p>
          ) : (
            <div className="space-y-4 p-5 sm:p-6">
              {(items ?? []).map((item) => (
                <article key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="flex items-start justify-between gap-4"><div><h2 className="font-medium">{item.product_title}</h2><p className="mt-1 text-sm text-zinc-400">{item.package_label}</p></div><span className="text-sm font-semibold">{formatPrice(item.unit_price_minor, item.currency)}</span></div>
                  {(inputs ?? []).filter((input) => input.order_item_id === item.id).length > 0 && <dl className="mt-4 space-y-2 border-t border-zinc-800 pt-3">{(inputs ?? []).filter((input) => input.order_item_id === item.id).map((input) => <div key={input.field_label} className="flex justify-between gap-4 text-xs"><dt className="text-zinc-500">{input.field_label}</dt><dd className="max-w-[65%] break-all text-right text-zinc-300">{input.value}</dd></div>)}</dl>}
                  {(() => {
                    const job = (fulfillmentJobs ?? []).find((entry) => entry.order_item_id === item.id);
                    if (!job) return null;
                    const label = job.status === "completed" ? "Delivered" : job.status === "processing" ? "Top-up in progress" : job.status === "queued" ? "Queued for fulfillment" : "Under review";
                    const color = job.status === "completed" ? "text-emerald-300" : job.status === "failed" || job.status === "needs_review" ? "text-amber-300" : "text-sky-300";
                    return <p className={`mt-4 border-t border-zinc-800 pt-3 text-xs ${color}`}>Delivery status: {label}{job.completed_at ? ` · ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "Asia/Phnom_Penh" }).format(new Date(job.completed_at))}` : ""}</p>;
                  })()}
                </article>
              ))}
              <div className="flex justify-between border-t border-zinc-800 pt-4 text-sm"><span className="text-zinc-400">Total</span><span className="font-semibold">{formatPrice(order.total_minor, order.currency)}</span></div>
              {order.status === "pending_payment" && payment?.provider === "aba_payway" && payment.status === "pending" && payment.provider_transaction_id ? (
                <Link href={`/payments/${payment.id}/payway`} className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white">Continue ABA PayWay checkout</Link>
              ) : order.status === "pending_payment" && payment?.provider === "bakong" && payment.status === "pending" && payment.qr_payload ? (
                <Link href={`/payments/${payment.id}`} className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white">Continue Bakong payment</Link>
              ) : order.status === "pending_payment" && (payment?.status !== "pending" || (payment.provider === "bakong" && !payment.qr_payload) || (payment.provider === "aba_payway" && !payment.provider_transaction_id)) ? (
                <div className="space-y-3"><form action={startBakongPayment}><input type="hidden" name="order_number" value={order.order_number} /><button type="submit" className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white">Pay with Bakong KHQR</button></form><form action={startPayWayPayment}><input type="hidden" name="order_number" value={order.order_number} /><button type="submit" className="inline-flex h-11 w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-4 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800">Pay with ABA PayWay</button></form><p className="text-center text-xs text-zinc-500">The order price is fixed. Payment is confirmed only after the provider verifies the transfer.</p></div>
              ) : null}
            </div>
          )}

          <div className="border-t border-zinc-800 bg-zinc-950/40 px-5 py-4 sm:px-6"><p className="text-sm text-zinc-300">{order.status === "completed" ? "All items in this order have been marked as delivered." : order.status === "processing" ? "Payment was verified. Fulfillment is in progress; the order is not marked complete until all items are delivered." : order.status === "cancelled" ? "This order has been cancelled." : "This order is waiting for payment. No product has been delivered."}</p></div>
        </section>
      </div>
    </main>
  );
}

function OrderFallback() {
  return <main className="min-h-screen bg-[#09090b] px-4 py-8 text-zinc-100" aria-busy="true"><div className="mx-auto max-w-3xl space-y-5"><div className="h-14 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/70" /><div className="h-[30rem] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/70" /></div></main>;
}

export default function OrderPage(props: PageProps<"/orders/[orderNumber]">) {
  return <Suspense fallback={<OrderFallback />}><OrderContent {...props} /></Suspense>;
}
