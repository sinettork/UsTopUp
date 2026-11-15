import type { CatalogField, CatalogGame, CatalogPackage } from "@/lib/catalog";

type PreviewPackage = {
  amount: string;
  price: number;
  bonus?: string;
};

type PreviewField = {
  key: string;
  label: string;
  placeholder: string;
  helpText: string;
};

type PreviewProduct = {
  slug: string;
  title: string;
  publisher: string;
  category: string;
  creditLabel: string;
  imageUrl?: string;
  logoUrl?: string;
  bannerUrl?: string;
  packages: PreviewPackage[];
  fields?: PreviewField[];
};

function fixtureId(group: number, index: number) {
  return `${group.toString(16).padStart(8, "0")}-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

const products: PreviewProduct[] = [
  {
    slug: "mobile-legends",
    title: "Mobile Legends: Bang Bang",
    publisher: "Moonton",
    category: "Mobile",
    creditLabel: "Diamonds",
    logoUrl: "/catalog/assets/mobile-legends-site.png",
    packages: [
      { amount: "78", price: 150, bonus: "+8 bonus" },
      { amount: "156", price: 300, bonus: "+16 bonus" },
      { amount: "774", price: 1500, bonus: "+80 bonus" },
    ],
    fields: [
      { key: "player_id", label: "Player ID", placeholder: "Enter Player ID", helpText: "Find your ID in your in-game profile." },
      { key: "server_id", label: "Zone ID", placeholder: "Enter Zone ID", helpText: "Enter the zone shown beside your Player ID." },
    ],
  },
  {
    slug: "free-fire",
    title: "Free Fire",
    publisher: "Garena",
    category: "Mobile",
    creditLabel: "Diamonds",
    imageUrl: "/catalog/assets/free-fire-gameplay.jpg",
    logoUrl: "/catalog/assets/free-fire-logo.png",
    bannerUrl: "/catalog/assets/free-fire-banner.jpg",
    packages: [
      { amount: "100", price: 99 },
      { amount: "310", price: 299, bonus: "+31 bonus" },
      { amount: "1,060", price: 999, bonus: "+106 bonus" },
    ],
    fields: [{ key: "player_id", label: "Player ID", placeholder: "Enter Player ID", helpText: "Find your ID in your game profile." }],
  },
  {
    slug: "pubg-mobile",
    title: "PUBG Mobile",
    publisher: "Level Infinite",
    category: "Mobile",
    creditLabel: "UC",
    logoUrl: "/catalog/assets/pubg-mobile-logo.png",
    packages: [
      { amount: "60", price: 99 },
      { amount: "325", price: 499, bonus: "+25 bonus" },
      { amount: "660", price: 999, bonus: "+60 bonus" },
    ],
    fields: [{ key: "player_id", label: "Player ID", placeholder: "Enter Player ID", helpText: "Find your ID in your game profile." }],
  },
  {
    slug: "call-of-duty-mobile",
    title: "Call of Duty: Mobile",
    publisher: "Activision",
    category: "Mobile",
    creditLabel: "CP",
    imageUrl: "/catalog/assets/cod-mobile-banner.webp",
    logoUrl: "/catalog/assets/cod-mobile-logo-light.webp",
    bannerUrl: "/catalog/assets/cod-mobile-banner.webp",
    packages: [
      { amount: "80", price: 99 },
      { amount: "420", price: 499, bonus: "+20 bonus" },
      { amount: "880", price: 999, bonus: "+80 bonus" },
    ],
    fields: [{ key: "player_id", label: "OpenID", placeholder: "Enter OpenID", helpText: "Copy your OpenID from your in-game profile." }],
  },
  {
    slug: "honor-of-kings",
    title: "Honor of Kings",
    publisher: "Level Infinite",
    category: "Mobile",
    creditLabel: "Tokens",
    packages: [
      { amount: "80", price: 99 },
      { amount: "400", price: 499 },
      { amount: "800", price: 999, bonus: "+40 bonus" },
    ],
    fields: [{ key: "player_id", label: "Player ID", placeholder: "Enter Player ID", helpText: "Find your ID in your game profile." }],
  },
  {
    slug: "genshin-impact",
    title: "Genshin Impact",
    publisher: "HoYoverse",
    category: "Mobile",
    creditLabel: "Genesis Crystals",
    imageUrl: "/catalog/assets/genshin-impact-cover.jpg",
    logoUrl: "/catalog/assets/genshin-impact.png",
    packages: [
      { amount: "60", price: 99 },
      { amount: "300", price: 499, bonus: "+30 bonus" },
      { amount: "980", price: 1499, bonus: "+110 bonus" },
    ],
    fields: [{ key: "uid", label: "UID", placeholder: "Enter your UID", helpText: "Choose the server that matches your account." }],
  },
  {
    slug: "valorant",
    title: "VALORANT",
    publisher: "Riot Games",
    category: "PC",
    creditLabel: "VP",
    packages: [
      { amount: "475", price: 499 },
      { amount: "1,000", price: 999, bonus: "+50 bonus" },
      { amount: "2,050", price: 1999, bonus: "+150 bonus" },
    ],
    fields: [{ key: "riot_id", label: "Riot ID", placeholder: "Name#Tag", helpText: "Enter your Riot ID and tagline." }],
  },
  {
    slug: "league-of-legends-wild-rift",
    title: "League of Legends: Wild Rift",
    publisher: "Riot Games",
    category: "Mobile",
    creditLabel: "Wild Cores",
    packages: [
      { amount: "425", price: 499 },
      { amount: "1,000", price: 999 },
      { amount: "2,150", price: 1999, bonus: "+150 bonus" },
    ],
    fields: [{ key: "riot_id", label: "Riot ID", placeholder: "Name#Tag", helpText: "Enter your Riot ID and tagline." }],
  },
  {
    slug: "honkai-star-rail",
    title: "Honkai: Star Rail",
    publisher: "HoYoverse",
    category: "Mobile",
    creditLabel: "Oneiric Shards",
    imageUrl: "/catalog/assets/honkai-star-rail-banner.webp",
    bannerUrl: "/catalog/assets/honkai-star-rail-banner.webp",
    packages: [
      { amount: "60", price: 99 },
      { amount: "300", price: 499, bonus: "+30 bonus" },
      { amount: "980", price: 1499, bonus: "+110 bonus" },
    ],
    fields: [{ key: "uid", label: "UID", placeholder: "Enter your UID", helpText: "Choose the server that matches your account." }],
  },
  {
    slug: "league-of-legends",
    title: "League of Legends",
    publisher: "Riot Games",
    category: "PC",
    creditLabel: "RP",
    packages: [
      { amount: "575", price: 499 },
      { amount: "1,270", price: 999 },
      { amount: "2,575", price: 1999 },
    ],
    fields: [{ key: "riot_id", label: "Riot ID", placeholder: "Name#Tag", helpText: "Enter your Riot ID and tagline." }],
  },
  {
    slug: "chatgpt-plus",
    title: "ChatGPT Plus",
    publisher: "OpenAI",
    category: "AI Tools",
    creditLabel: "month",
    packages: [{ amount: "1", price: 2000 }, { amount: "3", price: 6000 }],
    fields: [{ key: "account_email", label: "Account email", placeholder: "name@example.com", helpText: "Use the email associated with your account." }],
  },
  {
    slug: "gemini-advanced",
    title: "Google AI Pro",
    publisher: "Google",
    category: "AI Tools",
    creditLabel: "month",
    packages: [{ amount: "1", price: 1999 }, { amount: "3", price: 5997 }],
    fields: [{ key: "account_email", label: "Account email", placeholder: "name@example.com", helpText: "Use the email associated with your account." }],
  },
];

export const previewCatalog: CatalogGame[] = products.map((product, productIndex) => ({
  id: fixtureId(0x10000000, productIndex + 1),
  slug: product.slug,
  title: product.title,
  publisher: product.publisher,
  category: product.category,
  creditLabel: product.creditLabel,
  currency: "USD",
  imageUrl: product.imageUrl ?? null,
  logoUrl: product.logoUrl ?? null,
  bannerUrl: product.bannerUrl ?? null,
  packages: product.packages.map((item, packageIndex): CatalogPackage => ({
    id: fixtureId(0x20000000 + productIndex, packageIndex + 1),
    amountLabel: item.amount,
    bonusLabel: item.bonus ?? null,
    priceMinor: item.price,
    currency: "USD",
  })),
  fields: (product.fields ?? []).map((field, fieldIndex): CatalogField => ({
    id: fixtureId(0x30000000 + productIndex, fieldIndex + 1),
    fieldKey: field.key,
    label: field.label,
    fieldType: field.key === "account_email" ? "email" : "text",
    placeholder: field.placeholder,
    helpText: field.helpText,
    isRequired: true,
  })),
}));
