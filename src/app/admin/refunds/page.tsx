import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requestRefund, updateRefund } from "./actions";

export const metadata: Metadata = { title: "Refunds | NexusPay" };
type SearchParams = Promise<{ notice?: string }>;
const inputClass = "mt-1.5 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600 focus:ring-2 focus:ring-zinc-700";
const transitions = { requested: ["processing", "failed"], processing: ["completed", "failed"], failed: ["requested"], completed: [] } as const;

async function RefundsContent({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Frefunds");
  const [owner, administrator] = await Promise.all([
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "owner" }),
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "administrator" }),
  ]);
  if (owner.error || administrator.error || (!owner.data && !administrator.data)) redirect("/admin");
  const query = await searchParams;

  const [paymentResult, refundsResult] = await Promise.all([
    supabase.from("payments").select("id, order_id, provider, provider_reference, status, amount_minor, currency, created_at").in("status", ["paid", "refunded"]).order("created_at", { ascending: false }).limit(100),
    supabase.from("refunds").select("id, payment_id, amount_minor, currency, status, reason, provider_refund_reference, staff_note, created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const payments = paymentResult.data ?? [];
  const refunds = refundsResult.data ?? [];
  const orderIds = [...new Set(payments.map((payment) => payment.order_id))];
  const ordersResult = orderIds.length ? await supabase.from("orders").select("id, order_number").in("id", orderIds) : { data: [], error: null };
  const orders = new Map((ordersResult.data ?? []).map((order) => [order.id, order.order_number]));
  const refundsByPayment = new Map<string, typeof refunds>();
  for (const refund of refunds) refundsByPayment.set(refund.payment_id, [...(refundsByPayment.get(refund.payment_id) ?? []), refund]);
  const hasError = paymentResult.error || refundsResult.error || ordersResult.error;

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800"><div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"><ArrowLeft className="size-4" aria-hidden="true" /> Dashboard</Link><span className="text-sm font-semibold">Refunds</span></div></header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div><p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Payments</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Refund records</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Record the requested amount, process it through the provider, then log its confirmed provider reference. Marking a refund complete updates the refund and payment records; it does not send money to the customer.</p></div>
        {query.notice && <p role="status" className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">{query.notice}</p>}
        {hasError && <p role="alert" className="rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300">Refund records could not be loaded.</p>}
        {payments.length ? <div className="space-y-4">{payments.map((payment) => {
          const paymentRefunds = refundsByPayment.get(payment.id) ?? [];
          const reserved = paymentRefunds.filter((refund) => refund.status === "requested" || refund.status === "processing" || refund.status === "completed").reduce((sum, refund) => sum + refund.amount_minor, 0);
          const remaining = Math.max(0, payment.amount_minor - reserved);
          return <article key={payment.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-zinc-500">{orders.get(payment.order_id) ?? "Order"} · {payment.provider}</p><h2 className="mt-1 font-medium">{payment.provider_reference}</h2><p className="mt-1 text-sm text-zinc-400">Paid amount: {new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency.trim() }).format(payment.amount_minor / 10 ** (new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency.trim() }).resolvedOptions().maximumFractionDigits ?? 2))}</p></div><span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300">{payment.status}</span></div>
            {paymentRefunds.length > 0 && <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">{paymentRefunds.map((refund) => {
              const available = transitions[refund.status];
              return <div key={refund.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{refund.reason}</span><span className="font-medium">{new Intl.NumberFormat("en-US", { style: "currency", currency: refund.currency.trim() }).format(refund.amount_minor / 10 ** (new Intl.NumberFormat("en-US", { style: "currency", currency: refund.currency.trim() }).resolvedOptions().maximumFractionDigits ?? 2))} · {refund.status}</span></div>{refund.provider_refund_reference && <p className="mt-1 text-xs text-zinc-500">Provider ref: {refund.provider_refund_reference}</p>}{refund.staff_note && <p className="mt-1 text-xs text-zinc-500">{refund.staff_note}</p>}
                {available.length > 0 && <form action={updateRefund} className="mt-3 grid gap-3 sm:grid-cols-4"><input type="hidden" name="refund_id" value={refund.id} /><label className="block text-xs text-zinc-500">Next state<select className={inputClass} name="status" defaultValue={available[0]}>{available.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label className="block text-xs text-zinc-500">Provider refund reference<input className={inputClass} name="provider_reference" maxLength={200} defaultValue={refund.provider_refund_reference ?? ""} /></label><label className="block text-xs text-zinc-500">Staff note<input className={inputClass} name="note" maxLength={1000} placeholder="Required if failed" /></label><button className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 px-4 text-sm text-zinc-200 hover:bg-zinc-800" type="submit">Save</button></form>}
              </div>;
            })}</div>}
            {remaining > 0 && <form action={requestRefund} className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-[minmax(0,1fr)_2fr_auto]"><input type="hidden" name="payment_id" value={payment.id} /><label className="block text-xs text-zinc-500">Amount (minor units, max {remaining})<input className={inputClass} name="amount_minor" type="number" min={1} max={remaining} step={1} required /></label><label className="block text-xs text-zinc-500">Reason<input className={inputClass} name="reason" maxLength={1000} required /></label><button className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 hover:bg-white" type="submit"><RotateCcw className="size-4" aria-hidden="true" /> Record refund</button></form>}
          </article>;
        })}</div> : !hasError && <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center text-sm text-zinc-500">No verified payments to refund.</div>}
      </div>
    </main>
  );
}

function RefundsFallback() {
  return <main className="min-h-screen bg-[#09090b] px-4 py-8 text-zinc-100" aria-busy="true"><div className="mx-auto max-w-6xl space-y-4"><div className="h-16 w-1/2 animate-pulse rounded-lg bg-zinc-900" /><div className="h-48 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /><div className="h-48 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /></div></main>;
}

export default function RefundsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<RefundsFallback />}><RefundsContent searchParams={searchParams} /></Suspense>;
}
