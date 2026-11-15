"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, CircleHelp, CreditCard, QrCode, Search, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart-provider";
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
    (price, item) => price === null ? item.priceMinor : Math.min(price, item.priceMinor),
    null,
  );
}

function GameMark({ game, className = "" }: { game: CatalogGame; className?: string }) {
  if (game.logoUrl) {
    const needsLightLogo = game.slug === "pubg-mobile";
    return (
      <Image
        src={game.logoUrl}
        alt=""
        fill
        sizes="(max-width: 640px) 48px, 120px"
        unoptimized
        className={`object-contain p-2 ${needsLightLogo ? "brightness-0 invert" : ""} ${className}`}
      />
    );
  }

  return (
    <span className={`flex size-full items-center justify-center bg-gradient-to-br from-[#413252] to-[#211a2d] text-lg font-semibold text-[#c0aaff] ${className}`}>
      {game.title.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()}
    </span>
  );
}

function GameArtwork({ game, compact = false }: { game: CatalogGame; compact?: boolean }) {
  const surface = game.category === "AI Tools" ? "#172532" : game.category === "PC" ? "#29202a" : "#302542";
  return (
    <div className={`relative shrink-0 overflow-hidden ${compact ? "size-12 rounded-lg" : "aspect-[16/9] w-full"}`} style={{ backgroundColor: surface }}>
      {game.imageUrl ? (
        <Image
          src={game.imageUrl}
          alt=""
          fill
          sizes={compact ? "48px" : "(max-width: 640px) 50vw, 220px"}
          unoptimized
          className="object-cover"
        />
      ) : <GameMark game={game} />}
    </div>
  );
}

export function CatalogGrid({
  games,
  unavailableMessage,
}: {
  games: CatalogGame[];
  unavailableMessage?: string;
}) {
  const { items: cartItems } = useCart();
  const [filter, setFilter] = useState("All products");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
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
        `${game.title} ${game.publisher} ${game.category} ${game.creditLabel}`
          .toLowerCase()
          .includes(query);
      return matchesCategory && matchesSearch;
    });

    return matchingGames.sort((first, second) => {
      if (sortBy === "name") return first.title.localeCompare(second.title);
      if (sortBy === "price-low") {
        return (lowestPrice(first) ?? Number.MAX_SAFE_INTEGER) -
          (lowestPrice(second) ?? Number.MAX_SAFE_INTEGER);
      }
      if (sortBy === "price-high") {
        return (lowestPrice(second) ?? -1) - (lowestPrice(first) ?? -1);
      }
      return games.indexOf(first) - games.indexOf(second);
    });
  }, [filter, games, search, sortBy]);

  const heroGames = games.filter((game) => game.bannerUrl || game.imageUrl);
  const heroGame = heroGames[activeHeroIndex] ?? games[0];
  const heroImage = heroGame?.bannerUrl ?? heroGame?.imageUrl ?? null;

  useEffect(() => {
    if (heroGames.length < 2) return;

    const timeout = window.setTimeout(() => {
      setActiveHeroIndex((index) => (index + 1) % heroGames.length);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [activeHeroIndex, heroGames.length]);

  const featuredGames = games.slice(0, 4);
  const quickLinks = games.slice(0, 12);

  return (
    <div className="min-h-screen bg-[#261f3c] px-0 py-0 text-[#f5f2fb] md:px-5 md:py-5">
      <div className="mx-auto min-h-[calc(100vh-2.5rem)] max-w-[1360px] rounded-none border-0 bg-[#0e0a19] px-4 shadow-[0_20px_70px_rgba(12,8,25,0.35)] sm:px-7 md:rounded-[26px] md:border-[9px] md:border-[#403455] md:px-8 lg:px-12">
        <header className="sticky top-0 z-30 -mx-4 border-b border-[#30263e] bg-[#0e0a19]/95 px-4 backdrop-blur sm:-mx-7 sm:px-7 md:static md:mx-0 md:mt-5 md:rounded-full md:border-0 md:bg-[#1a1427] md:px-4">
          <div className="mx-auto flex h-[58px] max-w-6xl items-center justify-between gap-3">
            <Link href="/" aria-label="NexusPay home" className="shrink-0 text-lg font-bold tracking-[-0.055em] text-white">
              Nexus<span className="text-[#b49af5]">Pay</span>
            </Link>
            <nav aria-label="Main navigation" className="hidden items-center gap-6 text-xs md:flex">
              <a href="#catalog" className="border-b border-[#9b75ee] py-1 font-medium text-white">Catalog</a>
              <Link href="/account/orders" className="text-[#c2bacc] transition-colors hover:text-white">Order status</Link>
            </nav>
            <label className="relative hidden min-w-40 max-w-64 flex-1 lg:block">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#968ba8]" aria-hidden="true" />
              <input
                aria-label="Search games and products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search games, vouchers..."
                className="h-8 w-full rounded-full border border-[#372d46] bg-[#282036] pl-9 pr-3 text-xs text-white outline-none placeholder:text-[#968ba8] focus:border-[#9879df]"
              />
            </label>
            <div className="flex items-center gap-2">
              <Link href="/cart" aria-label={`Shopping cart, ${cartItems.length} items`} className="relative inline-flex size-8 items-center justify-center rounded-full text-[#d6cfe2] transition-colors hover:bg-[#30263e]">
                <ShoppingCart className="size-4" aria-hidden="true" />
                {cartItems.length > 0 && <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#9b75ee] px-1 text-[10px] font-semibold text-white">{cartItems.length}</span>}
              </Link>
              <Link href="/login" className="inline-flex h-8 items-center rounded-full bg-[#8060d7] px-4 text-xs font-medium text-white transition-colors hover:bg-[#9678e8]">Log in</Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl pb-10 pt-6 sm:pt-7">
          <section aria-label="Featured game banner" className="relative isolate h-[210px] overflow-hidden rounded-xl border border-[#30263e] bg-[#1b1428] sm:h-[260px] lg:h-[300px]">
            {heroImage && heroGame && (
              <Link href={`/games/${heroGame.slug}`} aria-label={`View ${heroGame.title}`} className="absolute inset-0 z-0">
                <Image
                  src={heroImage}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 1100px"
                  unoptimized
                  fetchPriority="high"
                  className="object-cover object-center"
                />
              </Link>
            )}
            {heroGames.length > 1 && (
              <div aria-label="Choose banner" className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
                {heroGames.map((game, index) => (
                  <button key={game.id} type="button" aria-label={`Show ${game.title} banner`} aria-current={index === activeHeroIndex ? "true" : undefined} onClick={() => setActiveHeroIndex(index)} className={`h-1 rounded-full transition-all ${index === activeHeroIndex ? "w-6 bg-[#a887ff]" : "w-3 bg-white/35 hover:bg-white/65"}`} />
                ))}
              </div>
            )}
          </section>

          {quickLinks.length > 0 && (
            <nav aria-label="Game logos" className="overflow-hidden py-5">
              <div className="game-logo-track flex w-max">
                {[false, true].map((duplicate) => (
                  <div key={duplicate ? "duplicate" : "primary"} aria-hidden={duplicate} className="flex shrink-0 items-center gap-5 pr-5 sm:gap-7 sm:pr-7">
                    {quickLinks.map((game) => (
                      <Link key={game.id} href={`/games/${game.slug}`} aria-label={game.title} tabIndex={duplicate ? -1 : undefined} className="group relative size-9 shrink-0 overflow-hidden rounded-full border border-[#40364e] bg-[#20192c] transition-colors hover:border-[#a887ff] sm:size-10">
                        {game.logoUrl ? <GameMark game={game} /> : game.imageUrl ? <Image src={game.imageUrl} alt="" fill sizes="40px" unoptimized className="object-cover" /> : <span className="flex size-full items-center justify-center text-[10px] font-semibold text-[#c0aaff]">{game.title.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()}</span>}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </nav>
          )}

          {featuredGames.length > 0 && (
            <section className="pb-8" aria-labelledby="featured-heading">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="featured-heading" className="text-lg font-semibold tracking-tight">Featured</h2>
                <a href="#catalog" className="text-xs text-[#bda5ff] hover:text-white">View catalog</a>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {featuredGames.map((game) => {
                  const lowest = lowestPrice(game);
                  return (
                    <Link key={game.id} href={`/games/${game.slug}`} className="group overflow-hidden rounded-lg border border-[#30263e] bg-[#191323] transition-colors hover:border-[#69558d]">
                      <GameArtwork game={game} />
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <h3 className="truncate text-xs font-medium text-[#f5f2fb]">{game.title}</h3>
                          <p className="mt-0.5 truncate text-[10px] text-[#998fa8]">{game.publisher}</p>
                        </div>
                        {lowest !== null && <span className="shrink-0 text-[10px] font-medium text-[#d2bbff]">{formatPrice(lowest, game.currency)}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <section id="catalog" className="scroll-mt-20 rounded-xl border border-[#2a2137] bg-[#191324] p-4 sm:p-5" aria-labelledby="catalog-heading">
            <div className="flex flex-col gap-4 border-b border-[#30263e] pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 id="catalog-heading" className="text-lg font-semibold">Browse games and plans</h2>
                <p className="mt-1 text-xs text-[#a59bb4]">Top-ups and digital subscriptions</p>
              </div>
              <div className="flex items-center gap-2 lg:hidden">
                <label className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#968ba8]" aria-hidden="true" />
                  <input aria-label="Search games and products" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search catalog" className="h-9 w-full rounded-full border border-[#393047] bg-[#120e1a] pl-9 pr-3 text-xs text-white outline-none placeholder:text-[#82788f] focus:border-[#9879df]" />
                </label>
                <label className="flex h-9 items-center gap-1.5 rounded-full border border-[#393047] px-2.5 text-xs text-[#c6bfd2]">
                  <ArrowDownUp className="size-3" aria-hidden="true" />
                  <span className="sr-only">Sort products</span>
                  <select aria-label="Sort products" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="max-w-24 bg-transparent text-[#eeeaf5] outline-none">
                    <option value="featured">Featured</option>
                    <option value="name">Name A to Z</option>
                    <option value="price-low">Price low to high</option>
                    <option value="price-high">Price high to low</option>
                  </select>
                </label>
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                <label className="flex h-9 items-center gap-1.5 rounded-full border border-[#393047] px-2.5 text-xs text-[#c6bfd2]">
                  <ArrowDownUp className="size-3" aria-hidden="true" />
                  <span className="sr-only">Sort products</span>
                  <select aria-label="Sort products" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="bg-transparent text-[#eeeaf5] outline-none">
                    <option value="featured">Featured</option>
                    <option value="name">Name A to Z</option>
                    <option value="price-low">Price low to high</option>
                    <option value="price-high">Price high to low</option>
                  </select>
                </label>
              </div>
            </div>

            <div role="group" className="flex gap-2 overflow-x-auto py-4" aria-label="Product categories">
              {categories.map((category) => (
                <button key={category} type="button" onClick={() => setFilter(category)} aria-pressed={filter === category} className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition-colors ${filter === category ? "border-[#8c6be0] bg-[#342550] text-white" : "border-[#30263e] bg-[#130f1c] text-[#b9b0c6] hover:bg-[#251d32]"}`}>
                  {category}
                </button>
              ))}
            </div>

            <p className="sr-only" aria-live="polite">{filteredGames.length} products</p>
            {unavailableMessage ? (
              <div className="rounded-lg border border-[#30263e] bg-[#130f1c] px-6 py-12 text-center text-sm text-[#aaa1ba]">{unavailableMessage}</div>
            ) : filteredGames.length ? (
              <div className="grid grid-cols-1 gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
                {filteredGames.map((game) => {
                  const lowest = lowestPrice(game);
                  return (
                    <Link key={game.id} href={`/games/${game.slug}`} className="group flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[#241c31]">
                      <GameArtwork game={game} compact />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-[#f0ebf7] group-hover:text-white">{game.title}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-[#958ba3]">{game.publisher}</span>
                      </span>
                      {lowest !== null && <span className="shrink-0 text-[10px] text-[#c4acd9]">{formatPrice(lowest, game.currency)}</span>}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-[#30263e] bg-[#130f1c] px-6 py-12 text-center text-sm text-[#aaa1ba]">
                {games.length ? "No products match your search." : "No products are available yet."}
              </div>
            )}
          </section>
        </main>

        <footer className="mx-auto mb-4 mt-2 max-w-6xl rounded-lg border border-[#2a2137] bg-[#191324] px-3 py-2.5 text-[10px] text-[#a39aaf] sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <nav aria-label="Footer links" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <Link href="#catalog" className="transition-colors hover:text-white">Browse</Link>
              <Link href="/cart" className="transition-colors hover:text-white">Cart</Link>
              <Link href="/account/orders" className="inline-flex items-center gap-1 transition-colors hover:text-white">
                <CircleHelp className="size-3" aria-hidden="true" />
                Order status
              </Link>
              <Link href="/login" className="transition-colors hover:text-white">Sign in</Link>
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/" aria-label="NexusPay home" className="mr-1 text-sm font-bold tracking-[-0.055em] text-white">
                Nexus<span className="text-[#b49af5]">Pay</span>
              </Link>
              <span aria-label="Payment methods: Bakong KHQR and ABA PayWay" className="flex gap-1">
                <span className="inline-flex h-6 items-center gap-1 rounded bg-white px-1.5 text-[9px] font-semibold text-[#211b29]">
                  <QrCode className="size-3 text-[#7052b6]" aria-hidden="true" />
                  Bakong
                </span>
                <span className="inline-flex h-6 items-center gap-1 rounded bg-white px-1.5 text-[9px] font-semibold text-[#211b29]">
                  <CreditCard className="size-3 text-[#2563a9]" aria-hidden="true" />
                  ABA PayWay
                </span>
              </span>
              <span className="hidden text-[9px] sm:inline">© 2026</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
