"use client";

import Link from "next/link";
import { ArrowLeft, Gamepad2, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";

function formatPrice(amountMinor: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
  return formatter.format(amountMinor / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2));
}

export function CartPage({ previewMode = false }: { previewMode?: boolean }) {
  const { items, hydrated, removeItem } = useCart();
  const currencies = [...new Set(items.map((item) => item.currency))];
  const currency = currencies[0] ?? "USD";
  const subtotal = items
    .filter((item) => item.currency === currency)
    .reduce((sum, item) => sum + item.priceMinor, 0);
  const mixedCurrency = currencies.length > 1;

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"><ArrowLeft className="size-4" aria-hidden="true" /> Continue shopping</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div><p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Checkout</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Your cart</h1>{previewMode && <p className="mt-2 text-xs text-violet-300">Frontend preview: sample products and prices. Checkout is paused.</p>}</div>
          <span className="text-sm text-zinc-500">{hydrated ? `${items.length} item${items.length === 1 ? "" : "s"}` : "Loading cart…"}</span>
        </div>

        {!hydrated ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /><div className="h-56 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /></div>
        ) : items.length === 0 ? (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-16 text-center">
            <ShoppingCart className="mx-auto size-9 text-zinc-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">Your cart is empty</h2>
            <p className="mt-2 text-sm text-zinc-500">Choose a game and package to start your top-up.</p>
            <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white">Browse games</Link>
          </section>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section aria-label="Cart items" className="space-y-3">
              {items.map((item) => (
                <article key={item.key} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-500"><Gamepad2 className="size-5" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><h2 className="font-medium text-zinc-100">{item.productTitle}</h2><p className="mt-1 text-sm text-zinc-400">{item.packageLabel}{item.bonusLabel ? ` · ${item.bonusLabel}` : ""}</p></div>
                        <span className="text-sm font-semibold text-zinc-100">{formatPrice(item.priceMinor, item.currency)}</span>
                      </div>
                      {Object.entries(item.customerInputs).filter(([, value]) => value).length > 0 && (
                        <dl className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
                          {Object.entries(item.customerInputs).filter(([, value]) => value).map(([key, value]) => <div key={key} className="flex gap-2 text-xs"><dt className="text-zinc-500">{item.inputLabels[key] ?? key}</dt><dd className="break-all text-zinc-300">{value}</dd></div>)}
                        </dl>
                      )}
                      <div className="mt-3 flex justify-end"><button type="button" onClick={() => removeItem(item.key)} className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-red-300"><Trash2 className="size-3.5" aria-hidden="true" /> Remove</button></div>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="font-semibold">Order summary</h2>
              <div className="mt-4 flex justify-between border-t border-zinc-800 pt-4 text-sm"><span className="text-zinc-400">Subtotal</span><span>{formatPrice(subtotal, currency)}</span></div>
              <div className="mt-3 flex justify-between text-sm"><span className="text-zinc-400">Fees</span><span className="text-zinc-400">Calculated at checkout</span></div>
              {mixedCurrency && <p role="alert" className="mt-4 rounded-lg border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">Your cart contains different currencies. Remove items in other currencies and place separate orders.</p>}
              <p className="mt-4 text-xs leading-5 text-zinc-500">Package availability and price are checked again when you place the order.</p>
              {mixedCurrency ? (
                <button type="button" disabled className="mt-5 inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-md border border-zinc-800 text-sm font-semibold text-zinc-500">Separate currencies first</button>
              ) : (
                <Link href="/checkout" className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white">{previewMode ? "Review checkout preview" : "Continue to checkout"}</Link>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
