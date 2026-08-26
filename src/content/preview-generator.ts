import type { ContentContext, ContentGeneration, ProductContentGenerator } from "./types.js";

const text = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim() : fallback;

export class PreviewProductContentGenerator implements ProductContentGenerator {
  async generate(context: ContentContext): Promise<ContentGeneration> {
    const brand = text(context.profile.brand_name, "STORZY");
    const productName = text(context.candidate.product_name, "Essential Product");
    const productType = text(context.candidate.product_type, "product");
    const title = `${brand.toUpperCase()} ${productType.toUpperCase()}`.slice(0, 160);
    return {
      promptVersion: "preview.product-content.v1",
      model: "preview-fixture",
      data: {
        schema_version: "1.0.0",
        title_en: title,
        admin_title_ko: `${brand} ${productName}`.slice(0, 160),
        collection: "SEOUL DAILY OBJECTS",
        description: `${productName} brings ${brand}'s restrained Seoul-inspired visual language to an everyday ${productType}.`,
        key_features: ["Designed for everyday use", "Selected from the approved product catalog"],
        materials_and_size: {
          materials_copy: "Material details follow the approved supplier catalog specification.",
          size_copy: "Choose an available variant and refer to its supplier size guide.",
          care_copy: "Follow the care instructions supplied with the finished product."
        },
        seo: {
          title: `${brand} ${productName}`.slice(0, 70),
          description: `Discover ${productName}, a Seoul-inspired everyday piece by ${brand}.`.slice(0, 180)
        },
        tags: ["seoul", "korean design", productType.toLowerCase()],
        social_copy: [{ channel: "instagram", locale: "en-US", text: `Seoul, made wearable. Meet the ${productName} by ${brand}.` }],
        pricing_hint: {
          currency: context.currency,
          suggested_retail_minor: context.recommendedRetailMinor,
          rationale: "Uses the authoritative retail price calculated by the product scoring engine."
        },
        warnings: ["Preview fixture content must be reviewed before production publication."]
      }
    };
  }
}
