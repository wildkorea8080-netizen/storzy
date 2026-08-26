import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateCatalogProduct } from "../src/candidates/evaluator.js";
import type { CatalogProduct } from "../src/candidates/types.js";

const profile = JSON.parse(readFileSync(new URL("./fixtures/brand-profile.valid.json", import.meta.url), "utf8")) as Record<string, unknown>;
const product: CatalogProduct = {
  externalProductId: "71",
  productType: "t-shirt",
  name: "Unisex Staple Tee",
  currency: "USD",
  baseCostMinor: 1_500,
  shippingReserveMinor: 500,
  shippingCountries: ["US", "JP"],
  placements: ["front"],
  sizes: ["S", "M"],
  colors: ["Black", "White"],
  returnRisk: "MEDIUM",
};

describe("candidate evaluator", () => {
  it("computes a deterministic weighted score and price", () => {
    expect(evaluateCatalogProduct(profile, product)).toMatchObject({
      eligibility: "ELIGIBLE",
      exclusionReasons: [],
      score: 87.5,
      recommendedRetailMinor: 4_445,
      variableCostMinor: 2_000,
      scoreBreakdown: { margin: 85, targetFit: 100, shipping: 100, designFit: 100, variety: 40, returnSafety: 60 },
    });
  });

  it("hard-excludes products that cannot ship to every target market", () => {
    expect(evaluateCatalogProduct(profile, { ...product, shippingCountries: ["US"] })).toMatchObject({
      eligibility: "EXCLUDED",
      exclusionReasons: ["UNSUPPORTED_TARGET_MARKET"],
      score: null,
    });
  });

  it("hard-excludes products whose target margin cannot fit the price ceiling", () => {
    expect(evaluateCatalogProduct(profile, { ...product, baseCostMinor: 3_000 })).toMatchObject({
      eligibility: "EXCLUDED",
      exclusionReasons: ["TARGET_MARGIN_UNACHIEVABLE"],
      recommendedRetailMinor: null,
    });
  });

  it("hard-excludes a product that has no stock in a target market", () => {
    expect(evaluateCatalogProduct(profile, { ...product, stockByMarket: { US: 4, JP: 0 } })).toMatchObject({
      eligibility: "EXCLUDED",
      exclusionReasons: ["OUT_OF_STOCK_TARGET_MARKET"],
    });
  });
});
