"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import { createOrder, type CheckoutActionState } from "@/app/checkout/actions";
import { clearPendingOrder, usePendingOrder } from "@/lib/pending-order";
import { CheckoutSteps } from "@/components/checkout-steps";

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
  const { order, hydrated } = usePendingOrder();
  const idempotencyInput = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(createOrder, initialState);

  useEffect(() => {
    if (!state.orderNumber) return;
    clearPendingOrder();
    router.replace(`/orders/${state.orderNumber}`);
    router.refresh();
  }, [router, state.orderNumber]);

  const offer = order ? offers[order.packageId] : undefined;
  const priceChanged = !!order && !!offer && (order.priceMinor !== offer.priceMinor || order.currency !== offer.currency);
  const orderPayload = order ? JSON.stringify({
    packageId: order.packageId,
    expectedPriceMinor: offer?.priceMinor ?? order.priceMinor,
    expectedCurrency: offer?.currency ?? order.currency,
    inputs: order.customerInputs,
  }) : "";

  return (
    <main className="min-h-screen bg-[#0a0714] text-[#f5f2fb]">
      <header className="border-b border-[#2e2742]">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
          {order ? (
            <Link href={`/games/${order.gameSlug}`} className="inline-flex items-center gap-2 text-sm text-[#a79dbc] transition-colors hover:text-[#f5f2fb]"><ArrowLeft className="size-4" aria-hidden="true" /> Back to {order.productTitle}</Link>
          ) : (
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#a79dbc] transition-colors hover:text-[#f5f2fb]"><ArrowLeft className="size-4" aria-hidden="true" /> Back to catalog</Link>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <CheckoutSteps current={2} />
        <div className="mb-7"><p className="text-xs font-medium uppercase tracking-wider text-[#a79dbc]">Checkout</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Review your order</h1><p className="mt-2 text-sm text-[#a79dbc]">Confirm your player ID and package before continuing.</p></div>

        {!hydrated ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><div className="h-64 animate-pulse rounded-xl border border-[#2e2742] bg-[#171320]" /><div className="h-56 animate-pulse rounded-xl border border-[#2e2742] bg-[#171320]" /></div>
        ) : !order ? (
          <section className="rounded-xl border border-[#2e2742] bg-[#171320] px-6 py-16 text-center"><p className="text-sm text-[#a79dbc]">No purchase in progress. Choose a product to top up first.</p><Link href="/" className="mt-4 inline-flex text-sm font-medium text-[#f5f2fb] underline underline-offset-4">Browse catalog</Link></section>
        ) : (
          <form action={formAction} onSubmit={() => { if (idempotencyInput.current && !idempotencyInput.current.value) idempotencyInput.current.value = crypto.randomUUID(); }} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-4">
              <div className="rounded-xl border border-[#2e2742] bg-[#171320] p-5">
                <h2 className="font-semibold">Customer</h2>
                <p className="mt-2 text-sm text-[#a79dbc]">{email ? <>Signed in as <span className="text-[#d8d2e6]">{email}</span></> : "Account sign-in will be connected later."}</p>
                <p className="mt-3 text-xs leading-5 text-[#a79dbc]">The top-up details below will be used for fulfillment.</p>
              </div>

              <div className="rounded-xl border border-[#2e2742] bg-[#171320] p-5">
                <h2 className="font-semibold">Your purchase</h2>
                <article className="mt-4">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">{offer?.productTitle ?? order.productTitle}</p><p className="mt-1 text-sm text-[#a79dbc]">{offer?.packageLabel ?? order.packageLabel}{(offer?.bonusLabel ?? order.bonusLabel) ? ` · ${offer?.bonusLabel ?? order.bonusLabel}` : ""}</p></div><span className="shrink-0 text-sm font-semibold">{formatPrice(offer?.priceMinor ?? order.priceMinor, offer?.currency ?? order.currency)}</span></div>
                  {Object.entries(order.customerInputs).filter(([, value]) => value).length > 0 && (
                    <dl className="mt-3 space-y-1.5 border-t border-[#2e2742] pt-3">{Object.entries(order.customerInputs).filter(([, value]) => value).map(([key, value]) => <div key={key} className="flex justify-between gap-4 text-xs"><dt className="text-[#a79dbc]">{order.inputLabels[key] ?? key}</dt><dd className="max-w-[65%] break-all text-right text-[#d8d2e6]">{value}</dd></div>)}</dl>
                  )}
                </article>
                <Link href={`/games/${order.gameSlug}`} className="mt-4 inline-flex text-xs text-[#a79dbc] underline underline-offset-4 hover:text-[#f5f2fb]">Change package or ID</Link>
              </div>
            </section>

            <aside className="rounded-xl border border-[#2e2742] bg-[#171320] p-5">
              <h2 className="font-semibold">Order summary</h2>
              <div className="mt-4 flex justify-between border-t border-[#2e2742] pt-4 text-sm"><span className="text-[#a79dbc]">Package</span><span className="text-right">{offer?.packageLabel ?? order.packageLabel}</span></div>
              <div className="mt-3 flex justify-between border-t border-[#2e2742] pt-3 text-sm font-semibold"><span>Total</span><span>{formatPrice(offer?.priceMinor ?? order.priceMinor, offer?.currency ?? order.currency)}</span></div>
              {priceChanged && <p role="status" className="mt-4 rounded-lg border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs leading-5 text-amber-200">The package price changed since you selected it. Review the updated total before placing your order.</p>}
              {!offer && <p role="alert" className="mt-4 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-xs leading-5 text-red-300">This package is no longer available. Return to the product page and select an active package.</p>}
              {isPreview && <p role="status" className="mt-4 rounded-lg border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-xs leading-5 text-amber-200">{email ? "Live checkout is not enabled. Configure verified prices and payment provider credentials before accepting orders." : "Frontend preview: sample prices only. Orders and payments are paused."}</p>}
              {state.message && <p role="alert" className="mt-4 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-300">{state.message}</p>}
              <button type="submit" disabled={pending || isPreview || !offer} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#8b68e8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#9a7bea] disabled:cursor-not-allowed disabled:opacity-50">
                {pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Placing order…</> : "Place order and continue to payment"}
              </button>
              <input type="hidden" name="order_payload" value={orderPayload} />
              <input ref={idempotencyInput} type="hidden" name="idempotency_key" defaultValue="" />
              {!isPreview && <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-[#a79dbc]"><ShieldCheck className="size-3.5" aria-hidden="true" /> Payment is handled securely by your selected provider.</p>}
              <p className="mt-2 text-center text-xs leading-5 text-[#8d84a3]">{isPreview ? "Sample catalog for frontend design. No purchase will be made." : "Prices and availability are rechecked when the order is placed. The final order receipt shows the confirmed total."}</p>
            </aside>
          </form>
        )}
      </div>
    </main>
  );
}
