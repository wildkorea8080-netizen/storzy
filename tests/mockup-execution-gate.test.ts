import { describe, expect, it } from "vitest";
import { assertMockupExecutionSafety } from "../src/mockups/execution-gate.js";

const safe = { resolutionStatus: "PASSED", widthPx: 1800, heightPx: 2400, effectiveDpi: 150, placement: "front", technique: "dtg", mockupStyleIds: [10], printGuideline: { placement: "front", technique: "dtg", printAreaWidthIn: 12, printAreaHeightIn: 16, targetDpi: 150, allowedMockupStyleIds: [10, 11] } } as const;

describe("mockup execution safety gate", () => {
  it("allows a fully consistent validated design", () => {
    expect(assertMockupExecutionSafety(safe)).toMatchObject({ placement: "front", targetDpi: 150 });
  });
  it("blocks designs that were never resolution-approved", () => {
    expect(() => assertMockupExecutionSafety({ ...safe, resolutionStatus: "NOT_EVALUATED" })).toThrow("MOCKUP_SAFETY_BLOCKED");
  });
  it("blocks tampered dimensions or effective DPI", () => {
    expect(() => assertMockupExecutionSafety({ ...safe, widthPx: 1200 })).toThrow("resolution is no longer valid");
    expect(() => assertMockupExecutionSafety({ ...safe, effectiveDpi: 151 })).toThrow("resolution is no longer valid");
  });
  it("blocks placement and style drift", () => {
    expect(() => assertMockupExecutionSafety({ ...safe, placement: "back" })).toThrow("does not match");
    expect(() => assertMockupExecutionSafety({ ...safe, mockupStyleIds: [99] })).toThrow("MISMATCH");
  });
});
