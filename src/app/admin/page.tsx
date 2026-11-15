import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Boxes, ClipboardList, History, PackageCheck, RotateCcw, Store, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin dashboard | NexusPay" };

const links = [
  { href: "/admin/orders", label: "Orders", description: "Review order, payment, and fulfillment states.", icon: ClipboardList },
  { href: "/admin/catalog", label: "Catalog", description: "Manage products, plans, prices, and customer fields.", icon: Boxes },
  { href: "/admin/suppliers", label: "Suppliers", description: "Manage supplier records and product mappings.", icon: Store },
  { href: "/admin/fulfillment", label: "Fulfillment", description: "Process delivery jobs and record retries.", icon: Truck },
  { href: "/admin/refunds", label: "Refund records", description: "Track refund requests and provider confirmations.", icon: RotateCcw },
  { href: "/admin/audit", label: "Audit log", description: "Review catalog and supplier changes.", icon: History },
];

async function AdminContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin");
  const { data: staff, error: staffError } = await supabase.rpc("is_staff");
  if (staffError || !staff) redirect("/");

  const [orders, pendingPayments, queued, attention, activeProducts] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("fulfillment_jobs").select("id", { count: "exact", head: true }).eq("status", "queued"),
    supabase.from("fulfillment_jobs").select("id", { count: "exact", head: true }).in("status", ["failed", "needs_review"]),
    supabase.from("games").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const stats = [
    { label: "Orders", value: orders.count ?? 0 },
    { label: "Payments pending", value: pendingPayments.count ?? 0 },
    { label: "Delivery queued", value: queued.count ?? 0 },
    { label: "Needs attention", value: attention.count ?? 0 },
    { label: "Active products", value: activeProducts.count ?? 0 },
  ];

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800"><div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link href="/" className="text-sm font-semibold tracking-tight">NexusPay</Link><span className="text-xs text-zinc-500">Admin dashboard</span></div></header>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div><p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1><p className="mt-2 text-sm text-zinc-400">Orders, payments, catalog and delivery operations.</p></div>
        <section aria-label="Operation totals" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{stats.map((stat) => <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"><p className="text-xs text-zinc-500">{stat.label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{stat.value}</p></div>)}</section>
        <section className="grid gap-3 sm:grid-cols-2" aria-label="Admin sections">{links.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} className="group rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 transition-colors hover:border-zinc-600"><div className="flex items-center justify-between"><Icon className="size-5 text-zinc-400" aria-hidden="true" /><ArrowUpRight className="size-4 text-zinc-600 transition-colors group-hover:text-zinc-200" aria-hidden="true" /></div><h2 className="mt-4 font-semibold">{label}</h2><p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p></Link>)}</section>
        <div className="flex items-center gap-2 text-xs text-zinc-600"><PackageCheck className="size-3.5" aria-hidden="true" /> Product delivery remains separate from verified payment.</div>
      </div>
    </main>
  );
}

function DashboardFallback() {
  return <main className="min-h-screen bg-[#09090b] px-4 py-8 text-zinc-100" aria-busy="true"><div className="mx-auto max-w-6xl space-y-5"><div className="h-16 w-1/2 animate-pulse rounded-lg bg-zinc-900" /><div className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /><div className="h-72 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /></div></main>;
}

export default function AdminDashboardPage() {
  return <Suspense fallback={<DashboardFallback />}><AdminContent /></Suspense>;
}
