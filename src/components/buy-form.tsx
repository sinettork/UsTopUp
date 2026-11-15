"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CatalogField, CatalogGame } from "@/lib/catalog";
import { savePendingOrder } from "@/lib/pending-order";

function formatPrice(amountMinor: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
  return formatter.format(amountMinor / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2));
}

export function BuyForm({ game }: { game: CatalogGame }) {
  const router = useRouter();
  const [selectedPackageId, setSelectedPackageId] = useState(game.packages[0]?.id ?? "");

  const selectedPackage = game.packages.find((item) => item.id === selectedPackageId) ?? game.packages[0];
  const accountStep = 1;
  const packageStep = game.fields.length > 0 ? 2 : 1;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPackage) return;

    const formData = new FormData(event.currentTarget);
    const customerInputs: Record<string, string> = {};
    const inputLabels: Record<string, string> = {};
    for (const field of game.fields) {
      customerInputs[field.fieldKey] = String(formData.get(`customer_${field.fieldKey}`) ?? "").trim();
      inputLabels[field.fieldKey] = field.label;
    }

    savePendingOrder({
      gameSlug: game.slug,
      productTitle: game.title,
      packageId: selectedPackage.id,
      packageLabel: `${selectedPackage.amountLabel} ${game.creditLabel}`,
      creditLabel: game.creditLabel,
      bonusLabel: selectedPackage.bonusLabel,
      priceMinor: selectedPackage.priceMinor,
      currency: selectedPackage.currency,
      customerInputs,
      inputLabels,
    });
    router.push("/checkout");
  }

  return (
    <form onSubmit={handleSubmit} className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        {game.fields.length > 0 && (
          <section aria-labelledby="step-account" className="border-b border-[#2e2742] pb-8">
            <h2 id="step-account" className="text-base font-semibold">
              {accountStep}. Enter your {game.category === "AI Tools" ? "account details" : "game ID"}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {game.fields.map((field: CatalogField) => (
                <label key={field.id} className="block text-sm font-medium">
                  {field.label}{field.isRequired ? " *" : ""}
                  <input
                    name={`customer_${field.fieldKey}`}
                    type={field.fieldType}
                    placeholder={field.placeholder ?? ""}
                    required={field.isRequired}
                    maxLength={500}
                    autoComplete="off"
                    className="mt-1.5 h-11 w-full rounded-md border border-[#393047] bg-[#100c1a] px-3 text-[15px] font-normal outline-none placeholder:text-[#8d84a3] focus:border-[#9879df]"
                  />
                  {field.helpText && <span className="mt-1.5 block text-[13px] font-normal leading-5 text-[#a79dbc]">{field.helpText}</span>}
                </label>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="step-package" className={game.fields.length > 0 ? "pt-8" : ""}>
          <h2 id="step-package" className="text-base font-semibold">
            {packageStep}. Choose a {game.category === "AI Tools" ? "plan" : "package"}
          </h2>
          <fieldset className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            <legend className="sr-only">Choose a package</legend>
            {game.packages.map((item) => {
              const selected = selectedPackageId === item.id;
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors ${selected ? "border-[#8b68e8] bg-[#251a3d]" : "border-[#393047] bg-[#171320] hover:border-[#69558d]"}`}
                >
                  <input
                    className="mt-1 size-4 shrink-0 accent-[#a78bfa]"
                    type="radio"
                    name="package_id"
                    value={item.id}
                    required
                    checked={selected}
                    onChange={() => setSelectedPackageId(item.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{item.amountLabel} {game.creditLabel}</span>
                      <span className="shrink-0 font-semibold">{formatPrice(item.priceMinor, item.currency)}</span>
                    </span>
                    {item.bonusLabel && <span className="mt-0.5 block text-[13px] text-emerald-300">{item.bonusLabel}</span>}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </section>
      </div>

      <aside className="rounded-md border border-[#2e2742] bg-[#171320] p-5 lg:sticky lg:top-20">
        <h2 className="text-sm font-semibold">Summary</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[#a79dbc]">Product</dt>
            <dd className="text-right font-medium">{game.title}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#a79dbc]">Package</dt>
            <dd className="text-right font-medium">{selectedPackage ? `${selectedPackage.amountLabel} ${game.creditLabel}` : "—"}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t border-[#2e2742] pt-3.5">
          <span className="text-sm text-[#a79dbc]">Total</span>
          <span className="text-lg font-bold">{selectedPackage ? formatPrice(selectedPackage.priceMinor, selectedPackage.currency) : "—"}</span>
        </div>

        <button
          type="submit"
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#8b68e8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#9a7bea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d4fc2] focus-visible:ring-offset-2"
        >
          Buy Now
        </button>
      </aside>
    </form>
  );
}
