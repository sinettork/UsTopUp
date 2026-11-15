import type { Metadata } from "next";
import { Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Orders | NexusPay" };

function Badge({ children, tone = "amber" }: { children: ReactNode; tone?: "amber" | "green" | "red" | "blue" }) {
  const styles = {
    amber: "border-amber-900 bg-amber-950/40 text-amber-300",
    green: "border-emerald-900 bg-emerald-950/40 text-emerald-300",
    red: "border-red-900 bg-red-950/40 text-red-300",
    blue: "border-sky-900 bg-sky-950/40 text-sky-300",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles[tone]}`}>{children}</span>;
}

async function OrdersContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Forders");
  const { data: staff, error: staffError } = await supabase.rpc("is_staff");
  if (staffError || !staff) redirect("/admin");

  const { data: orders, error } = await supabase.from("orders")
    .select("id, order_number, customer_id, status, total_minor, currency, created_at")
    .order("created_at", { ascending: false }).limit(100);
  const orderIds = (orders ?? []).map((order) => order.id);
  const [itemsResult, paymentsResult, profilesResult] = orderIds.length ? await Promise.all([
    supabase.from("order_items").select("id, order_id, product_title, package_label").in("order_id", orderIds),
    supabase.from("payments").select("id, order_id, provider, status, provider_reference").in("order_id", orderIds).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, display_name").in("id", [...new Set((orders ?? []).map((order) => order.customer_id))]),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const itemIds = (itemsResult.data ?? []).map((item) => item.id);
  const jobsResult = itemIds.length ? await supabase.from("fulfillment_jobs").select("order_item_id, status").in("order_item_id", itemIds) : { data: [], error: null };
  const hasError = error || itemsResult.error || paymentsResult.error || profilesResult.error || jobsResult.error;
  const itemsByOrder = new Map<string, typeof itemsResult.data>();
  for (const item of itemsResult.data ?? []) itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  const profileNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
  const jobsByItem = new Map((jobsResult.data ?? []).map((job) => [job.order_item_id, job.status]));

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800"><div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"><ArrowLeft className="size-4" aria-hidden="true" /> Dashboard</Link><span className="text-sm font-semibold">Orders</span></div></header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div><p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Order management</h1><p className="mt-2 text-sm text-zinc-400">Payment state and fulfillment state are tracked separately.</p></div>
        {hasError && <p role="alert" className="rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300">Orders could not be fully loaded.</p>}
        {orders?.length ? <div className="space-y-3">{orders.map((order) => {
          const items = itemsByOrder.get(order.id) ?? [];
          const orderPayments = (paymentsResult.data ?? []).filter((payment) => payment.order_id === order.id);
          const payment = orderPayments[0];
          const statuses = items.map((item) => jobsByItem.get(item.id)).filter((status): status is NonNullable<typeof status> => Boolean(status));
          const fulfillment = statuses.length === 0 ? "not queued" : statuses.every((status) => status === "completed") ? "completed" : statuses.some((status) => status === "failed" || status === "needs_review") ? "needs review" : statuses.some((status) => status === "processing") ? "processing" : "queued";
          const fulfillmentTone = fulfillment === "completed" ? "green" : fulfillment === "needs review" ? "red" : fulfillment === "processing" ? "blue" : "amber";
          const paymentTone = payment?.status === "paid" ? "green" : payment?.status === "failed" || payment?.status === "expired" ? "red" : "amber";
          return <article key={order.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-zinc-500">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(new Date(order.created_at))}</p><h2 className="mt-1 font-medium">{order.order_number}</h2><p className="mt-1 text-xs text-zinc-500">Customer: {profileNames.get(order.customer_id) || order.customer_id.slice(0, 8)}</p><p className="mt-2 text-sm text-zinc-400">{items.map((item) => `${item.product_title} · ${item.package_label}`).join(", ")}</p></div><div className="flex flex-col items-end gap-2"><span className="text-sm font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency.trim() }).format(order.total_minor / 10 ** (new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency.trim() }).resolvedOptions().maximumFractionDigits ?? 2))}</span><Badge tone={order.status === "completed" ? "green" : order.status === "processing" ? "blue" : order.status === "cancelled" ? "red" : "amber"}>Order · {order.status.replaceAll("_", " ")}</Badge><Badge tone={paymentTone}>Payment · {payment?.status ?? "not started"}</Badge><Badge tone={fulfillmentTone}>Delivery · {fulfillment}</Badge></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3"><span className="text-xs text-zinc-500">{payment ? `${payment.provider} · ${payment.provider_reference}` : "No payment attempt"}</span><Link href={`/orders/${order.order_number}`} className="text-xs font-medium text-zinc-300 underline-offset-4 hover:text-white hover:underline">View receipt</Link></div></article>;
        })}</div> : !hasError && <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center text-sm text-zinc-500">No orders yet.</div>}
      </div>
    </main>
  );
}

function AdminOrdersFallback() {
  return <main className="min-h-screen bg-[#09090b] px-4 py-8 text-zinc-100" aria-busy="true"><div className="mx-auto max-w-6xl space-y-4"><div className="h-16 w-1/2 animate-pulse rounded-lg bg-zinc-900" /><div className="h-36 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /><div className="h-36 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /></div></main>;
}

export default function AdminOrdersPage() {
  return <Suspense fallback={<AdminOrdersFallback />}><OrdersContent /></Suspense>;
}
