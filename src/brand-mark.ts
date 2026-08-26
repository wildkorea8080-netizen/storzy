import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { BRAND_IVORY, BRAND_NAVY, renderMarkPng, renderMarkSvg } from "./brand/mark-renderer.js";

const DEFAULT_WIDTH = 4500;
const OUTPUT_DIRECTORY = "assets/brand";

function write(path: string, data: Buffer | string): void {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  const bytes = typeof data === "string" ? Buffer.byteLength(data) : data.length;
  console.log(`${path}  ${(bytes / 1024).toFixed(1)} KB`);
}

function main(): void {
  const widthArgument = process.argv[2];
  const widthPx = widthArgument ? Number(widthArgument) : DEFAULT_WIDTH;
  if (!Number.isSafeInteger(widthPx) || widthPx <= 0) {
    throw new Error(`Invalid width: ${widthArgument}`);
  }

  const navy = renderMarkPng({ widthPx, color: BRAND_NAVY });
  const ivory = renderMarkPng({ widthPx, color: BRAND_IVORY });

  console.log(`Seoul Side Studio 심볼 마크  ${navy.widthPx}x${navy.heightPx}px  투명 배경 RGBA`);
  write(`${OUTPUT_DIRECTORY}/seoul-side-mark.svg`, renderMarkSvg());
  write(`${OUTPUT_DIRECTORY}/seoul-side-mark-navy.png`, navy.png);
  write(`${OUTPUT_DIRECTORY}/seoul-side-mark-ivory.png`, ivory.png);
}

main();
