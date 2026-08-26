import { describe, expect, it } from "vitest";
import { evaluateDesignResolution, validateMockupStyleSelection } from "../src/mockups/resolution-gate.js";

const guideline = { placement: "front", technique: "dtg", printAreaWidthIn: 12, printAreaHeightIn: 16, targetDpi: 150, allowedMockupStyleIds: [10, 11] } as const;

describe("design resolution gate", () => {
  it("passes an image meeting the physical print area's target DPI", () => {
    expect(evaluateDesignResolution({ widthPx: 1800, heightPx: 2400 }, guideline)).toMatchObject({ status: "PASSED", effectiveDpi: 150, requiredWidthPx: 1800, requiredHeightPx: 2400 });
  });
  it("fails an image that would be enlarged below target DPI", () => {
    expect(evaluateDesignResolution({ widthPx: 1200, heightPx: 1200 }, guideline)).toMatchObject({ status: "FAILED", effectiveDpi: 75 });
  });
  it("requires review when catalog guidance is unavailable", () => {
    expect(evaluateDesignResolution({ widthPx: 1800, heightPx: 2400 })).toEqual({ status: "GUIDELINE_MISSING" });
  });
  it("accepts only mockup styles in the catalog allowlist", () => {
    expect(validateMockupStyleSelection([10], [10, 11])).toBe("PASSED");
    expect(validateMockupStyleSelection([12], [10, 11])).toBe("MISMATCH");
    expect(validateMockupStyleSelection([10], [])).toBe("GUIDANCE_MISSING");
  });
});
