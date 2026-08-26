export type ReturnRisk = "LOW" | "MEDIUM" | "HIGH";

export type PlacementGuideline = Readonly<{
  placement: string;
  technique: string;
  printAreaWidthIn: number;
  printAreaHeightIn: number;
  targetDpi: number;
  allowedMockupStyleIds: readonly number[];
}>;

export type CatalogProduct = Readonly<{
  externalProductId: string;
  productType: string;
  name: string;
  currency: string;
  baseCostMinor: number;
  shippingReserveMinor: number;
  shippingCountries: readonly string[];
  placements: readonly string[];
  placementGuidelines?: readonly PlacementGuideline[];
  sizes: readonly string[];
  colors: readonly string[];
  returnRisk: ReturnRisk;
  costSource?: "PRINTFUL_LIVE" | "APPROVED_FALLBACK";
  selectedTechnique?: string;
  variantCount?: number;
  availableVariantCount?: number;
  stockByMarket?: Readonly<Record<string, number>>;
  stockRegionByMarket?: Readonly<Record<string, string>>;
  costFallbackReason?: string;
  catalogVariants?: readonly Readonly<{ externalVariantId: string; size: string; color: string; imageUrl: string | null }>[];
}>;

export type CatalogSnapshotData = Readonly<{
  provider: "PRINTFUL" | "FIXTURE";
  currency: string;
  fetchedAt: Date;
  products: readonly CatalogProduct[];
}>;

export interface CatalogProvider {
  fetchSnapshot(currency: string, targetMarkets?: readonly string[]): Promise<CatalogSnapshotData>;
}

export type CandidateEvaluation = Readonly<{
  product: CatalogProduct;
  eligibility: "ELIGIBLE" | "EXCLUDED";
  exclusionReasons: readonly string[];
  score: number | null;
  scoreBreakdown: Record<string, number> | null;
  evidence: Record<string, unknown>;
  recommendedRetailMinor: number | null;
  variableCostMinor: number;
  marginBasisPoints: number | null;
  ruleVersion: "product-candidate.v1";
}>;
