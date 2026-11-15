"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import { createCartOrder, type CheckoutActionState } from "@/app/checkout/actions";
import { useCart } from "@/components/cart-provider";

const initialState: CheckoutActionState = { message: "" };

export type CheckoutOffer = {
  productTitle: string;
  packageLabel: string;
  bonusLabel: string | null;
  priceMinor: number;
  currency: string;
};

function formatPrice(amountMinor: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
  return formatter.format(amountMinor / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2));
}

export function CheckoutPage({ email, isPreview, offers }: { email: string; isPreview: boolean; offers: Record<string, CheckoutOffer> }) {
  const router = useRouter();
  const { items, hydrated, clearCart } = useCart();
  const idempotencyInput = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(createCartOrder, initialState);
  const lines = useMemo(() => items.map((item) => ({ item, offer: offers[item.packageId] })), [items, offers]);
  const unavailableItems = lines.filter((line) => !line.offer);
  const currencies = useMemo(() => [...new Set(lines.flatMap((line) => line.offer ? [line.offer.currency] : []))], [lines]);
  const currency = currencies[0] ?? "USD";
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + (line.offer?.currency === currency ? line.offer.priceMinor : 0), 0),
    [lines, currency],
  );
  const mixedCurrency = currencies.length > 1;
  const pricesChanged = lines.some(({ item, offer }) => offer && (item.priceMinor !== offer.priceMinor || item.currency !== offer.currency));

  useEffect(() => {
    if (!state.orderNumber) return;
    clearCart();
    router.replace(`/orders/${state.orderNumber}`);
    router.refresh();
  }, [clearCart, router, state.orderNumber]);

  const cartPayload = JSON.stringify(lines.map(({ item, offer }) => ({
    packageId: item.packageId,
    expectedPriceMinor: offer?.priceMinor ?? item.priceMinor,
    expectedCurrency: offer?.currency ?? item.currency,
    inputs: item.customerInputs,
  })));

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/cart" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"><ArrowLeft className="size-4" aria-hidden="true" /> Back to cart</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7"><p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Checkout</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Review your order</h1><p className="mt-2 text-sm text-zinc-400">Confirm each player ID and package before continuing.</p></div>

        {!hydrated ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /><div className="h-56 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /></div>
        ) : items.length === 0 ? (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-16 text-center"><p className="text-sm text-zinc-400">Your cart is empty.</p><Link href="/" className="mt-4 inline-flex text-sm font-medium text-zinc-100 underline underline-offset-4">Browse catalog</Link></section>
        ) : (
          <form action={formAction} onSubmit={() => { if (idempotencyInput.current && !idempotencyInput.current.value) idempotencyInput.current.value = crypto.randomUUID(); }} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h2 className="font-semibold">Customer</h2>
                <p className="mt-2 text-sm text-zinc-400">{email ? <>Signed in as <span className="text-zinc-200">{email}</span></> : "Account sign-in will be connected later."}</p>
                <p className="mt-3 text-xs leading-5 text-zinc-500">Top-up information is attached to each cart item and will be used for fulfillment.</p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h2 className="font-semibold">Review your items <span className="font-normal text-zinc-500">({items.length})</span></h2>
                <div className="mt-4 divide-y divide-zinc-800">
                  {lines.map(({ item, offer }, index) => (
                    <article key={item.key} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">{offer?.productTitle ?? item.productTitle}</p><p className="mt-1 text-sm text-zinc-400">{offer?.packageLabel ?? item.packageLabel}{(offer?.bonusLabel ?? item.bonusLabel) ? ` · ${offer?.bonusLabel ?? item.bonusLabel}` : ""}</p></div><span className="shrink-0 text-sm font-semibold">{formatPrice(offer?.priceMinor ?? item.priceMinor, offer?.currency ?? item.currency)}</span></div>
                      {Object.entries(item.customerInputs).filter(([, value]) => value).length > 0 && (
                        <dl className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">{Object.entries(item.customerInputs).filter(([, value]) => value).map(([key, value]) => <div key={`${index}-${key}`} className="flex justify-between gap-4 text-xs"><dt className="text-zinc-500">{item.inputLabels[key] ?? key}</dt><dd className="max-w-[65%] break-all text-right text-zinc-300">{value}</dd></div>)}</dl>
                      )}
                    </article>
                  ))}
                </div>
                <Link href="/cart" className="mt-4 inline-flex text-xs text-zinc-400 underline underline-offset-4 hover:text-zinc-100">Edit cart</Link>
              </div>
            </section>

            <aside className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="font-semibold">Order summary</h2>
              <div className="mt-4 flex justify-between border-t border-zinc-800 pt-4 text-sm"><span className="text-zinc-400">Items</span><span>{items.length}</span></div>
              <div className="mt-3 flex justify-between text-sm"><span className="text-zinc-400">Subtotal</span><span>{formatPrice(subtotal, currency)}</span></div>
              <div className="mt-3 flex justify-between border-t border-zinc-800 pt-3 text-sm font-semibold"><span>Total</span><span>{mixedCurrency ? "—" : formatPrice(subtotal, currency)}</span></div>
              {pricesChanged && <p role="status" className="mt-4 rounded-lg border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs leading-5 text-amber-200">A package price changed since it was added. Review the updated total before placing your order.</p>}
              {unavailableItems.length > 0 && <p role="alert" className="mt-4 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-xs leading-5 text-red-300">One or more cart packages are no longer available. Remove them and select an active package.</p>}
              {mixedCurrency && <p role="alert" className="mt-4 rounded-lg border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">The cart contains multiple currencies. Return to your cart and place separate orders.</p>}
              {isPreview && <p role="status" className="mt-4 rounded-lg border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs leading-5 text-amber-200">{email ? "Live checkout is not enabled. Configure verified prices and payment provider credentials before accepting orders." : "Frontend preview: sample prices only. Orders and payments are paused."}</p>}
              {state.message && <p role="alert" className="mt-4 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-sm text-red-300">{state.message}</p>}
              <button type="submit" disabled={pending || isPreview || mixedCurrency || unavailableItems.length > 0} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                {pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Placing order…</> : "Place order and continue to payment"}
              </button>
              <input type="hidden" name="cart_payload" value={cartPayload} />
              <input ref={idempotencyInput} type="hidden" name="idempotency_key" defaultValue="" />
              {!isPreview && <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500"><ShieldCheck className="size-3.5" aria-hidden="true" /> Payment is handled securely by your selected provider.</p>}
              <p className="mt-2 text-center text-xs leading-5 text-zinc-600">{isPreview ? "Sample catalog for frontend design. No purchase will be made." : "Prices and availability are rechecked when the order is placed. The final order receipt shows the confirmed total."}</p>
            </aside>
          </form>
        )}
      </div>
    </main>
  );
}
