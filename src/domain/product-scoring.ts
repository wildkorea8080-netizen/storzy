export type ScoreComponent = "margin" | "targetFit" | "shipping" | "designFit" | "variety" | "returnSafety";

export type ProductScoreInput = Readonly<Record<ScoreComponent, number>>;

export type ProductScore = Readonly<{
  total: number;
  components: ProductScoreInput;
  ruleVersion: "product-score.v1";
}>;

const WEIGHTS: Readonly<Record<ScoreComponent, number>> = {
  margin: 0.3,
  targetFit: 0.25,
  shipping: 0.15,
  designFit: 0.15,
  variety: 0.1,
  returnSafety: 0.05,
};

function validateComponent(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} score must be between 0 and 100`);
  }
}

export function scoreProduct(input: ProductScoreInput): ProductScore {
  for (const [name, value] of Object.entries(input)) validateComponent(name, value);
  const total = (Object.keys(WEIGHTS) as ScoreComponent[]).reduce(
    (sum, component) => sum + input[component] * WEIGHTS[component],
    0,
  );
  return { total: Math.round(total * 100) / 100, components: input, ruleVersion: "product-score.v1" };
}

export function marginScore(marginRate: number): number | null {
  if (!Number.isFinite(marginRate) || marginRate < 0.3) return null;
  if (marginRate >= 0.6) return 100;
  if (marginRate >= 0.5) return 85;
  if (marginRate >= 0.4) return 65;
  return 35;
}

