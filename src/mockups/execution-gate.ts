import type { PlacementGuideline } from "../candidates/types.js";
import { evaluateDesignResolution, validateMockupStyleSelection } from "./resolution-gate.js";

export type MockupExecutionContext = Readonly<{
  resolutionStatus: string;
  widthPx: number | null;
  heightPx: number | null;
  effectiveDpi: number | null;
  placement: string;
  technique: string;
  mockupStyleIds: readonly number[];
  printGuideline: unknown;
}>;

export function assertMockupExecutionSafety(context: MockupExecutionContext): PlacementGuideline {
  if (context.resolutionStatus !== "PASSED") throw new Error(`MOCKUP_SAFETY_BLOCKED: resolution status is ${context.resolutionStatus}`);
  if (!context.widthPx || !context.heightPx) throw new Error("MOCKUP_SAFETY_BLOCKED: validated image dimensions are missing");
  const guideline = parseGuideline(context.printGuideline);
  if (!guideline || guideline.placement !== context.placement || guideline.technique !== context.technique) throw new Error("MOCKUP_SAFETY_BLOCKED: print guideline does not match placement and technique");
  const resolution = evaluateDesignResolution({ widthPx: context.widthPx, heightPx: context.heightPx }, guideline);
  if (resolution.status !== "PASSED" || context.effectiveDpi === null || Math.abs(resolution.effectiveDpi - context.effectiveDpi) > 0.01) throw new Error("MOCKUP_SAFETY_BLOCKED: stored design resolution is no longer valid");
  const styles = validateMockupStyleSelection(context.mockupStyleIds, guideline.allowedMockupStyleIds);
  if (styles !== "PASSED") throw new Error(`MOCKUP_SAFETY_BLOCKED: mockup style validation is ${styles}`);
  return guideline;
}

function parseGuideline(value: unknown): PlacementGuideline | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const placement = String(row.placement ?? ""), technique = String(row.technique ?? "");
  const printAreaWidthIn = Number(row.printAreaWidthIn), printAreaHeightIn = Number(row.printAreaHeightIn), targetDpi = Number(row.targetDpi);
  const allowedMockupStyleIds = Array.isArray(row.allowedMockupStyleIds) ? row.allowedMockupStyleIds.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
  if (!placement || !technique || !Number.isFinite(printAreaWidthIn) || printAreaWidthIn <= 0 || !Number.isFinite(printAreaHeightIn) || printAreaHeightIn <= 0 || !Number.isInteger(targetDpi) || targetDpi < 150) return null;
  return { placement, technique, printAreaWidthIn, printAreaHeightIn, targetDpi, allowedMockupStyleIds };
}
