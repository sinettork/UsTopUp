"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Check, ShoppingCart } from "lucide-react";
import type { CatalogField, CatalogGame } from "@/lib/catalog";
import { useCart } from "@/components/cart-provider";

function formatPrice(amountMinor: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
  return formatter.format(amountMinor / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2));
}

export function AddToCartForm({ game }: { game: CatalogGame }) {
  const { items, addItem } = useCart();
  const [selectedPackageId, setSelectedPackageId] = useState(game.packages[0]?.id ?? "");
  const [cartNotice, setCartNotice] = useState<"added" | "limit" | "">("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedPackage = game.packages.find((item) => item.id === selectedPackageId);
    if (!selectedPackage) return;

    const formData = new FormData(event.currentTarget);
    const customerInputs: Record<string, string> = {};
    const inputLabels: Record<string, string> = {};
    for (const field of game.fields) {
      customerInputs[field.fieldKey] = String(formData.get(`customer_${field.fieldKey}`) ?? "").trim();
      inputLabels[field.fieldKey] = field.label;
    }

    const didAdd = addItem({
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
    setCartNotice(didAdd ? "added" : "limit");
    window.setTimeout(() => setCartNotice(""), 3500);
    event.currentTarget.reset();
    setSelectedPackageId(game.packages[0]?.id ?? "");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-5">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Choose a plan</legend>
        {game.packages.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#383047] bg-[#15111f] p-4 transition-colors has-[:checked]:border-[#9272d8] has-[:checked]:bg-[#221a31]">
            <input
              className="mt-1 size-4 accent-[#a78bfa]"
              type="radio"
              name="package_id"
              value={item.id}
              required
              checked={selectedPackageId === item.id}
              onChange={() => setSelectedPackageId(item.id)}
            />
            <span className="flex min-w-0 flex-1 items-start justify-between gap-3">
              <span><span className="block font-medium text-[#f0ebf7]">{item.amountLabel} {game.creditLabel}</span>{item.bonusLabel && <span className="mt-1 block text-xs text-[#aaa1ba]">{item.bonusLabel}</span>}</span>
              <span className="shrink-0 text-sm font-semibold text-[#f0ebf7]">{formatPrice(item.priceMinor, item.currency)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {game.fields.length > 0 && (
        <div className="space-y-3 border-t border-[#30283d] pt-5">
          {game.fields.map((field: CatalogField) => (
            <label key={field.id} className="block text-sm font-medium text-[#d2cadf]">
              {field.label}{field.isRequired ? " *" : ""}
              <input name={`customer_${field.fieldKey}`} type={field.fieldType} placeholder={field.placeholder ?? ""} required={field.isRequired} maxLength={500} className="mt-1.5 h-10 w-full rounded-lg border border-[#393047] bg-[#120f1b] px-3 text-sm text-[#f5f2fb] outline-none placeholder:text-[#81788f] focus:border-[#9879df] focus:ring-2 focus:ring-[#49366d]" />
              {field.helpText && <span className="mt-1 block text-xs font-normal text-[#aaa1ba]">{field.helpText}</span>}
            </label>
          ))}
        </div>
      )}

      <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#8b68e8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#9a7bea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9a0f5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#171320]">
        <ShoppingCart className="size-4" aria-hidden="true" />
        Add to cart
      </button>
      {cartNotice && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-lg border border-emerald-900/70 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          <span className="inline-flex items-center gap-2"><Check className="size-4" aria-hidden="true" />{cartNotice === "added" ? `Added to cart | ${items.length} items` : "Cart limit reached (20 items). Remove an item first."}</span>
          {cartNotice === "added" && <Link href="/cart" className="shrink-0 font-medium underline underline-offset-4">View cart</Link>}
        </p>
      )}
    </form>
  );
}
