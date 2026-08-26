import { describe, expect, it } from "vitest";
import { money } from "../src/domain/money.js";
import { evaluateOrder, type OrderPolicy, type OrderPolicyInput } from "../src/domain/order-policy.js";

const policy: OrderPolicy = { maxOrderAmountMinor: 50_000n, maxItemCount: 10, maxCostIncreaseBasisPoints: 1_000 };
const valid: OrderPolicyInput = {
  revenue: money(10_000, "USD"),
  currentVariableCost: money(4_000, "USD"),
  approvedVariableCost: money(4_000, "USD"),
  shippingCountry: "US",
  allowedCountries: new Set(["US", "JP"]),
  addressValid: true,
  variantAvailable: true,
  designPresent: true,
  mappingCount: 1,
  paymentReady: true,
  alreadySubmitted: false,
  itemCount: 2,
};

describe("order policy", () => {
  it("approves a valid order", () => {
    expect(evaluateOrder(valid, policy)).toMatchObject({ status: "READY", reasons: [], marginBasisPoints: 6_000 });
  });

  it("blocks unsafe orders and retains every reason", () => {
    const result = evaluateOrder({ ...valid, shippingCountry: "KR", designPresent: false, mappingCount: 0 }, policy);
    expect(result.status).toBe("BLOCKED");
    expect(result.reasons).toEqual(["UNSUPPORTED_COUNTRY", "MISSING_DESIGN", "MAPPING_AMBIGUOUS"]);
  });

  it("does not resubmit an already processed order", () => {
    expect(evaluateOrder({ ...valid, alreadySubmitted: true }, policy).status).toBe("ALREADY_PROCESSED");
  });

  it("routes a cost spike to review", () => {
    const result = evaluateOrder({ ...valid, currentVariableCost: money(5_000, "USD") }, policy);
    expect(result).toMatchObject({ status: "REVIEW_REQUIRED", reasons: ["COST_SPIKE"] });
  });
});

