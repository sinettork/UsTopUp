import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log | NexusPay" };

function recordSummary(details: Record<string, unknown>) {
  const record = typeof details.record === "object" && details.record !== null
    ? details.record as Record<string, unknown>
    : details;
  return ["title", "slug", "name", "code", "package_code", "supplier_product_code", "category", "price_minor", "supplier_cost_minor"]
    .filter((key) => record[key] !== undefined && record[key] !== null)
    .map((key) => `${key}: ${String(record[key])}`)
    .join(" · ");
}

async function AuditContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Faudit");
  const [owner, administrator] = await Promise.all([
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "owner" }),
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "administrator" }),
  ]);
  if (owner.error || administrator.error || (!owner.data && !administrator.data)) redirect("/admin");

  const [eventsResult, profilesResult] = await Promise.all([
    supabase.from("admin_audit_events").select("id, actor_id, action, entity_table, entity_id, details, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id, display_name"),
  ]);
  const events = eventsResult.data ?? [];
  const names = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800"><div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6 lg:px-8"><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"><ArrowLeft className="size-4" aria-hidden="true" /> Dashboard</Link></div></header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div><p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Governance</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight"><History className="size-5 text-zinc-500" aria-hidden="true" /> Audit log</h1><p className="mt-2 text-sm text-zinc-400">Recent catalog and supplier changes.</p></div>
        {eventsResult.error || profilesResult.error ? <p role="alert" className="rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300">The audit log could not be loaded.</p> : events.length ? <div className="overflow-hidden rounded-xl border border-zinc-800"><div className="divide-y divide-zinc-800">{events.map((event) => <article key={event.id} className="grid gap-2 bg-zinc-900/30 p-4 sm:grid-cols-[180px_1fr] sm:gap-5"><time className="text-xs text-zinc-500">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(new Date(event.created_at))}</time><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-md border border-zinc-700 px-2 py-0.5 text-[11px] uppercase text-zinc-300">{event.action}</span><span className="text-sm font-medium">{event.entity_table}</span><span className="text-xs text-zinc-600">by {names.get(event.actor_id ?? "") || "Former user"}</span></div><p className="mt-1 text-xs leading-5 text-zinc-500">{recordSummary(event.details) || event.entity_id}</p></div></article>)}</div></div> : <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center text-sm text-zinc-500">No audited catalog or supplier changes yet.</div>}
      </div>
    </main>
  );
}

function AuditFallback() {
  return <main className="min-h-screen bg-[#09090b] px-4 py-8 text-zinc-100" aria-busy="true"><div className="mx-auto max-w-6xl space-y-4"><div className="h-16 w-1/2 animate-pulse rounded-lg bg-zinc-900" /><div className="h-96 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /></div></main>;
}

export default function AuditPage() {
  return <Suspense fallback={<AuditFallback />}><AuditContent /></Suspense>;
}
