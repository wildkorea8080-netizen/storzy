import type { PlacementGuideline } from "../candidates/types.js";

export type DesignResolutionResult =
  | Readonly<{ status: "GUIDELINE_MISSING" }>
  | Readonly<{ status: "PASSED" | "FAILED"; effectiveDpi: number; requiredWidthPx: number; requiredHeightPx: number; guideline: PlacementGuideline }>;

export function evaluateDesignResolution(
  image: Readonly<{ widthPx: number; heightPx: number }>,
  guideline?: PlacementGuideline,
): DesignResolutionResult {
  if (!guideline) return { status: "GUIDELINE_MISSING" };
  const requiredWidthPx = Math.ceil(guideline.printAreaWidthIn * guideline.targetDpi);
  const requiredHeightPx = Math.ceil(guideline.printAreaHeightIn * guideline.targetDpi);
  const effectiveDpi = Math.floor(Math.min(image.widthPx / guideline.printAreaWidthIn, image.heightPx / guideline.printAreaHeightIn) * 100) / 100;
  return {
    status: image.widthPx >= requiredWidthPx && image.heightPx >= requiredHeightPx ? "PASSED" : "FAILED",
    effectiveDpi, requiredWidthPx, requiredHeightPx, guideline,
  };
}

export function validateMockupStyleSelection(selected: readonly number[], allowed: readonly number[]): "PASSED" | "GUIDANCE_MISSING" | "MISMATCH" {
  if (allowed.length === 0) return "GUIDANCE_MISSING";
  return selected.every((id) => allowed.includes(id)) ? "PASSED" : "MISMATCH";
}
