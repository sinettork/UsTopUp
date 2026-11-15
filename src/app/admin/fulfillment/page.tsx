import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateFulfillmentJob } from "./actions";

export const metadata: Metadata = { title: "Fulfillment | NexusPay" };
type SearchParams = Promise<{ notice?: string }>;
const inputClass = "mt-1.5 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-600 focus:ring-2 focus:ring-zinc-700";

const transitions = {
  queued: ["processing", "failed", "needs_review"],
  processing: ["completed", "failed", "needs_review"],
  failed: ["queued", "needs_review"],
  needs_review: ["queued", "processing", "failed"],
  completed: [],
} as const;

function statusClass(status: string) {
  if (status === "completed") return "border-emerald-900 bg-emerald-950/40 text-emerald-300";
  if (status === "failed" || status === "needs_review") return "border-red-900 bg-red-950/40 text-red-300";
  if (status === "processing") return "border-sky-900 bg-sky-950/40 text-sky-300";
  return "border-amber-900 bg-amber-950/40 text-amber-300";
}

async function FulfillmentContent({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Ffulfillment");
  const { data: staff, error: staffError } = await supabase.rpc("is_staff");
  if (staffError || !staff) redirect("/admin");

  const query = await searchParams;
  const jobsResult = await supabase.from("fulfillment_jobs")
    .select("id, order_item_id, supplier_id, adapter_key, supplier_product_code, status, attempt_count, external_reference, last_error, staff_note, started_at, completed_at, created_at")
    .order("created_at", { ascending: false }).limit(100);
  const jobs = jobsResult.data ?? [];
  const itemIds = jobs.map((job) => job.order_item_id);
  const itemsResult = itemIds.length ? await supabase.from("order_items")
    .select("id, order_id, product_title, package_label")
    .in("id", itemIds) : { data: [], error: null };
  const items = itemsResult.data ?? [];
  const orderIds = [...new Set(items.map((item) => item.order_id))];
  const [ordersResult, fieldsResult, eventsResult, suppliersResult] = orderIds.length ? await Promise.all([
    supabase.from("orders").select("id, order_number, status, customer_id, created_at").in("id", orderIds),
    supabase.from("order_item_inputs").select("order_item_id, field_label, value").in("order_item_id", itemIds),
    supabase.from("fulfillment_events").select("id, job_id, from_status, to_status, note, created_at").in("job_id", jobs.map((job) => job.id)).order("created_at", { ascending: false }),
    supabase.from("suppliers").select("id, name").order("name"),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const orderIdsFound = ordersResult.data ?? [];
  const [profilesResult, paymentItems] = orderIdsFound.length ? await Promise.all([
    supabase.from("profiles").select("id, display_name").in("id", orderIdsFound.map((order) => order.customer_id)),
    supabase.from("payments").select("order_id, status").in("order_id", orderIds).eq("status", "paid"),
  ]) : [{ data: [], error: null }, { data: [], error: null }];

  const hasError = jobsResult.error || itemsResult.error || ordersResult.error || fieldsResult.error || eventsResult.error || suppliersResult.error || profilesResult.error || paymentItems.error;
  const itemById = new Map(items.map((item) => [item.id, item]));
  const orderById = new Map(orderIdsFound.map((order) => [order.id, order]));
  const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
  const supplierById = new Map((suppliersResult.data ?? []).map((supplier) => [supplier.id, supplier.name]));
  const jobInputs = fieldsResult.data ?? [];
  const events = eventsResult.data ?? [];

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800"><div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"><ArrowLeft className="size-4" aria-hidden="true" /> Dashboard</Link><span className="text-sm font-semibold">Fulfillment queue</span></div></header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div><p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Fulfillment</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Payment confirmation creates a separate delivery job. Record manual delivery, resolve supplier issues, or queue a retry. Every status change is logged.</p></div>
        {query.notice && <p role="status" className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">{query.notice}</p>}
        {hasError && <p role="alert" className="rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300">The fulfillment queue could not be loaded.</p>}
        {jobs.length ? <div className="space-y-4">
          {jobs.map((job) => {
            const item = itemById.get(job.order_item_id);
            const order = item ? orderById.get(item.order_id) : undefined;
            const inputValues = jobInputs.filter((input) => input.order_item_id === job.order_item_id);
            const available = transitions[job.status];
            return <article key={job.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 p-4 sm:p-5">
                <div><p className="text-xs text-zinc-500">{order?.order_number ?? "Order"} · {order ? profileById.get(order.customer_id) || "Customer" : "Customer"}</p><h2 className="mt-1 font-medium">{item?.product_title ?? "Product"} · {item?.package_label ?? "Plan"}</h2><p className="mt-1 text-xs text-zinc-500">Job {job.id} · {supplierById.get(job.supplier_id ?? "") ?? job.adapter_key} · attempt {job.attempt_count}</p></div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass(job.status)}`}>{job.status.replaceAll("_", " ")}</span>
              </div>
              <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_1.2fr]">
                <div className="space-y-4">
                  {inputValues.length > 0 && <dl className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">{inputValues.map((input) => <div key={input.field_label} className="flex justify-between gap-3 text-xs"><dt className="text-zinc-500">{input.field_label}</dt><dd className="break-all text-right text-zinc-300">{input.value}</dd></div>)}</dl>}
                  {job.last_error && <p className="rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-xs leading-5 text-red-300">{job.last_error}</p>}
                  {job.external_reference && <p className="text-xs text-zinc-500">Supplier reference: <code className="text-zinc-300">{job.external_reference}</code></p>}
                  <div className="space-y-2">{events.filter((event) => event.job_id === job.id).map((event) => <p key={event.id} className="border-l border-zinc-700 pl-3 text-xs leading-5 text-zinc-500">{event.from_status ? `${event.from_status} → ` : ""}{event.to_status}{event.note ? ` · ${event.note}` : ""}</p>)}</div>
                </div>
                {available.length > 0 && <form action={updateFulfillmentJob} className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                  <input type="hidden" name="job_id" value={job.id} />
                  <label className="block text-xs font-medium text-zinc-400">Update status<select className={inputClass} name="status" defaultValue={available[0]}>{available.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
                  <label className="block text-xs font-medium text-zinc-400">Supplier reference<input className={inputClass} name="external_reference" maxLength={200} defaultValue={job.external_reference ?? ""} placeholder="Optional" /></label>
                  <label className="block text-xs font-medium text-zinc-400">Staff note<input className={inputClass} name="note" maxLength={1000} placeholder="Required for failed or needs review" /></label>
                  <button className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 hover:bg-white" type="submit">Save update</button>
                </form>}
                {job.status === "completed" && <p className="flex items-center gap-2 text-sm text-emerald-300"><Truck className="size-4" aria-hidden="true" />Delivery recorded as complete.</p>}
              </div>
            </article>;
          })}
        </div> : !hasError && <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center text-sm text-zinc-500">No paid orders are waiting for fulfillment.</div>}
      </div>
    </main>
  );
}

function FulfillmentFallback() {
  return <main className="min-h-screen bg-[#09090b] px-4 py-8 text-zinc-100" aria-busy="true"><div className="mx-auto max-w-6xl space-y-4"><div className="h-16 w-2/3 animate-pulse rounded-lg bg-zinc-900" /><div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /><div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /></div></main>;
}

export default function FulfillmentPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<FulfillmentFallback />}><FulfillmentContent searchParams={searchParams} /></Suspense>;
}
