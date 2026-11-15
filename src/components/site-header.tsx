"use client";

import Link from "next/link";
import { Search, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart-provider";

export function SiteHeader({
  searchValue,
  onSearchChange,
}: {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}) {
  const { items } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-[#2e2742] bg-[#171320]">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="NexusPay home" className="shrink-0 text-lg font-bold tracking-tight text-[#f5f2fb]">
          Nexus<span className="text-[#bda5ff]">Pay</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-5 text-sm sm:flex">
          <Link href="/#catalog" className="font-medium text-[#f5f2fb]">Catalog</Link>
          <Link href="/account/orders" className="text-[#a79dbc] transition-colors hover:text-[#f5f2fb]">Order status</Link>
        </nav>

        {onSearchChange !== undefined && (
          <label className="relative ml-auto hidden min-w-44 max-w-xs flex-1 md:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8d84a3]" aria-hidden="true" />
            <input
              aria-label="Search games and products"
              value={searchValue ?? ""}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search games and products"
              className="h-9 w-full rounded-md border border-[#393047] bg-[#100c1a] pl-9 pr-3 text-sm text-[#f5f2fb] outline-none placeholder:text-[#8d84a3] focus:border-[#9879df]"
            />
          </label>
        )}

        <div className={`flex items-center gap-1 ${onSearchChange === undefined ? "ml-auto" : ""}`}>
          <Link
            href="/cart"
            aria-label={`Shopping cart, ${items.length} items`}
            className="relative inline-flex size-9 items-center justify-center rounded-md text-[#d8d2e6] transition-colors hover:bg-[#241c33]"
          >
            <ShoppingCart className="size-5" aria-hidden="true" />
            {items.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#8b68e8] px-1 text-[10px] font-bold text-white">
                {items.length}
              </span>
            )}
          </Link>
          <Link
            href="/login"
            className="ml-1 inline-flex h-9 items-center rounded-md bg-[#8b68e8] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#9a7bea]"
          >
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}
