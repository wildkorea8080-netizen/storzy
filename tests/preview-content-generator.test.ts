import { describe, expect, it } from "vitest";
import { assertSchema } from "../src/ai/schema-registry.js";
import { PreviewProductContentGenerator } from "../src/content/preview-generator.js";

describe("preview product content generator", () => {
  it("creates schema-valid content while preserving authoritative pricing", async () => {
    const result = await new PreviewProductContentGenerator().generate({
      profile: { brand_name: "Seoul Side Studio" },
      candidate: { product_name: "프리미엄 반팔 티셔츠", product_type: "t-shirt" },
      recommendedRetailMinor: 4500,
      currency: "USD"
    });
    expect(() => assertSchema("productContent", result.data)).not.toThrow();
    expect(result.data.pricing_hint).toMatchObject({ currency: "USD", suggested_retail_minor: 4500 });
    expect(result).toMatchObject({ model: "preview-fixture", promptVersion: "preview.product-content.v1" });
  });
});
