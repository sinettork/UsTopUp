"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import type { CatalogGame } from "@/lib/catalog";

function formatPrice(amountMinor: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });
  return formatter.format(
    amountMinor / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2),
  );
}

function lowestPrice(game: CatalogGame) {
  return game.packages.reduce<number | null>(
    (price, item) => (price === null ? item.priceMinor : Math.min(price, item.priceMinor)),
    null,
  );
}

function GameArtwork({ game }: { game: CatalogGame }) {
  if (game.imageUrl) {
    return (
      <Image src={game.imageUrl} alt="" fill sizes="(max-width: 640px) 50vw, 260px" unoptimized className="object-cover" />
    );
  }
  if (game.logoUrl) {
    return (
      <Image
        src={game.logoUrl}
        alt=""
        fill
        sizes="(max-width: 640px) 50vw, 260px"
        unoptimized
        className={`object-contain p-6 ${game.slug === "pubg-mobile" ? "brightness-0 invert" : ""}`}
      />
    );
  }
  return (
    <span className="flex size-full items-center justify-center bg-[#241739] text-xl font-bold text-[#bda5ff]">
      {game.title.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()}
    </span>
  );
}

export function CatalogGrid({
  games,
  unavailableMessage,
}: {
  games: CatalogGame[];
  unavailableMessage?: string;
}) {
  const [filter, setFilter] = useState("All products");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("featured");

  const categories = useMemo(
    () => ["All products", ...new Set(games.map((game) => game.category))],
    [games],
  );

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchingGames = games.filter((game) => {
      const matchesCategory = filter === "All products" || game.category === filter;
      const matchesSearch =
        !query ||
        `${game.title} ${game.publisher} ${game.category} ${game.creditLabel}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
    return matchingGames.sort((first, second) => {
      if (sortBy === "name") return first.title.localeCompare(second.title);
      if (sortBy === "price-low") return (lowestPrice(first) ?? Number.MAX_SAFE_INTEGER) - (lowestPrice(second) ?? Number.MAX_SAFE_INTEGER);
      if (sortBy === "price-high") return (lowestPrice(second) ?? -1) - (lowestPrice(first) ?? -1);
      return games.indexOf(first) - games.indexOf(second);
    });
  }, [filter, games, search, sortBy]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0714] text-[#f5f2fb]">
      <SiteHeader searchValue={search} onSearchChange={setSearch} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl pt-10">
          <h1 className="text-3xl font-bold tracking-tight">Game top-ups &amp; subscriptions</h1>
          <p className="mt-2 text-[15px] leading-6 text-[#a79dbc]">
            Choose a product, enter your account ID on the next page, then pay at checkout.
          </p>
          <label className="relative mt-5 block md:hidden">
            <Search className="absolute left-3 top-1/2 size-4.5 -translate-y-1/2 text-[#8d84a3]" aria-hidden="true" />
            <input
              aria-label="Search games and products"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search games and products"
              className="h-11 w-full rounded-md border border-[#393047] bg-[#171320] pl-10 pr-3 text-[15px] outline-none placeholder:text-[#8d84a3] focus:border-[#9879df]"
            />
          </label>
        </div>

        <section id="catalog" className="scroll-mt-20 pt-8" aria-label="Catalog">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" className="flex gap-1.5 overflow-x-auto" aria-label="Product categories">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilter(category)}
                  aria-pressed={filter === category}
                  className={`shrink-0 rounded-md border px-3 py-1.5 text-sm transition-colors ${filter === category ? "border-[#8b68e8] bg-[#8b68e8] font-medium text-white" : "border-[#393047] bg-[#171320] text-[#d8d2e6] hover:border-[#69558d]"}`}
                >
                  {category}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-[#a79dbc]">
              Sort
              <select
                aria-label="Sort products"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-9 rounded-md border border-[#393047] bg-[#171320] px-2 text-sm text-[#f5f2fb] outline-none focus:border-[#9879df]"
              >
                <option value="featured">Featured</option>
                <option value="name">Name A to Z</option>
                <option value="price-low">Price low to high</option>
                <option value="price-high">Price high to low</option>
              </select>
            </label>
          </div>

          <p className="mt-4 text-sm text-[#8d84a3]" aria-live="polite">
            {unavailableMessage ? "" : `${filteredGames.length} product${filteredGames.length === 1 ? "" : "s"}`}
          </p>

          {unavailableMessage ? (
            <div className="mt-2 rounded-md border border-[#2e2742] bg-[#171320] px-5 py-12 text-center text-[15px] text-[#a79dbc]">{unavailableMessage}</div>
          ) : filteredGames.length ? (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {filteredGames.map((game) => {
                const lowest = lowestPrice(game);
                return (
                  <li key={game.id}>
                    <Link
                      href={`/games/${game.slug}`}
                      className="group block overflow-hidden rounded-md border border-[#2e2742] bg-[#171320] transition-colors hover:border-[#69558d]"
                    >
                      <span className="relative block aspect-[16/10] w-full overflow-hidden bg-[#241739]">
                        <GameArtwork game={game} />
                      </span>
                      <span className="block p-3.5">
                        <span className="block truncate text-sm font-semibold group-hover:underline">{game.title}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-[#a79dbc]">{game.publisher} · {game.creditLabel}</span>
                        {lowest !== null && (
                          <span className="mt-2 block text-sm text-[#a79dbc]">
                            From <span className="font-semibold text-[#f5f2fb]">{formatPrice(lowest, game.currency)}</span>
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-2 rounded-md border border-[#2e2742] bg-[#171320] px-5 py-12 text-center">
              <p className="text-[15px] text-[#d8d2e6]">
                {games.length ? `No products match "${search}".` : "No products are available yet."}
              </p>
              {games.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setFilter("All products"); }}
                  className="mt-3 text-sm font-medium text-[#bda5ff] underline underline-offset-4"
                >
                  Clear search and filters
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
