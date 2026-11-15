import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Network } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { savePackageMapping, saveSupplier } from "./actions";

export const metadata: Metadata = { title: "Suppliers | NexusPay" };
const inputClass = "mt-1.5 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-700";
const labelClass = "block text-xs font-medium text-zinc-400";
type SearchParams = Promise<{ notice?: string }>;

async function SuppliersContent({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fsuppliers");
  const [owner, administrator] = await Promise.all([
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "owner" }),
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "administrator" }),
  ]);
  if (owner.error || administrator.error || (!owner.data && !administrator.data)) redirect("/admin");

  const [supplierResult, productResult, packageResult, mappingResult, query] = await Promise.all([
    supabase.from("suppliers").select("id, code, name, adapter_key, contact_email, is_active").order("name"),
    supabase.from("games").select("id, title").order("title"),
    supabase.from("game_packages").select("id, game_id, package_code, amount_label, currency, is_active").order("sort_order"),
    supabase.from("package_supplier_mappings").select("id, package_id, supplier_id, supplier_product_code, is_active"),
    searchParams,
  ]);
  const hasError = supplierResult.error || productResult.error || packageResult.error || mappingResult.error;
  const suppliers = supplierResult.data ?? [];
  const products = new Map((productResult.data ?? []).map((item) => [item.id, item.title]));
  const mappings = new Map((mappingResult.data ?? []).map((item) => [item.package_id, item]));
  const packages = packageResult.data ?? [];

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800"><div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100"><ArrowLeft className="size-4" aria-hidden="true" /> Dashboard</Link><span className="text-sm font-semibold">Suppliers</span></div></header>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div><p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Admin operations</p><h1 className="mt-1 text-2xl font-semibold">Supplier setup</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Record suppliers and map products to supplier codes. Supplier secrets belong in server environment variables. Mappings alone do not enable automatic fulfillment; the matching server adapter must be implemented and configured.</p></div>
        {query.notice && <p role="status" className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">{query.notice}</p>}
        {hasError && <p role="alert" className="rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300">Supplier data could not be loaded.</p>}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Add supplier</h2>
          <form action={saveSupplier} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
            <input type="hidden" name="id" value="" />
            <label className={labelClass}>Supplier name<input className={inputClass} name="name" required maxLength={100} placeholder="Supplier name" /></label>
            <label className={labelClass}>Code<input className={inputClass} name="code" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="supplier-name" /></label>
            <label className={labelClass}>Server adapter key<input className={inputClass} name="adapter_key" required defaultValue="manual" placeholder="manual" /><span className="mt-1 block text-[11px] text-zinc-600">Must match a server registered adapter.</span></label>
            <label className={labelClass}>Contact email<input className={inputClass} name="contact_email" type="email" placeholder="Optional" /></label>
            <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="is_active" className="size-4 accent-zinc-100" /> Active</label>
            <div className="sm:col-span-2 lg:col-span-3 lg:text-right"><button className="inline-flex h-10 items-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 hover:bg-white" type="submit">Save supplier</button></div>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Registered suppliers</h2>
          {suppliers.length ? <div className="grid gap-3 md:grid-cols-2">
            {suppliers.map((supplier) => <form key={supplier.id} action={saveSupplier} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={supplier.id} />
              <label className={labelClass}>Name<input className={inputClass} name="name" defaultValue={supplier.name} required /></label>
              <label className={labelClass}>Code<input className={inputClass} name="code" defaultValue={supplier.code} required /></label>
              <label className={labelClass}>Adapter key<input className={inputClass} name="adapter_key" defaultValue={supplier.adapter_key} required /></label>
              <label className={labelClass}>Contact email<input className={inputClass} name="contact_email" type="email" defaultValue={supplier.contact_email} /></label>
              <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="is_active" defaultChecked={supplier.is_active} className="size-4 accent-zinc-100" /> Active</label>
              <div className="text-right"><button className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-800" type="submit">Save supplier</button></div>
            </form>)}
          </div> : <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-5 py-8 text-sm text-zinc-500">No suppliers configured yet.</div>}
        </section>

        <section className="space-y-4">
          <div><h2 className="text-lg font-semibold">Product mappings</h2><p className="mt-1 text-sm text-zinc-400">Map each package to one supplier product code.</p></div>
          {suppliers.length && packages.length ? <div className="space-y-3">{packages.map((item) => {
            const mapping = mappings.get(item.id);
            return <form key={item.id} action={savePackageMapping} className="grid items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 sm:grid-cols-2 lg:grid-cols-5">
              <input type="hidden" name="package_id" value={item.id} />
              <div className="lg:col-span-1"><p className="text-xs text-zinc-500">{products.get(item.game_id) ?? "Product"}</p><p className="mt-1 text-sm font-medium">{item.amount_label} · {item.package_code}</p></div>
              <label className={labelClass}>Supplier<select className={inputClass} name="supplier_id" required defaultValue={mapping?.supplier_id ?? ""}><option value="" disabled>Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.is_active ? "" : " (inactive)"}</option>)}</select></label>
              <label className={labelClass}>Supplier product code<input className={inputClass} name="supplier_product_code" required defaultValue={mapping?.supplier_product_code ?? ""} placeholder="Supplier SKU" /></label>
              <label className="flex items-center gap-2 pb-2 text-sm text-zinc-300"><input type="checkbox" name="is_active" defaultChecked={mapping?.is_active ?? false} className="size-4 accent-zinc-100" /> Active mapping</label>
              <button className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-800" type="submit">Save mapping</button>
            </form>;
          })}</div> : <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-5 py-8 text-sm text-zinc-500">Add suppliers and catalog packages to manage mappings.</div>}
        </section>
        <div className="flex items-center gap-2 text-xs text-zinc-600"><Network className="size-3.5" aria-hidden="true" /> No supplier API connection is enabled until a server adapter is installed.</div>
      </div>
    </main>
  );
}

function SuppliersFallback() {
  return <main className="min-h-screen bg-[#09090b] px-4 py-8 text-zinc-100" aria-busy="true"><div className="mx-auto max-w-6xl space-y-5"><div className="h-16 w-2/3 animate-pulse rounded-lg bg-zinc-900" /><div className="h-44 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /><div className="h-72 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /></div></main>;
}

export default function SuppliersPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<SuppliersFallback />}><SuppliersContent searchParams={searchParams} /></Suspense>;
}
