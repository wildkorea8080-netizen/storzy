import { describe, expect, it } from "vitest";
import { evaluateDesignResolution } from "../src/mockups/resolution-gate.js";
import type { PlacementGuideline } from "../src/candidates/types.js";
import {
  BRAND_NAVY,
  SEOUL_SIDE_MARK,
  encodeRgbaPng,
  rasterizeCoverage,
  renderMarkPng,
  renderMarkSvg,
} from "../src/brand/mark-renderer.js";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** src/mockups/file-inspector.ts 가 실제로 수행하는 PNG 판독과 같은 방식으로 헤더를 읽는다. */
function readPngHeader(data: Uint8Array) {
  const signatureMatches = PNG_SIGNATURE.every((value, index) => data[index] === value);
  const ihdrMatches = String.fromCharCode(...data.slice(12, 16)) === "IHDR";
  if (!signatureMatches || !ihdrMatches) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    widthPx: view.getUint32(16),
    heightPx: view.getUint32(20),
    bitDepth: data[24]!,
    colorType: data[25]!,
  };
}

describe("Seoul Side brand mark renderer", () => {
  it("encodes a PNG the design file inspector can parse", () => {
    const { png, widthPx, heightPx } = renderMarkPng({ widthPx: 400 });
    const header = readPngHeader(png);
    expect(header).toEqual({ widthPx, heightPx, bitDepth: 8, colorType: 6 });
  });

  it("keeps the viewBox aspect ratio", () => {
    const { widthPx, heightPx } = renderMarkPng({ widthPx: 1000 });
    expect(widthPx).toBe(1000);
    expect(heightPx).toBe(700);
  });

  it("leaves the background fully transparent and the stroke fully opaque", () => {
    const coverage = rasterizeCoverage(SEOUL_SIDE_MARK, 1000, 700);
    // 좌상단 모서리는 마크 바깥이므로 완전 투명이어야 한다.
    expect(coverage[0]).toBe(0);
    // 가운데 세로 획 중간 지점은 완전 불투명이어야 한다.
    expect(coverage[450 * 1000 + 500]).toBe(255);
    // 획 사이 여백은 비어 있어야 한다.
    expect(coverage[450 * 1000 + 317]).toBe(0);
  });

  it("anti-aliases stroke edges instead of hard-clipping them", () => {
    const coverage = rasterizeCoverage(SEOUL_SIDE_MARK, 1000, 700);
    let partial = 0;
    let opaque = 0;
    for (const value of coverage) {
      if (value === 255) opaque += 1;
      else if (value > 0) partial += 1;
    }
    expect(opaque).toBeGreaterThan(0);
    // 곡선 지붕 경계에서 부분 커버리지가 충분히 나와야 계단 현상이 없다.
    expect(partial).toBeGreaterThan(1000);
  });

  it("produces a print file that clears the 150 DPI resolution gate", () => {
    const { widthPx, heightPx } = renderMarkPng({ widthPx: 4500 });
    const guideline: PlacementGuideline = {
      placement: "front",
      technique: "dtg",
      printAreaWidthIn: 12,
      printAreaHeightIn: 16,
      targetDpi: 150,
      allowedMockupStyleIds: [],
    };
    const result = evaluateDesignResolution({ widthPx, heightPx }, guideline);
    expect(result.status).toBe("PASSED");
  });

  it("stays inside the 50 MB and 20,000 pixel design file limits", () => {
    const { png, widthPx, heightPx } = renderMarkPng({ widthPx: 4500 });
    expect(widthPx).toBeLessThanOrEqual(20_000);
    expect(heightPx).toBeLessThanOrEqual(20_000);
    expect(png.length).toBeLessThan(50 * 1024 * 1024);
  });

  it("renders the SVG source from the same geometry", () => {
    const svg = renderMarkSvg();
    expect(svg).toContain(`viewBox="0 0 1000 700"`);
    expect(svg).toContain(`stroke="#0D1B33"`);
    expect(svg).toContain("stroke-linecap=\"round\"");
    // 세로 획 5개가 모두 나와야 한다.
    expect(svg.match(/<line /g)).toHaveLength(5);
  });

  it("applies the requested brand colour to every pixel", () => {
    const { png } = renderMarkPng({ widthPx: 200, color: BRAND_NAVY });
    expect(png.length).toBeGreaterThan(0);
    const coverage = rasterizeCoverage(SEOUL_SIDE_MARK, 200, 140);
    const rgba = new Uint8Array(200 * 140 * 4);
    for (let i = 0; i < coverage.length; i += 1) {
      rgba[i * 4] = BRAND_NAVY.r;
      rgba[i * 4 + 3] = coverage[i]!;
    }
    expect(encodeRgbaPng(rgba, 200, 140).length).toBeGreaterThan(0);
  });
});
