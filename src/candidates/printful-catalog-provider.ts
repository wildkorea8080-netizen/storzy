import type { PrintfulClient } from "../integrations/printful.js";
import type { CatalogProduct, CatalogProvider, CatalogSnapshotData, PlacementGuideline, ReturnRisk } from "./types.js";

export type PrintfulCatalogSeed = Readonly<{
  productId: string;
  productType: string;
  baseCostMinor: number;
  shippingReserveMinor: number;
  returnRisk: ReturnRisk;
  technique: string;
}>;

type Variant = Readonly<{ id: string; size: string; color: string; imageUrl: string | null }>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function data(value: unknown): unknown {
  const root = record(value);
  return "data" in root ? root.data : value;
}

function strings(value: unknown, keys: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    const itemRecord = record(item);
    const found = keys.map((key) => itemRecord[key]).find((candidate) => typeof candidate === "string");
    return typeof found === "string" ? [found] : [];
  });
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeVariants(response: unknown): Variant[] {
  const variants = array(data(response)).map((value) => {
    const variant = record(value);
    const id = String(variant.id ?? "").trim();
    const size = String(variant.size ?? "").trim();
    const color = String(variant.color ?? "").trim();
    const imageUrl = typeof variant.image === "string" && /^https:\/\//.test(variant.image) ? variant.image : null;
    if (!id) throw new Error("Printful variant is missing an id");
    return { id, size, color, imageUrl };
  });
  if (variants.length === 0) throw new Error("Printful product has no catalog variants");
  return variants;
}

function normalizePlacementGuidelines(rows: readonly unknown[], technique: string): PlacementGuideline[] {
  return rows.flatMap((value) => {
    const row = record(value);
    const placement = String(row.placement ?? "").trim();
    const rowTechnique = String(row.technique ?? "").trim().toLowerCase();
    const printAreaWidthIn = Number(row.print_area_width);
    const printAreaHeightIn = Number(row.print_area_height);
    const targetDpi = Number(row.dpi);
    if (!placement || rowTechnique !== technique || !Number.isFinite(printAreaWidthIn) || printAreaWidthIn <= 0 ||
        !Number.isFinite(printAreaHeightIn) || printAreaHeightIn <= 0 || !Number.isFinite(targetDpi) || targetDpi < 150) return [];
    const allowedMockupStyleIds = [...new Set(array(row.mockup_styles).map((style) => Number(record(style).id)).filter((id) => Number.isInteger(id) && id > 0))];
    return [{ placement, technique: rowTechnique, printAreaWidthIn, printAreaHeightIn, targetDpi, allowedMockupStyleIds }];
  });
}

function sellingRegion(countryCode: string): string {
  const country = countryCode.toUpperCase();
  const exact: Readonly<Record<string, string>> = {
    CA: "canada", ES: "spain", LV: "latvia", GB: "uk", FR: "france", DE: "germany",
    AU: "australia", JP: "japan", NZ: "new_zealand", IT: "italy", BR: "brazil", KR: "republic_of_korea",
  };
  if (exact[country]) return exact[country];
  if (country === "US" || country === "MX") return "north_america";
  if (["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "GR", "HU", "IE", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "SE"].includes(country)) return "europe";
  if (["BN", "KH", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "TL", "VN"].includes(country)) return "southeast_asia";
  return "worldwide";
}

function inStockVariantIds(response: unknown, technique: string, region: string): Set<string> {
  const result = new Set<string>();
  for (const value of array(data(response))) {
    const row = record(value);
    const id = String(row.catalog_variant_id ?? "").trim();
    const techniqueRow = array(row.techniques).map(record).find((item) => String(item.technique ?? "").toLowerCase() === technique);
    const regionRow = array(techniqueRow?.selling_regions).map(record).find((item) => String(item.name ?? "").toLowerCase() === region);
    if (id && String(regionRow?.availability ?? "").toLowerCase() === "in stock") result.add(id);
  }
  return result;
}

const ZERO_DECIMAL_CURRENCIES = new Set(["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

export function decimalPriceToMinor(value: unknown, currency: string): number {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) throw new Error(`Invalid Printful price: ${String(value)}`);
  const exponent = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : THREE_DECIMAL_CURRENCIES.has(currency) ? 3 : 2;
  const [whole = "", fraction = ""] = value.split(".");
  if (fraction.length > exponent && /[1-9]/.test(fraction.slice(exponent))) throw new Error(`Printful price has excess precision for ${currency}: ${value}`);
  const minor = BigInt(whole) * (10n ** BigInt(exponent)) + BigInt((fraction.slice(0, exponent).padEnd(exponent, "0")) || "0");
  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`Printful price is out of range: ${value}`);
  return Number(minor);
}

function normalizeLiveCost(response: unknown, requestedCurrency: string, technique: string, variantIds: ReadonlySet<string>): number {
  const root = record(data(response));
  const responseCurrency = String(root.currency ?? "").toUpperCase();
  if (responseCurrency !== requestedCurrency) throw new Error(`Printful price currency mismatch: expected ${requestedCurrency}, received ${responseCurrency || "missing"}`);
  const prices = new Map<string, number>();
  for (const value of array(root.variants)) {
    const variant = record(value);
    const id = String(variant.id ?? "").trim();
    const matching = array(variant.techniques).map(record).find((item) => String(item.technique_key ?? "").toLowerCase() === technique);
    if (id && matching) prices.set(id, decimalPriceToMinor(matching.discounted_price ?? matching.price, responseCurrency));
  }
  const missing = [...variantIds].filter((id) => !prices.has(id));
  if (missing.length > 0) throw new Error(`Printful prices missing ${technique} for ${missing.length} variant(s)`);
  return Math.max(...[...variantIds].map((id) => prices.get(id)!));
}

export class PrintfulCatalogProvider implements CatalogProvider {
  constructor(
    private readonly client: PrintfulClient,
    private readonly seeds: readonly PrintfulCatalogSeed[],
  ) {
    if (seeds.length === 0) throw new Error("At least one Printful catalog seed is required");
  }

  async fetchSnapshot(currency: string, targetMarkets: readonly string[] = []): Promise<CatalogSnapshotData> {
    const products = await Promise.all(this.seeds.map((seed) => this.fetchProduct(seed, currency, targetMarkets)));
    return { provider: "PRINTFUL", currency, fetchedAt: new Date(), products };
  }

  private async fetchProduct(seed: PrintfulCatalogSeed, currency: string, targetMarkets: readonly string[]): Promise<CatalogProduct> {
    const productId = encodeURIComponent(seed.productId);
    const [productResponse, countriesResponse, variantRows, mockupStyleRows] = await Promise.all([
      this.client.request<unknown>(`/v2/catalog-products/${productId}`),
      this.client.request<unknown>(`/v2/catalog-products/${productId}/shipping-countries`),
      this.fetchArrayPages(`/v2/catalog-products/${productId}/catalog-variants`),
      this.fetchArrayPages(`/v2/catalog-products/${productId}/mockup-styles`),
    ]);
    const product = record(data(productResponse));
    const countries = data(countriesResponse);
    const name = [product.name, product.title].find((value) => typeof value === "string");
    const variants = normalizeVariants({ data: variantRows });
    const marketRegions = new Map(targetMarkets.map((market) => [market.toUpperCase(), sellingRegion(market)]));
    const availabilityByRegion = new Map<string, Set<string>>();
    await Promise.all([...new Set(marketRegions.values())].map(async (region) => {
      const rows = await this.fetchArrayPages(`/v2/catalog-products/${productId}/availability`, `techniques=${encodeURIComponent(seed.technique)}&selling_region_name=${encodeURIComponent(region)}`);
      availabilityByRegion.set(region, inStockVariantIds({ data: rows }, seed.technique, region));
    }));
    const availableVariants = marketRegions.size === 0
      ? variants
      : variants.filter((variant) => [...marketRegions.values()].every((region) => availabilityByRegion.get(region)?.has(variant.id)));
    const stockByMarket = Object.fromEntries([...marketRegions].map(([market, region]) => [market, availabilityByRegion.get(region)?.size ?? 0]));
    const stockRegionByMarket = Object.fromEntries(marketRegions);
    let baseCostMinor = seed.baseCostMinor;
    let costSource: "PRINTFUL_LIVE" | "APPROVED_FALLBACK" = "PRINTFUL_LIVE";
    let costFallbackReason: string | undefined;
    try {
      const priceResponse = await this.fetchPricePages(productId, currency);
      const pricedVariantIds = availableVariants.length > 0 ? availableVariants : variants;
      baseCostMinor = normalizeLiveCost(priceResponse, currency, seed.technique, new Set(pricedVariantIds.map((variant) => variant.id)));
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : null;
      if (status === null) throw error;
      costSource = "APPROVED_FALLBACK";
      costFallbackReason = `PRINTFUL_HTTP_${status}`;
    }
    return {
      externalProductId: seed.productId,
      productType: seed.productType,
      name: typeof name === "string" ? name : `Printful product ${seed.productId}`,
      currency,
      baseCostMinor,
      shippingReserveMinor: seed.shippingReserveMinor,
      shippingCountries: strings(countries, ["code", "country_code", "countryCode"]),
      placements: strings(product.placements, ["id", "placement", "name"]),
      placementGuidelines: normalizePlacementGuidelines(mockupStyleRows, seed.technique),
      sizes: [...new Set(availableVariants.map((variant) => variant.size).filter(Boolean))],
      colors: [...new Set(availableVariants.map((variant) => variant.color).filter(Boolean))],
      returnRisk: seed.returnRisk,
      costSource,
      selectedTechnique: seed.technique,
      variantCount: variants.length,
      availableVariantCount: availableVariants.length,
      stockByMarket,
      stockRegionByMarket,
      catalogVariants: availableVariants.map((variant) => ({ externalVariantId: variant.id, size: variant.size, color: variant.color, imageUrl: variant.imageUrl })),
      ...(costFallbackReason ? { costFallbackReason } : {}),
    };
  }

  private async fetchArrayPages(path: string, query = ""): Promise<unknown[]> {
    const rows: unknown[] = [];
    for (let offset = 0, page = 0; page < 100; page += 1) {
      const response = await this.client.request<unknown>(`${path}?${query ? `${query}&` : ""}limit=100&offset=${offset}`);
      const pageRows = array(data(response));
      rows.push(...pageRows);
      const total = Number(record(record(response).paging).total);
      if (!Number.isFinite(total) || rows.length >= total) return rows;
      if (pageRows.length === 0) throw new Error(`Printful pagination stalled for ${path}`);
      offset += pageRows.length;
    }
    throw new Error(`Printful pagination exceeded safety limit for ${path}`);
  }

  private async fetchPricePages(productId: string, currency: string): Promise<unknown> {
    const variants: unknown[] = [];
    for (let offset = 0, page = 0; page < 100; page += 1) {
      const response = await this.client.request<unknown>(`/v2/catalog-products/${productId}/prices?currency=${encodeURIComponent(currency)}&limit=100&offset=${offset}`);
      const root = record(data(response));
      const responseCurrency = String(root.currency ?? "").toUpperCase();
      if (responseCurrency !== currency) throw new Error(`Printful price currency mismatch: expected ${currency}, received ${responseCurrency || "missing"}`);
      const pageRows = array(root.variants);
      variants.push(...pageRows);
      const total = Number(record(record(response).paging).total);
      if (!Number.isFinite(total) || variants.length >= total) return { data: { currency, variants } };
      if (pageRows.length === 0) throw new Error("Printful price pagination stalled");
      offset += pageRows.length;
    }
    throw new Error("Printful price pagination exceeded safety limit");
  }
}

export function parsePrintfulCatalogSeeds(value: string): PrintfulCatalogSeed[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("PRINTFUL_CATALOG_SEEDS_JSON must be a JSON array");
  return parsed.map((item, index) => {
    const seed = record(item);
    const productId = String(seed.productId ?? "").trim();
    const productType = String(seed.productType ?? "").trim();
    const baseCostMinor = Number(seed.baseCostMinor);
    const shippingReserveMinor = Number(seed.shippingReserveMinor);
    const returnRisk = seed.returnRisk;
    const technique = String(seed.technique ?? "dtg").trim().toLowerCase();
    if (!productId || !productType || !Number.isInteger(baseCostMinor) || baseCostMinor <= 0 ||
        !Number.isInteger(shippingReserveMinor) || shippingReserveMinor < 0 ||
        !(["LOW", "MEDIUM", "HIGH"] as const).includes(returnRisk as ReturnRisk) || !/^[a-z][a-z0-9_-]*$/.test(technique)) {
      throw new Error(`Invalid Printful catalog seed at index ${index}`);
    }
    return { productId, productType, baseCostMinor, shippingReserveMinor, returnRisk: returnRisk as ReturnRisk, technique };
  });
}
