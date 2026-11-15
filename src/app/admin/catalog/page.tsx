import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createPlan, createProduct, createProductField, updatePlan, updateProduct, updateProductField } from "./actions";

export const metadata: Metadata = { title: "Catalog management | NexusPay" };

const inputClass = "mt-1.5 h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-700";
const labelClass = "block text-xs font-medium text-zinc-400";
const buttonClass = "inline-flex h-10 items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white";

type SearchParams = Promise<{ notice?: string }>;
type ProductFormData = {
  title?: string;
  slug?: string;
  publisher?: string;
  category?: string;
  credit_label?: string;
  currency?: string;
  image_url?: string | null;
  fulfillment_method?: string;
  sort_order?: number;
  is_active?: boolean;
};
type FieldFormData = {
  id: string;
  game_id: string;
  field_key: string;
  label: string;
  field_type: "text" | "email" | "number";
  placeholder: string | null;
  help_text: string | null;
  validation_pattern: string | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
};
type PlanFormData = {
  id: string;
  game_id: string;
  package_code: string;
  amount_label: string;
  bonus_label: string | null;
  price_minor: number;
  supplier_cost_minor: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
};

function ProductFields({ product }: { product?: ProductFormData }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className={labelClass}>Product name<input className={inputClass} name="title" required maxLength={100} defaultValue={String(product?.title ?? "")} placeholder="e.g. ChatGPT Pro" /></label>
      <label className={labelClass}>Slug<input className={inputClass} name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={String(product?.slug ?? "")} placeholder="chatgpt-pro" /></label>
      <label className={labelClass}>Publisher<input className={inputClass} name="publisher" maxLength={100} defaultValue={String(product?.publisher ?? "")} placeholder="OpenAI" /></label>
      <label className={labelClass}>Category<input className={inputClass} name="category" required maxLength={40} defaultValue={String(product?.category ?? "AI Tools")} placeholder="AI Tools" /></label>
      <label className={labelClass}>Unit label<input className={inputClass} name="credit_label" required maxLength={40} defaultValue={String(product?.credit_label ?? "Plan")} placeholder="Monthly plan" /></label>
      <label className={labelClass}>Currency<input className={inputClass} name="currency" required maxLength={3} minLength={3} defaultValue={String(product?.currency ?? "USD")} /></label>
      <label className={labelClass}>Image URL<input className={inputClass} name="image_url" type="url" defaultValue={String(product?.image_url ?? "")} placeholder="https://..." /></label>
      <label className={labelClass}>Fulfillment<select className={inputClass} name="fulfillment_method" defaultValue={String(product?.fulfillment_method ?? "manual")}><option value="manual">Manual</option><option value="automatic">Automatic</option></select></label>
      <label className={labelClass}>Sort order<input className={inputClass} name="sort_order" type="number" min={0} defaultValue={String(product?.sort_order ?? 0)} /></label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-300"><input type="checkbox" name="is_active" defaultChecked={Boolean(product?.is_active)} className="size-4 accent-zinc-100" /> Active in storefront</label>
    </div>
  );
}

function PlanFields({ plan }: { plan?: PlanFormData }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className={labelClass}>Plan code<input className={inputClass} name="package_code" required maxLength={80} defaultValue={String(plan?.package_code ?? "")} placeholder="monthly-1m" /></label>
      <label className={labelClass}>Plan name / duration<input className={inputClass} name="amount_label" required maxLength={100} defaultValue={String(plan?.amount_label ?? "")} placeholder="1 month" /></label>
      <label className={labelClass}>Details / bonus<input className={inputClass} name="bonus_label" maxLength={100} defaultValue={String(plan?.bonus_label ?? "")} placeholder="Optional details" /></label>
      <label className={labelClass}>Retail price (minor units)<input className={inputClass} name="price_minor" type="number" required min={0} step={1} defaultValue={String(plan?.price_minor ?? 0)} /><span className="mt-1 block text-[11px] text-zinc-600">USD 100 = $1.00</span></label>
      <label className={labelClass}>Supplier cost (minor units)<input className={inputClass} name="supplier_cost_minor" type="number" required min={0} step={1} defaultValue={String(plan?.supplier_cost_minor ?? 0)} /><span className="mt-1 block text-[11px] text-zinc-600">Internal cost record</span></label>
      <label className={labelClass}>Currency<input className={inputClass} name="currency" required maxLength={3} minLength={3} defaultValue={String(plan?.currency ?? "USD")} /></label>
      <label className={labelClass}>Sort order<input className={inputClass} name="sort_order" type="number" min={0} defaultValue={String(plan?.sort_order ?? 0)} /></label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-300"><input type="checkbox" name="is_active" defaultChecked={Boolean(plan?.is_active)} className="size-4 accent-zinc-100" /> Active</label>
    </div>
  );
}

function FieldFields({ field }: { field?: Partial<FieldFormData> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className={labelClass}>Field key<input className={inputClass} name="field_key" required maxLength={60} defaultValue={field?.field_key ?? ""} placeholder="player_id" /></label>
      <label className={labelClass}>Label<input className={inputClass} name="label" required maxLength={80} defaultValue={field?.label ?? ""} placeholder="Player ID" /></label>
      <label className={labelClass}>Input type<select className={inputClass} name="field_type" defaultValue={field?.field_type ?? "text"}><option value="text">Text</option><option value="email">Email</option><option value="number">Number</option></select></label>
      <label className={labelClass}>Placeholder<input className={inputClass} name="placeholder" maxLength={100} defaultValue={field?.placeholder ?? ""} /></label>
      <label className={labelClass}>Help text<input className={inputClass} name="help_text" maxLength={240} defaultValue={field?.help_text ?? ""} /></label>
      <label className={labelClass}>Validation pattern<input className={inputClass} name="validation_pattern" maxLength={240} defaultValue={field?.validation_pattern ?? ""} placeholder="Optional regex" /></label>
      <label className={labelClass}>Sort order<input className={inputClass} name="sort_order" type="number" min={0} defaultValue={String(field?.sort_order ?? 0)} /></label>
      <div className="flex flex-wrap items-end gap-4 pb-2 text-sm text-zinc-300">
        <label className="flex items-center gap-2"><input type="checkbox" name="is_required" defaultChecked={field?.is_required ?? true} className="size-4 accent-zinc-100" /> Required</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={field?.is_active ?? true} className="size-4 accent-zinc-100" /> Active</label>
      </div>
    </div>
  );
}

async function CatalogAdminContent({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fcatalog");

  const [owner, administrator] = await Promise.all([
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "owner" }),
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "administrator" }),
  ]);
  if (owner.error || administrator.error || (!owner.data && !administrator.data)) redirect("/");

  const [productsResult, plansResult, fieldsResult, query] = await Promise.all([
    supabase.from("games").select("id, slug, title, publisher, category, credit_label, currency, image_url, fulfillment_method, is_active, sort_order").order("sort_order").order("title"),
    supabase.from("game_packages").select("id, game_id, package_code, amount_label, bonus_label, price_minor, supplier_cost_minor, currency, is_active, sort_order").order("game_id").order("sort_order"),
    supabase.from("game_fields").select("id, game_id, field_key, label, field_type, placeholder, help_text, validation_pattern, is_required, is_active, sort_order").order("game_id").order("sort_order"),
    searchParams,
  ]);

  const catalogError = productsResult.error || plansResult.error || fieldsResult.error;
  const products = productsResult.data ?? [];
  const plans = plansResult.data ?? [];
  const fields = fieldsResult.data ?? [];

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"><ArrowLeft className="size-4" aria-hidden="true" /> Storefront</Link>
          <span className="text-sm font-semibold">Catalog management</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Products and plans</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Manage games and digital subscriptions. Keep products inactive until their pricing and fulfillment details are verified.</p>
        </div>

        {query.notice && <p role="status" className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">{query.notice}</p>}
        {catalogError && <p role="alert" className="rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-300">The catalog could not be loaded. Check the database connection and migrations.</p>}

        <section className="space-y-4" aria-labelledby="new-product-heading">
          <h2 id="new-product-heading" className="text-lg font-semibold">Add product</h2>
          <form action={createProduct} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
            <ProductFields />
            <button className={buttonClass} type="submit">Create product</button>
          </form>
        </section>

        <section className="space-y-4" aria-labelledby="products-heading">
          <div className="flex items-end justify-between gap-4"><div><h2 id="products-heading" className="text-lg font-semibold">Catalog products</h2><p className="mt-1 text-xs text-zinc-500">{products.length} total</p></div></div>
          {products.length === 0 && !catalogError ? <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-5 py-10 text-center text-sm text-zinc-500">No products yet. Add a game or AI subscription above.</div> : (
            <div className="space-y-4">
              {products.map((product) => {
                const productPlans = plans.filter((plan) => plan.game_id === product.id);
                const productFields = fields.filter((field) => field.game_id === product.id);
                return (
                  <article key={product.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
                    <form action={updateProduct} className="space-y-4 p-4 sm:p-5">
                      <input type="hidden" name="id" value={product.id} />
                      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{product.title}</h3><span className={`rounded-full border px-2.5 py-1 text-[11px] ${product.is_active ? "border-emerald-900 bg-emerald-950/40 text-emerald-300" : "border-zinc-700 bg-zinc-900 text-zinc-500"}`}>{product.is_active ? "Active" : "Inactive"}</span></div>
                      <ProductFields product={product} />
                      <div className="flex justify-end"><button className={buttonClass} type="submit">Save product</button></div>
                    </form>

                    <div className="border-t border-zinc-800 bg-zinc-950/30 p-4 sm:p-5">
                      <div className="mb-3"><h4 className="text-sm font-medium">Customer information fields</h4><p className="mt-1 text-xs text-zinc-500">For example, player ID for a game or account email for a subscription.</p></div>
                      {productFields.map((field) => (
                        <form key={field.id} action={updateProductField} className="mb-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                          <input type="hidden" name="id" value={field.id} />
                          <input type="hidden" name="game_id" value={product.id} />
                          <FieldFields field={field} />
                          <div className="flex justify-end"><button className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800" type="submit">Save field</button></div>
                        </form>
                      ))}
                      <form action={createProductField} className="space-y-3 rounded-lg border border-dashed border-zinc-800 p-3">
                        <input type="hidden" name="game_id" value={product.id} />
                        <p className="text-xs font-medium text-zinc-400">Add a customer field</p>
                        <FieldFields />
                        <div className="flex justify-end"><button className="inline-flex h-9 items-center rounded-md bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 hover:bg-white" type="submit">Add field</button></div>
                      </form>
                    </div>

                    <div className="border-t border-zinc-800 bg-zinc-950/40 p-4 sm:p-5">
                      <div className="mb-3 flex items-center justify-between gap-3"><div><h4 className="text-sm font-medium">Plans and packages</h4><p className="mt-1 text-xs text-zinc-500">{productPlans.length} listed</p></div><PackagePlus className="size-4 text-zinc-500" aria-hidden="true" /></div>
                      {productPlans.map((plan) => (
                        <form key={plan.id} action={updatePlan} className="mb-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                          <input type="hidden" name="id" value={plan.id} />
                          <input type="hidden" name="game_id" value={product.id} />
                          <PlanFields plan={plan} />
                          <div className="flex justify-end"><button className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800" type="submit">Save plan</button></div>
                        </form>
                      ))}
                      <form action={createPlan} className="space-y-3 rounded-lg border border-dashed border-zinc-800 p-3">
                        <input type="hidden" name="game_id" value={product.id} />
                        <p className="text-xs font-medium text-zinc-400">Add a plan</p>
                        <PlanFields />
                        <div className="flex justify-end"><button className="inline-flex h-9 items-center rounded-md bg-zinc-100 px-3 text-xs font-semibold text-zinc-900 hover:bg-white" type="submit">Add plan</button></div>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CatalogAdminFallback() {
  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100" aria-busy="true">
      <header className="h-14 border-b border-zinc-800" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-16 max-w-xl animate-pulse rounded-lg bg-zinc-900" />
        <div className="h-56 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
        <div className="h-80 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
      </div>
    </main>
  );
}

export default function CatalogAdminPage(props: { searchParams: SearchParams }) {
  return <Suspense fallback={<CatalogAdminFallback />}><CatalogAdminContent {...props} /></Suspense>;
}
