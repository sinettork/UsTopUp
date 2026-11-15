import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/catalog";
import { isFrontendPreview } from "@/lib/preview-mode";
import { CheckoutPage } from "@/components/checkout-page";

export const metadata: Metadata = { title: "Checkout | NexusPay" };

async function CheckoutContent() {
  const frontendPreview = isFrontendPreview();
  let email = "";
  if (!frontendPreview) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Fcheckout");
    email = user.email ?? "";
  }
  const catalog = await getCatalog();
  const offers = Object.fromEntries(catalog.games.flatMap((game) => game.packages.map((item) => [
    item.id,
    {
      productTitle: game.title,
      packageLabel: `${item.amountLabel} ${game.creditLabel}`,
      bonusLabel: item.bonusLabel,
      priceMinor: item.priceMinor,
      currency: item.currency,
    },
  ])));

  return (
    <CheckoutPage
      email={email}
      isPreview={frontendPreview || process.env.NEXT_PUBLIC_CATALOG_PREVIEW === "true"}
      offers={offers}
    />
  );
}

function CheckoutFallback() {
  return <main className="min-h-screen bg-[#0a0714] px-4 py-8 text-[#f5f2fb]" aria-busy="true"><div className="mx-auto max-w-6xl space-y-6"><div className="h-14 animate-pulse rounded-lg bg-[#1d172c]" /><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><div className="h-96 animate-pulse rounded-xl border border-[#2e2742] bg-[#171320]" /><div className="h-72 animate-pulse rounded-xl border border-[#2e2742] bg-[#171320]" /></div></div></main>;
}

export default function CheckoutRoute() {
  return <Suspense fallback={<CheckoutFallback />}><CheckoutContent /></Suspense>;
}
