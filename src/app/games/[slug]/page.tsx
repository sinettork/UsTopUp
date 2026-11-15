import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gamepad2, Info } from "lucide-react";
import { getCatalog } from "@/lib/catalog";
import { isFrontendPreview } from "@/lib/preview-mode";
import { AddToCartForm } from "@/components/add-to-cart-form";

async function GameContent({
  params,
  searchParams,
}: PageProps<"/games/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const catalog = await getCatalog();
  if (!catalog.configured || catalog.error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#100d18] px-4 text-center text-[#f5f2fb]">
        <div>
          <h1 className="text-xl font-semibold">Game catalog unavailable</h1>
          <p className="mt-2 text-sm text-[#aaa1ba]">Try again later or return to the catalog.</p>
          <Link href="/" className="mt-5 inline-flex text-sm text-[#c0aaff] underline underline-offset-4">Back to catalog</Link>
        </div>
      </main>
    );
  }

  const game = catalog.games.find((item) => item.slug === slug);
  if (!game) notFound();
  const frontendPreview = isFrontendPreview();
  const isPreview = frontendPreview || process.env.NEXT_PUBLIC_CATALOG_PREVIEW === "true";

  return (
    <main className="min-h-screen bg-[#100d18] text-[#f5f2fb]">
      <header className="border-b border-[#2b2438] bg-[#15111f]">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#aaa1ba] transition-colors hover:text-white">
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to catalog
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-8">
        <section className="overflow-hidden rounded-xl border border-[#30283d] bg-[#171320]">
          <div className="relative aspect-[16/9] bg-[#211a2d]">
            {game.imageUrl ? (
              <Image src={game.imageUrl} alt="" fill sizes="(max-width: 1024px) 100vw, 40vw" unoptimized className="object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-[#8f7abd]"><Gamepad2 className="size-12" aria-hidden="true" /></div>
            )}
          </div>
          <div className="p-5 sm:p-6">
            <div className="text-xs text-[#b49af5]">{game.category}</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{game.title}</h1>
            <p className="mt-1 text-sm text-[#aaa1ba]">{game.publisher}</p>
            <div className="mt-5 flex items-start gap-2 border-t border-[#30283d] pt-4 text-xs leading-5 text-[#aaa1ba]">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {frontendPreview ? "Frontend preview: sample products and prices. Ordering and payment are paused." : isPreview ? "Preview catalog: sample product names and prices. Verify real offers before accepting orders." : "Checkout validates this information and locks the shown price. Payment and delivery are tracked separately."}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#30283d] bg-[#171320] p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Available {game.category === "AI Tools" ? "plans" : "packages"}</h2>
          <p className="mt-1 text-sm text-[#aaa1ba]">Choose a plan and enter the requested details.</p>
          {query.order_error && <p role="alert" className="mt-4 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-300">{query.order_error}</p>}
          {game.packages.length ? (
            <AddToCartForm game={game} />
          ) : (
            <div className="mt-5 rounded-lg border border-[#30283d] bg-[#120f1b] px-4 py-8 text-center text-sm text-[#aaa1ba]">
              No active {game.category === "AI Tools" ? "plans" : "packages"} are available for this product.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
function GamePageFallback() {
  return (
    <main className="min-h-screen bg-[#100d18] px-4 py-8 text-[#f5f2fb]" aria-label="Loading game details" aria-busy="true">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
        <div className="aspect-[16/9] animate-pulse rounded-xl border border-[#30283d] bg-[#171320]" />
        <div className="min-h-80 animate-pulse rounded-xl border border-[#30283d] bg-[#171320]" />
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
