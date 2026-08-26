import { marginBasisPoints, type Money } from "./money.js";

export type OrderBlockCode =
  | "NEGATIVE_MARGIN"
  | "UNSUPPORTED_COUNTRY"
  | "INVALID_ADDRESS"
  | "VARIANT_UNAVAILABLE"
  | "COST_SPIKE"
  | "HIGH_VALUE_ORDER"
  | "MISSING_DESIGN"
  | "MAPPING_AMBIGUOUS"
  | "PAYMENT_NOT_READY"
  | "DUPLICATE_SUBMISSION";

export type OrderPolicyInput = Readonly<{
  revenue: Money;
  currentVariableCost: Money;
  approvedVariableCost: Money;
  shippingCountry: string;
  allowedCountries: ReadonlySet<string>;
  addressValid: boolean;
  variantAvailable: boolean;
  designPresent: boolean;
  mappingCount: number;
  paymentReady: boolean;
  alreadySubmitted: boolean;
  itemCount: number;
}>;

export type OrderPolicy = Readonly<{
  maxOrderAmountMinor: bigint;
  maxItemCount: number;
  maxCostIncreaseBasisPoints: number;
}>;

export type OrderDecision = Readonly<{
  status: "READY" | "REVIEW_REQUIRED" | "BLOCKED" | "WAITING" | "ALREADY_PROCESSED";
  reasons: readonly OrderBlockCode[];
  marginBasisPoints: number;
  ruleVersion: "order-policy.v1";
}>;

export function evaluateOrder(input: OrderPolicyInput, policy: OrderPolicy): OrderDecision {
  const reasons: OrderBlockCode[] = [];
  const margin = marginBasisPoints(input.revenue, input.currentVariableCost);

  if (input.alreadySubmitted) reasons.push("DUPLICATE_SUBMISSION");
  if (!input.paymentReady) reasons.push("PAYMENT_NOT_READY");
  if (!input.allowedCountries.has(input.shippingCountry.toUpperCase())) reasons.push("UNSUPPORTED_COUNTRY");
  if (!input.addressValid) reasons.push("INVALID_ADDRESS");
  if (!input.variantAvailable) reasons.push("VARIANT_UNAVAILABLE");
  if (!input.designPresent) reasons.push("MISSING_DESIGN");
  if (input.mappingCount !== 1) reasons.push("MAPPING_AMBIGUOUS");
  if (margin < 0) reasons.push("NEGATIVE_MARGIN");
  if (input.revenue.amountMinor > policy.maxOrderAmountMinor || input.itemCount > policy.maxItemCount) {
    reasons.push("HIGH_VALUE_ORDER");
  }

  if (input.approvedVariableCost.amountMinor > 0n) {
    const increase = input.currentVariableCost.amountMinor - input.approvedVariableCost.amountMinor;
    const increaseBasisPoints = Number((increase * 10_000n) / input.approvedVariableCost.amountMinor);
    if (increaseBasisPoints > policy.maxCostIncreaseBasisPoints) reasons.push("COST_SPIKE");
  }

  let status: OrderDecision["status"] = "READY";
  if (reasons.includes("DUPLICATE_SUBMISSION")) status = "ALREADY_PROCESSED";
  else if (reasons.includes("PAYMENT_NOT_READY")) status = "WAITING";
  else if (reasons.some((reason) => ["NEGATIVE_MARGIN", "UNSUPPORTED_COUNTRY", "MISSING_DESIGN", "MAPPING_AMBIGUOUS"].includes(reason))) {
    status = "BLOCKED";
  } else if (reasons.length > 0) status = "REVIEW_REQUIRED";

  return { status, reasons, marginBasisPoints: margin, ruleVersion: "order-policy.v1" };
}

