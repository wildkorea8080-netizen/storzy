import { describe, expect, it } from "vitest";
import { marginBasisPoints, money, sumMoney } from "../src/domain/money.js";

describe("money", () => {
  it("sums minor units without floating point loss", () => {
    expect(sumMoney([money(10, "usd"), money(20, "USD")])).toEqual(money(30, "USD"));
  });

  it("calculates margin in basis points", () => {
    expect(marginBasisPoints(money(4_000, "USD"), money(1_800, "USD"))).toBe(5_500);
  });

  it("rejects currency mismatches", () => {
    expect(() => sumMoney([money(10, "USD"), money(20, "JPY")])).toThrow("Currency mismatch");
  });
});

