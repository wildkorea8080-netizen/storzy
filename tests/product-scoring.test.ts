import { describe, expect, it } from "vitest";
import { marginScore, scoreProduct } from "../src/domain/product-scoring.js";

describe("product scoring", () => {
  it("uses the documented deterministic weights", () => {
    const result = scoreProduct({ margin: 100, targetFit: 80, shipping: 60, designFit: 70, variety: 50, returnSafety: 90 });
    expect(result.total).toBe(79);
    expect(result.ruleVersion).toBe("product-score.v1");
  });

  it("excludes products below the margin floor", () => {
    expect(marginScore(0.2999)).toBeNull();
    expect(marginScore(0.4)).toBe(65);
    expect(marginScore(0.6)).toBe(100);
  });
});

