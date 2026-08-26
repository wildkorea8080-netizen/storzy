export const STORE_TEMPLATE_KEYS = [
  "MINIMAL_FASHION",
  "KOREAN_STREET",
  "OUTDOOR_LIFESTYLE",
  "TOURIST_SOUVENIR",
  "CREATOR_MERCHANDISE",
] as const;

export type StoreTemplateKey = typeof STORE_TEMPLATE_KEYS[number];

export type StoreConfig = Readonly<{
  schemaVersion: "1.0.0";
  templateKey: StoreTemplateKey;
  theme: Readonly<{ primary: string; secondary: string; accent: string; background: string }>;
  navigation: readonly string[];
  pages: Readonly<Record<"home" | "shop" | "collections" | "about" | "faq" | "shipping" | "returns" | "contact", Readonly<{ title: string; body: string }>>>;
}>;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function selectTemplate(profile: Record<string, unknown>): StoreTemplateKey {
  const style = profile.brand_style as Record<string, unknown> | undefined;
  const catalog = profile.catalog_plan as Record<string, unknown> | undefined;
  const haystack = [...strings(style?.keywords), ...strings(catalog?.preferred_product_types)].join(" ").toLowerCase();
  if (/seoul|korean|street/.test(haystack)) return "KOREAN_STREET";
  if (/outdoor|hiking|camp|trail/.test(haystack)) return "OUTDOOR_LIFESTYLE";
  if (/tourist|souvenir|travel/.test(haystack)) return "TOURIST_SOUVENIR";
  if (/creator|merch|fan/.test(haystack)) return "CREATOR_MERCHANDISE";
  return "MINIMAL_FASHION";
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9A-F]{6}$/i.test(value) ? value.toUpperCase() : fallback;
}

export function buildStoreConfig(profile: Record<string, unknown>): StoreConfig {
  const brandName = typeof profile.brand_name === "string" ? profile.brand_name : "Your Brand";
  const summary = typeof profile.summary === "string" ? profile.summary : `${brandName} official store.`;
  const style = profile.brand_style as Record<string, unknown> | undefined;
  const colors = Array.isArray(style?.primary_colors) ? style.primary_colors as Record<string, unknown>[] : [];
  const primary = safeColor(colors[0]?.hex, "#181815");
  const secondary = safeColor(colors[1]?.hex, "#FFFFFF");
  const accent = safeColor(colors[2]?.hex, "#777777");
  const templateKey = selectTemplate(profile);
  return {
    schemaVersion: "1.0.0",
    templateKey,
    theme: { primary, secondary, accent, background: secondary },
    navigation: ["Home", "Shop", "Collections", "About", "FAQ", "Shipping", "Returns", "Contact"],
    pages: {
      home: { title: brandName, body: summary },
      shop: { title: "Shop", body: `Explore the complete ${brandName} collection.` },
      collections: { title: "Collections", body: `Discover products curated around the world of ${brandName}.` },
      about: { title: `About ${brandName}`, body: summary },
      faq: { title: "FAQ", body: "Find answers about products, sizing, orders, and care." },
      shipping: { title: "Shipping", body: "Shipping availability, rates, and delivery estimates are shown at checkout." },
      returns: { title: "Returns", body: "Contact us before returning an item. Made-to-order products may have limited return eligibility." },
      contact: { title: "Contact", body: `Questions about ${brandName}? Send us a message and our team will respond.` },
    },
  };
}
