import { marginScore, scoreProduct } from "../domain/product-scoring.js";
import type { CandidateEvaluation, CatalogProduct, ReturnRisk } from "./types.js";

type BrandProfileData = Record<string, unknown>;

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s-]+/g, " ");
}

function asObjects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)) : [];
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function returnSafety(risk: ReturnRisk): number {
  return risk === "LOW" ? 90 : risk === "MEDIUM" ? 60 : 30;
}

export function evaluateCatalogProduct(profile: BrandProfileData, product: CatalogProduct): CandidateEvaluation {
  const targetMarkets = asObjects(profile.target_markets).map((market) => String(market.country_code ?? "").toUpperCase()).filter(Boolean);
  const pricing = (profile.pricing && typeof profile.pricing === "object" ? profile.pricing : {}) as Record<string, unknown>;
  const profileCurrency = String(pricing.currency ?? "").toUpperCase();
  const targetMargin = typeof pricing.target_margin_rate === "number" ? pricing.target_margin_rate : 0;
  const range = asObjects(pricing.price_ranges).find((item) => normalized(String(item.product_type ?? "")) === normalized(product.productType));
  const catalogPlan = (profile.catalog_plan && typeof profile.catalog_plan === "object" ? profile.catalog_plan : {}) as Record<string, unknown>;
  const preferred = asStrings(catalogPlan.preferred_product_types).map(normalized);
  const excluded = asStrings(catalogPlan.excluded_product_types).map(normalized);
  const productType = normalized(product.productType);
  const shippingCountries = new Set(product.shippingCountries.map((country) => country.toUpperCase()));
  const variableCostMinor = product.baseCostMinor + product.shippingReserveMinor;
  const exclusionReasons: string[] = [];

  if (product.currency !== profileCurrency) exclusionReasons.push("CURRENCY_MISMATCH");
  if (excluded.includes(productType)) exclusionReasons.push("PRODUCT_TYPE_EXCLUDED");
  if (!range) exclusionReasons.push("PRICE_RANGE_MISSING");
  if (targetMarkets.some((country) => !shippingCountries.has(country))) exclusionReasons.push("UNSUPPORTED_TARGET_MARKET");
  if (product.stockByMarket && targetMarkets.some((country) => (product.stockByMarket?.[country] ?? 0) === 0)) exclusionReasons.push("OUT_OF_STOCK_TARGET_MARKET");
  if (product.placements.length === 0) exclusionReasons.push("DESIGN_PLACEMENT_MISSING");
  if (!Number.isInteger(variableCostMinor) || variableCostMinor <= 0) exclusionReasons.push("INVALID_VARIABLE_COST");

  let recommendedRetailMinor: number | null = null;
  let marginBasisPoints: number | null = null;
  let computedMarginScore: number | null = null;
  if (range && exclusionReasons.length === 0) {
    const minMinor = Number(range.min_minor);
    const maxMinor = Number(range.max_minor);
    const requiredForMargin = targetMargin >= 1 ? Number.POSITIVE_INFINITY : Math.ceil(variableCostMinor / (1 - targetMargin));
    recommendedRetailMinor = Math.max(minMinor, requiredForMargin);
    if (!Number.isInteger(minMinor) || !Number.isInteger(maxMinor) || minMinor < 0 || maxMinor < minMinor) {
      exclusionReasons.push("INVALID_PRICE_RANGE");
    } else if (!Number.isFinite(recommendedRetailMinor) || recommendedRetailMinor > maxMinor) {
      exclusionReasons.push("TARGET_MARGIN_UNACHIEVABLE");
      recommendedRetailMinor = null;
    } else {
      marginBasisPoints = Math.floor(((recommendedRetailMinor - variableCostMinor) * 10_000) / recommendedRetailMinor);
      computedMarginScore = marginScore(marginBasisPoints / 10_000);
      if (computedMarginScore === null) {
        exclusionReasons.push("MARGIN_BELOW_FLOOR");
        recommendedRetailMinor = null;
        marginBasisPoints = null;
      }
    }
  }

  const evidence: Record<string, unknown> = {
    targetMarkets,
    shippingCountries: [...shippingCountries],
    placements: product.placements,
    sizeCount: new Set(product.sizes).size,
    colorCount: new Set(product.colors).size,
    baseCostMinor: product.baseCostMinor,
    shippingReserveMinor: product.shippingReserveMinor,
    targetMarginRate: targetMargin,
    costSource: product.costSource ?? "UNSPECIFIED",
    selectedTechnique: product.selectedTechnique ?? null,
    variantCount: product.variantCount ?? null,
    availableVariantCount: product.availableVariantCount ?? null,
    stockByMarket: product.stockByMarket ?? null,
    stockRegionByMarket: product.stockRegionByMarket ?? null,
    costFallbackReason: product.costFallbackReason ?? null,
  };
  if (exclusionReasons.length > 0 || computedMarginScore === null || recommendedRetailMinor === null || marginBasisPoints === null) {
    return {
      product,
      eligibility: "EXCLUDED",
      exclusionReasons,
      score: null,
      scoreBreakdown: null,
      evidence,
      recommendedRetailMinor: null,
      variableCostMinor,
      marginBasisPoints: null,
      ruleVersion: "product-candidate.v1",
    };
  }

  const components = {
    margin: computedMarginScore,
    targetFit: preferred.includes(productType) ? 100 : 40,
    shipping: 100,
    designFit: product.placements.some((placement) => normalized(placement) === "front") ? 100 : 75,
    variety: Math.min(100, new Set(product.sizes).size * 10 + new Set(product.colors).size * 10),
    returnSafety: returnSafety(product.returnRisk),
  };
  const scored = scoreProduct(components);
  return {
    product,
    eligibility: "ELIGIBLE",
    exclusionReasons: [],
    score: scored.total,
    scoreBreakdown: components,
    evidence,
    recommendedRetailMinor,
    variableCostMinor,
    marginBasisPoints,
    ruleVersion: "product-candidate.v1",
  };
}
