import { createClient } from "@/lib/supabase/server";
import { previewCatalog } from "@/lib/catalog-preview";
import { isFrontendPreview } from "@/lib/preview-mode";

export type CatalogPackage = {
  id: string;
  amountLabel: string;
  bonusLabel: string | null;
  priceMinor: number;
  currency: string;
};

export type CatalogField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: "text" | "email" | "number";
  placeholder: string | null;
  helpText: string | null;
  isRequired: boolean;
};

export type CatalogGame = {
  id: string;
  slug: string;
  title: string;
  publisher: string;
  category: string;
  creditLabel: string;
  currency: string;
  imageUrl: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  packages: CatalogPackage[];
  fields: CatalogField[];
};

export type CatalogResult = {
  configured: boolean;
  games: CatalogGame[];
  error: boolean;
};

export async function getCatalog(): Promise<CatalogResult> {
  if (isFrontendPreview()) {
    return { configured: true, games: previewCatalog, error: false };
  }

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!configured) return { configured: false, games: [], error: false };

  try {
    const supabase = await createClient();
    const [gamesResult, packagesResult, fieldsResult] = await Promise.all([
      supabase
        .from("games")
        .select(
          "id, slug, title, publisher, category, credit_label, currency, image_url",
        )
        .eq("is_active", true)
        .order("sort_order")
        .order("title"),
      supabase
        .from("game_packages")
        .select("id, game_id, amount_label, bonus_label, price_minor, currency")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("game_fields")
        .select(
          "id, game_id, field_key, label, field_type, placeholder, help_text, is_required",
        )
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (gamesResult.error || packagesResult.error || fieldsResult.error) {
      return { configured: true, games: [], error: true };
    }

    const packagesByGame = new Map<string, CatalogPackage[]>();
    for (const item of packagesResult.data) {
      const items = packagesByGame.get(item.game_id) ?? [];
      items.push({
        id: item.id,
        amountLabel: item.amount_label,
        bonusLabel: item.bonus_label,
        priceMinor: Number(item.price_minor),
        currency: item.currency.trim(),
      });
      packagesByGame.set(item.game_id, items);
    }

    const fieldsByGame = new Map<string, CatalogField[]>();
    for (const item of fieldsResult.data) {
      const items = fieldsByGame.get(item.game_id) ?? [];
      items.push({
        id: item.id,
        fieldKey: item.field_key,
        label: item.label,
        fieldType: item.field_type,
        placeholder: item.placeholder,
        helpText: item.help_text,
        isRequired: item.is_required,
      });
      fieldsByGame.set(item.game_id, items);
    }

    const games = gamesResult.data.map((game) => ({
      id: game.id,
      slug: game.slug,
      title: game.title,
      publisher: game.publisher,
      category: game.category,
      creditLabel: game.credit_label,
      currency: game.currency.trim(),
      imageUrl: game.image_url,
      packages: packagesByGame.get(game.id) ?? [],
      fields: fieldsByGame.get(game.id) ?? [],
    }));

    return { configured: true, games, error: false };
  } catch {
    return { configured: true, games: [], error: true };
  }
}
