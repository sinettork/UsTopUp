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
    <div className="min-h-screen bg-[#0a0714] px-4 py-6 sm:px-6" aria-busy="true">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-14 animate-pulse rounded-md bg-[#1d172c]" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded-md bg-[#1d172c]" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="aspect-[4/5] animate-pulse rounded-md border border-[#2e2742] bg-[#171320]" />
          ))}
        </div>
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
