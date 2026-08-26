import { deflateSync } from "node:zlib";

export type Point = Readonly<{ x: number; y: number }>;

export type MarkSegment =
  | Readonly<{ kind: "line"; a: Point; b: Point }>
  | Readonly<{ kind: "cubic"; p0: Point; p1: Point; p2: Point; p3: Point }>;

export type MarkGeometry = Readonly<{
  viewBoxWidth: number;
  viewBoxHeight: number;
  strokeWidth: number;
  segments: readonly MarkSegment[];
}>;

export type Rgb = Readonly<{ r: number; g: number; b: number }>;

function mirror(point: Point): Point {
  return { x: SEOUL_SIDE_VIEWBOX_WIDTH - point.x, y: point.y };
}

const SEOUL_SIDE_VIEWBOX_WIDTH = 1000;

/**
 * 지붕은 좌측 절반만 정의하고 우측은 세로 중심선 기준으로 대칭 복제한다.
 * 능선(apex)에서 처마 끝(tip)까지 두 구간으로 나뉘며, 두 번째 구간이 끝에서 위로 올라가는 처마를 만든다.
 */
const APEX: Point = { x: 500, y: 168 };
const APEX_CONTROL_1: Point = { x: 424, y: 194 };
const APEX_CONTROL_2: Point = { x: 332, y: 230 };
const EAVE: Point = { x: 248, y: 252 };
const EAVE_CONTROL_1: Point = { x: 190, y: 266 };
const EAVE_CONTROL_2: Point = { x: 118, y: 268 };
const TIP: Point = { x: 58, y: 206 };

/**
 * Seoul Side Studio 심볼 마크. 처마가 위로 올라가는 지붕과 세로 획 5개로 구성한다.
 * 좌표는 1000x700 viewBox 기준이며 모든 획은 round cap·join으로 렌더링한다.
 */
export const SEOUL_SIDE_MARK: MarkGeometry = {
  viewBoxWidth: SEOUL_SIDE_VIEWBOX_WIDTH,
  viewBoxHeight: 700,
  strokeWidth: 26,
  segments: [
    { kind: "cubic", p0: mirror(TIP), p1: mirror(EAVE_CONTROL_2), p2: mirror(EAVE_CONTROL_1), p3: mirror(EAVE) },
    { kind: "cubic", p0: mirror(EAVE), p1: mirror(APEX_CONTROL_2), p2: mirror(APEX_CONTROL_1), p3: APEX },
    { kind: "cubic", p0: APEX, p1: APEX_CONTROL_1, p2: APEX_CONTROL_2, p3: EAVE },
    { kind: "cubic", p0: EAVE, p1: EAVE_CONTROL_1, p2: EAVE_CONTROL_2, p3: TIP },
    { kind: "line", a: { x: 256, y: 322 }, b: { x: 256, y: 500 } },
    { kind: "line", a: { x: 378, y: 322 }, b: { x: 378, y: 546 } },
    { kind: "line", a: { x: 500, y: 322 }, b: { x: 500, y: 592 } },
    { kind: "line", a: { x: 622, y: 322 }, b: { x: 622, y: 546 } },
    { kind: "line", a: { x: 744, y: 322 }, b: { x: 744, y: 500 } },
  ],
} as const;

export const BRAND_NAVY: Rgb = { r: 0x0d, g: 0x1b, b: 0x33 };
export const BRAND_IVORY: Rgb = { r: 0xf6, g: 0xf4, b: 0xef };

/** 곡선을 직선 구간으로 근사한다. 장치 좌표 기준 약 2px 간격이면 4500px 출력에서 계단이 보이지 않는다. */
function flatten(segment: MarkSegment, scale: number): readonly Point[] {
  if (segment.kind === "line") return [segment.a, segment.b];
  const { p0, p1, p2, p3 } = segment;
  const controlLength =
    distance(p0, p1) + distance(p1, p2) + distance(p2, p3);
  const steps = Math.max(8, Math.ceil((controlLength * scale) / 2));
  const points: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    points.push({
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    });
  }
  return points;
}

function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 획을 거리장(distance field)으로 래스터화한다. 선분까지의 거리가 반지름 이하인 픽셀을 채우므로
 * round cap과 round join이 별도 처리 없이 생긴다. 픽셀 전체를 순회하지 않고 각 선분의
 * 경계 상자만 훑어 4500x3150에서도 즉시 끝난다.
 */
export function rasterizeCoverage(
  geometry: MarkGeometry,
  widthPx: number,
  heightPx: number,
): Uint8Array {
  const scale = widthPx / geometry.viewBoxWidth;
  const radius = (geometry.strokeWidth * scale) / 2;
  const coverage = new Uint8Array(widthPx * heightPx);

  for (const segment of geometry.segments) {
    const points = flatten(segment, scale);
    for (let i = 0; i + 1 < points.length; i += 1) {
      const start = points[i]!;
      const end = points[i + 1]!;
      const ax = start.x * scale;
      const ay = start.y * scale;
      const bx = end.x * scale;
      const by = end.y * scale;

      const minX = Math.max(0, Math.floor(Math.min(ax, bx) - radius - 1));
      const maxX = Math.min(widthPx - 1, Math.ceil(Math.max(ax, bx) + radius + 1));
      const minY = Math.max(0, Math.floor(Math.min(ay, by) - radius - 1));
      const maxY = Math.min(heightPx - 1, Math.ceil(Math.max(ay, by) + radius + 1));

      const dx = bx - ax;
      const dy = by - ay;
      const lengthSquared = dx * dx + dy * dy;

      for (let y = minY; y <= maxY; y += 1) {
        const py = y + 0.5;
        const rowOffset = y * widthPx;
        for (let x = minX; x <= maxX; x += 1) {
          const px = x + 0.5;
          let t = lengthSquared > 0 ? ((px - ax) * dx + (py - ay) * dy) / lengthSquared : 0;
          if (t < 0) t = 0;
          else if (t > 1) t = 1;
          const qx = ax + t * dx;
          const qy = ay + t * dy;
          const ex = px - qx;
          const ey = py - qy;
          const dist = Math.sqrt(ex * ex + ey * ey);
          const alpha = radius + 0.5 - dist;
          if (alpha <= 0) continue;
          const value = alpha >= 1 ? 255 : Math.round(alpha * 255);
          const index = rowOffset + x;
          if (value > coverage[index]!) coverage[index] = value;
        }
      }
    }
  }
  return coverage;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, payload: Uint8Array): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length, 0);
  header.write(type, 4, "ascii");
  const crcInput = Buffer.concat([header.subarray(4, 8), payload]);
  const trailer = Buffer.alloc(4);
  trailer.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([header, payload, trailer]);
}

/** 8-bit RGBA(color type 6) PNG을 만든다. 알파는 곱해지지 않은 값이므로 색상 fringe가 생기지 않는다. */
export function encodeRgbaPng(rgba: Uint8Array, widthPx: number, heightPx: number): Buffer {
  const stride = widthPx * 4;
  const raw = Buffer.alloc(heightPx * (stride + 1));
  for (let y = 0; y < heightPx; y += 1) {
    const target = y * (stride + 1);
    raw[target] = 0;
    raw.set(rgba.subarray(y * stride, y * stride + stride), target + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(widthPx, 0);
  ihdr.writeUInt32BE(heightPx, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

export type MarkRenderOptions = Readonly<{
  widthPx: number;
  color?: Rgb;
  geometry?: MarkGeometry;
}>;

/** 투명 배경 위에 지정 색으로 심볼 마크를 그린 PNG을 반환한다. 높이는 viewBox 비율을 따른다. */
export function renderMarkPng(options: MarkRenderOptions): Readonly<{ png: Buffer; widthPx: number; heightPx: number }> {
  const geometry = options.geometry ?? SEOUL_SIDE_MARK;
  const color = options.color ?? BRAND_NAVY;
  const widthPx = Math.round(options.widthPx);
  if (!Number.isSafeInteger(widthPx) || widthPx <= 0) throw new Error("Mark width must be a positive integer");
  const heightPx = Math.round((widthPx * geometry.viewBoxHeight) / geometry.viewBoxWidth);

  const coverage = rasterizeCoverage(geometry, widthPx, heightPx);
  const rgba = new Uint8Array(widthPx * heightPx * 4);
  for (let i = 0; i < coverage.length; i += 1) {
    const offset = i * 4;
    rgba[offset] = color.r;
    rgba[offset + 1] = color.g;
    rgba[offset + 2] = color.b;
    rgba[offset + 3] = coverage[i]!;
  }
  return { png: encodeRgbaPng(rgba, widthPx, heightPx), widthPx, heightPx };
}

function formatPoint(point: Point): string {
  return `${point.x},${point.y}`;
}

/** 동일 기하 정의에서 SVG 원본을 만든다. 래스터 출력과 벡터 원본이 어긋나지 않게 한 곳에서 생성한다. */
export function renderMarkSvg(geometry: MarkGeometry = SEOUL_SIDE_MARK, color = "#0D1B33"): string {
  const parts: string[] = [];
  let path = "";
  for (const segment of geometry.segments) {
    if (segment.kind === "cubic") {
      if (path === "") path = `M ${formatPoint(segment.p0)}`;
      path += ` C ${formatPoint(segment.p1)} ${formatPoint(segment.p2)} ${formatPoint(segment.p3)}`;
    } else {
      parts.push(`<line x1="${segment.a.x}" y1="${segment.a.y}" x2="${segment.b.x}" y2="${segment.b.y}"/>`);
    }
  }
  const lines = parts.map((line) => `    ${line}`).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geometry.viewBoxWidth} ${geometry.viewBoxHeight}">
  <g fill="none" stroke="${color}" stroke-width="${geometry.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${path}"/>
${lines}
  </g>
</svg>
`;
}
