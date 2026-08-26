import { describe, expect, it, vi } from "vitest";
import { decimalPriceToMinor, PrintfulCatalogProvider, parsePrintfulCatalogSeeds } from "../src/candidates/printful-catalog-provider.js";
import type { PrintfulClient } from "../src/integrations/printful.js";

describe("Printful catalog provider", () => {
  it("normalizes variants and uses the highest live variant cost", async () => {
    const request = vi.fn(async (path: string) => {
      if (path.endsWith("shipping-countries")) return { data: [{ code: "US" }, { code: "JP" }] };
      if (path.includes("catalog-variants")) return { data: [
        { id: 1, size: "S", color: "Black" }, { id: 2, size: "M", color: "White" },
      ], paging: { total: 2, offset: 0, limit: 100 } };
      if (path.includes("mockup-styles")) return { data: [{ placement: "front", technique: "dtg", print_area_width: 12, print_area_height: 16, dpi: 150, mockup_styles: [{ id: 10 }, { id: 11 }] }] };
      if (path.includes("/prices?")) return { data: { currency: "USD", variants: [
        { id: 1, techniques: [{ technique_key: "dtg", discounted_price: "12.50" }] },
        { id: 2, techniques: [{ technique_key: "dtg", discounted_price: "14.25" }] },
      ] }, paging: { total: 2, offset: 0, limit: 100 } };
      return { data: { name: "Staple Tee", placements: [{ id: "front" }] } };
    });
    const client = { request } as unknown as PrintfulClient;
    const provider = new PrintfulCatalogProvider(client, [{
      productId: "71", productType: "t-shirt", baseCostMinor: 1_500, shippingReserveMinor: 500, returnRisk: "MEDIUM", technique: "dtg",
    }]);
    const result = await provider.fetchSnapshot("USD");
    expect(result.products[0]).toMatchObject({
      externalProductId: "71", name: "Staple Tee", shippingCountries: ["US", "JP"], placements: ["front"],
      sizes: ["S", "M"], colors: ["Black", "White"], baseCostMinor: 1_425,
      costSource: "PRINTFUL_LIVE", selectedTechnique: "dtg", variantCount: 2,
      placementGuidelines: [{ placement: "front", technique: "dtg", printAreaWidthIn: 12, printAreaHeightIn: 16, targetDpi: 150, allowedMockupStyleIds: [10, 11] }],
    });
    expect(request).toHaveBeenCalledTimes(5);
  });

  it("uses the approved seed only when the price endpoint returns HTTP failure", async () => {
    const request = vi.fn(async (path: string) => {
      if (path.endsWith("shipping-countries")) return { data: [{ code: "US" }] };
      if (path.includes("catalog-variants")) return { data: [{ id: 1, size: "S", color: "Black" }] };
      if (path.includes("mockup-styles")) return { data: [] };
      if (path.includes("/prices?")) throw Object.assign(new Error("unavailable"), { status: 503 });
      return { data: { name: "Tee", placements: [{ id: "front" }] } };
    });
    const provider = new PrintfulCatalogProvider({ request } as unknown as PrintfulClient, [{
      productId: "71", productType: "t-shirt", baseCostMinor: 1_500, shippingReserveMinor: 500, returnRisk: "LOW", technique: "dtg",
    }]);
    expect((await provider.fetchSnapshot("USD")).products[0]).toMatchObject({
      baseCostMinor: 1_500, costSource: "APPROVED_FALLBACK", costFallbackReason: "PRINTFUL_HTTP_503",
    });
  });

  it("rejects malformed live price data instead of silently falling back", async () => {
    const request = vi.fn(async (path: string) => {
      if (path.endsWith("shipping-countries")) return { data: [{ code: "US" }] };
      if (path.includes("catalog-variants")) return { data: [{ id: 1, size: "S", color: "Black" }] };
      if (path.includes("mockup-styles")) return { data: [] };
      if (path.includes("/prices?")) return { data: { currency: "EUR", variants: [] } };
      return { data: { name: "Tee", placements: [{ id: "front" }] } };
    });
    const provider = new PrintfulCatalogProvider({ request } as unknown as PrintfulClient, [{
      productId: "71", productType: "t-shirt", baseCostMinor: 1_500, shippingReserveMinor: 500, returnRisk: "LOW", technique: "dtg",
    }]);
    await expect(provider.fetchSnapshot("USD")).rejects.toThrow("currency mismatch");
  });

  it("converts decimal prices using ISO currency exponents", () => {
    expect(decimalPriceToMinor("14.25", "USD")).toBe(1_425);
    expect(decimalPriceToMinor("1425", "JPY")).toBe(1_425);
    expect(decimalPriceToMinor("1.234", "KWD")).toBe(1_234);
    expect(() => decimalPriceToMinor("1.001", "USD")).toThrow("excess precision");
  });

  it("walks every page and keeps only variants stocked in all target regions", async () => {
    const variants = [
      { id: 1, size: "S", color: "Black" },
      { id: 2, size: "M", color: "White" },
      { id: 3, size: "L", color: "Blue" },
    ];
    const request = vi.fn(async (path: string) => {
      const offset = Number(new URL(path, "https://api.printful.test").searchParams.get("offset") ?? 0);
      if (path.endsWith("shipping-countries")) return { data: [{ code: "US" }, { code: "JP" }] };
      if (path.includes("catalog-variants")) return { data: offset === 0 ? variants.slice(0, 2) : variants.slice(2), paging: { total: 3 } };
      if (path.includes("mockup-styles")) return { data: [{ placement: "front", technique: "dtg", print_area_width: 12, print_area_height: 16, dpi: 150, mockup_styles: [{ id: 10 }] }] };
      if (path.includes("/availability?")) {
        const region = new URL(path, "https://api.printful.test").searchParams.get("selling_region_name");
        const ids = region === "north_america" ? [1, 2] : [2, 3];
        const rows = ids.map((id) => ({ catalog_variant_id: id, techniques: [{ technique: "dtg", selling_regions: [{ name: region, availability: "in stock" }] }] }));
        return { data: offset === 0 ? rows.slice(0, 1) : rows.slice(1), paging: { total: 2 } };
      }
      if (path.includes("/prices?")) {
        const rows = variants.map((variant) => ({ id: variant.id, techniques: [{ technique_key: "dtg", discounted_price: `${10 + variant.id}.00` }] }));
        return { data: { currency: "USD", variants: offset === 0 ? rows.slice(0, 2) : rows.slice(2) }, paging: { total: 3 } };
      }
      return { data: { name: "Paged Tee", placements: [{ id: "front" }] } };
    });
    const provider = new PrintfulCatalogProvider({ request } as unknown as PrintfulClient, [{
      productId: "71", productType: "t-shirt", baseCostMinor: 1_500, shippingReserveMinor: 500, returnRisk: "LOW", technique: "dtg",
    }]);
    expect((await provider.fetchSnapshot("USD", ["US", "JP"])).products[0]).toMatchObject({
      sizes: ["M"], colors: ["White"], baseCostMinor: 1_200,
      variantCount: 3, availableVariantCount: 1, stockByMarket: { US: 2, JP: 2 },
      stockRegionByMarket: { US: "north_america", JP: "japan" },
    });
    expect(request.mock.calls.filter(([path]) => String(path).includes("offset=2"))).toHaveLength(2);
  });

  it("rejects malformed seed configuration", () => {
    expect(() => parsePrintfulCatalogSeeds('[{"productId":"71"}]')).toThrow("index 0");
  });
});
