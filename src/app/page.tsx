import { Suspense } from "react";
import { CatalogGrid } from "@/components/catalog-grid";
import { getCatalog } from "@/lib/catalog";

async function CatalogSection() {
  const catalog = await getCatalog();
  const unavailableMessage = catalog.error
    ? "Catalog is temporarily unavailable. Please try again shortly."
    : !catalog.configured
      ? "Connect Supabase and apply the migrations to load active catalog data."
      : undefined;

  return (
    <CatalogGrid
      games={catalog.games}
      unavailableMessage={unavailableMessage}
    />
  );
}

function CatalogFallback() {
  return (
    <div className="min-h-screen bg-[#261f3c] px-0 py-0 md:p-5" aria-busy="true">
      <div className="mx-auto min-h-[calc(100vh-2.5rem)] max-w-[1360px] bg-[#0e0a19] px-4 sm:px-7 md:rounded-[26px] md:border-[9px] md:border-[#403455] md:px-8 lg:px-12">
        <header className="mt-5 h-[58px] animate-pulse rounded-full bg-[#1a1427]" />
        <main className="mx-auto max-w-6xl space-y-6 pb-10 pt-7">
          <div className="min-h-[215px] animate-pulse rounded-xl border border-[#30263e] bg-[#1b1428] sm:min-h-[255px]" />
          <div className="h-12 animate-pulse rounded-full bg-[#171220]" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="aspect-[16/9] animate-pulse rounded-lg border border-[#30263e] bg-[#191323]" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<CatalogFallback />}>
      <CatalogSection />
    </Suspense>
  );
}
