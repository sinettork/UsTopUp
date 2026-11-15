import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isFrontendPreview } from "@/lib/preview-mode";

export const metadata: Metadata = { title: "My orders | NexusPay" };

async function OrdersContent() {
  if (isFrontendPreview()) {
    return (
      <main className="min-h-screen bg-[#100d18] text-[#f5f2fb]">
        <header className="border-b border-[#2b2438] bg-[#15111f]"><div className="mx-auto flex h-14 max-w-4xl items-center px-4 sm:px-6"><Link href="/" className="inline-flex items-center gap-2 text-sm text-[#aaa1ba] hover:text-white"><ArrowLeft className="size-4" aria-hidden="true" /> Storefront</Link></div></header>
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-[#b49af5]">Frontend preview</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Order status</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[#aaa1ba]">Order history will connect when the backend is re-enabled. The current preview does not create real orders.</p>
          <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-[#8060d7] px-4 text-sm font-medium text-white hover:bg-[#9678e8]">Return to catalog</Link>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount%2Forders");

  const { data: orders, error } = await supabase.from("orders")
    .select("id, order_number, status, total_minor, currency, created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const orderIds = (orders ?? []).map((order) => order.id);
  const [itemsResult, paymentsResult] = orderIds.length ? await Promise.all([
    supabase.from("order_items").select("id, order_id, product_title, package_label").in("order_id", orderIds),
    supabase.from("payments").select("order_id, status").in("order_id", orderIds).order("created_at", { ascending: false }),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  const items = itemsResult.data ?? [];
  const payments = paymentsResult.data ?? [];

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800"><div className="mx-auto flex h-14 max-w-4xl items-center px-4 sm:px-6"><Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"><ArrowLeft className="size-4" aria-hidden="true" /> Storefront</Link></div></header>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <div><p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Account</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">My orders</h1><p className="mt-2 text-sm text-zinc-400">Review your recent orders and payment progress.</p></div>
        {error ? <p role="alert" className="rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300">Order history is temporarily unavailable.</p> : orders?.length ? (
          <div className="space-y-3">
            {orders.map((order) => {
              const orderItems = items.filter((item) => item.order_id === order.id);
              const latestPayment = payments.find((payment) => payment.order_id === order.id);
              const status = order.status === "completed" ? "Completed" : order.status === "processing" ? "Payment confirmed" : order.status === "cancelled" ? "Cancelled" : latestPayment?.status === "pending" ? "Payment pending" : latestPayment?.status === "paid" ? "Payment confirmed" : "Awaiting payment";
              const statusClass = order.status === "completed" || order.status === "processing" ? "border-emerald-900 bg-emerald-950/40 text-emerald-300" : order.status === "cancelled" ? "border-red-900 bg-red-950/40 text-red-300" : "border-amber-900 bg-amber-950/40 text-amber-300";
              return (
                <Link key={order.id} href={`/orders/${order.order_number}`} className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-600 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-zinc-500">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "Asia/Phnom_Penh" }).format(new Date(order.created_at))}</p><h2 className="mt-1 font-medium">{order.order_number}</h2><p className="mt-1 text-sm text-zinc-400">{orderItems.map((item) => `${item.product_title} · ${item.package_label}`).join(", ")}</p></div><div className="text-right"><p className="text-sm font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency.trim() }).format(order.total_minor / 10 ** (new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency.trim() }).resolvedOptions().maximumFractionDigits ?? 2))}</p><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] ${statusClass}`}>{status}</span></div></div>
                </Link>
              );
            })}
          </div>
        ) : <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center"><ClipboardList className="mx-auto size-8 text-zinc-600" aria-hidden="true" /><p className="mt-3 text-sm text-zinc-400">You haven’t placed any orders yet.</p><Link href="/" className="mt-4 inline-flex text-sm font-medium text-zinc-100 underline underline-offset-4">Browse catalog</Link></div>}
      </div>
    </main>
  );
}

function OrdersFallback() {
  return <main className="min-h-screen bg-[#09090b] px-4 py-8 text-zinc-100" aria-busy="true"><div className="mx-auto max-w-4xl space-y-4"><div className="h-20 animate-pulse rounded-lg bg-zinc-900" /><div className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /><div className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /></div></main>;
}

export default function AccountOrdersPage() {
  return <Suspense fallback={<OrdersFallback />}><OrdersContent /></Suspense>;
}
