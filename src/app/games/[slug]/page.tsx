import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCatalog } from "@/lib/catalog";
import { isFrontendPreview } from "@/lib/preview-mode";
import { BuyForm } from "@/components/buy-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

async function GameContent({
  params,
  searchParams,
}: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const catalog = await getCatalog();
  if (!catalog.configured || catalog.error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0714] px-4 text-center text-[#f5f2fb]">
        <div>
          <h1 className="text-xl font-semibold">Catalog unavailable</h1>
          <p className="mt-2 text-sm text-[#a79dbc]">Try again later or return to the catalog.</p>
          <Link href="/" className="mt-5 inline-flex text-sm text-[#bda5ff] underline underline-offset-4">Back to catalog</Link>
        </div>
      </main>
    );
  }

  const game = catalog.games.find((item) => item.slug === slug);
  if (!game) notFound();
  const frontendPreview = isFrontendPreview();
  const isPreview = frontendPreview || process.env.NEXT_PUBLIC_CATALOG_PREVIEW === "true";
  const artwork = game.bannerUrl ?? game.imageUrl;

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0714] text-[#f5f2fb]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6 lg:px-8">
        <Link href="/" className="mt-5 inline-flex items-center gap-1.5 text-sm text-[#a79dbc] transition-colors hover:text-[#f5f2fb]">
          <ArrowLeft className="size-4" aria-hidden="true" /> Catalog
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{game.title}</h1>
          <p className="mt-1 text-sm text-[#a79dbc]">{game.publisher} · {game.category} · {game.creditLabel}</p>
        </div>

        {artwork && (
          <div className="relative mt-5 aspect-[21/9] overflow-hidden rounded-md border border-[#2e2742] bg-[#171320] sm:aspect-[21/7]">
            <Image src={artwork} alt="" fill sizes="(max-width: 1152px) 100vw, 1152px" unoptimized className="object-cover" />
          </div>
        )}

        {isPreview && (
          <p className="mt-5 text-sm text-[#a79dbc]">
            {frontendPreview
              ? "Frontend preview: sample products and prices. Ordering and payment are paused."
              : "Preview catalog: sample product names and prices. Verify real offers before accepting orders."}
          </p>
        )}

        {query.order_error && (
          <p role="alert" className="mt-5 rounded-md border border-red-900/70 bg-red-950/40 px-3.5 py-2.5 text-sm text-red-300">{query.order_error}</p>
        )}

        <div className="mt-8">
          {game.packages.length ? (
            <BuyForm game={game} />
          ) : (
            <p className="rounded-md border border-[#2e2742] bg-[#171320] px-4 py-10 text-center text-[15px] text-[#a79dbc]">
              No active {game.category === "AI Tools" ? "plans" : "packages"} are available for this product yet.
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function GamePageFallback() {
  return (
    <main className="min-h-screen bg-[#0a0714] px-4 py-8" aria-label="Loading game details" aria-busy="true">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="h-14 animate-pulse rounded-md bg-[#1d172c]" />
        <div className="h-9 w-80 max-w-full animate-pulse rounded-md bg-[#1d172c]" />
        <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
          <div className="h-72 animate-pulse rounded-md border border-[#2e2742] bg-[#171320]" />
          <div className="h-56 animate-pulse rounded-md border border-[#2e2742] bg-[#171320]" />
        </div>
      </div>
    </main>
  );
}

export default function GamePage(props: PageProps<"/games/[slug]">) {
  return (
    <Suspense fallback={<GamePageFallback />}>
      <GameContent {...props} />
    </Suspense>
  );
}
