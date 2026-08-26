import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PreviewDesignUploadService } from "../src/mockups/preview-upload-service.js";

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))));

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

async function service(): Promise<PreviewDesignUploadService> {
  const directory = await mkdtemp(join(tmpdir(), "storzy-upload-"));
  directories.push(directory);
  return new PreviewDesignUploadService(directory);
}

describe("미리보기 디자인 업로드 저장소", () => {
  it("PNG를 검증하고 추측 불가능한 URL로 저장한다", async () => {
    const uploads = await service();
    const result = await uploads.save("workspace-1", png(3000, 3000), "image/png");
    expect(result).toMatchObject({ workspaceId: "workspace-1", mimeType: "image/png", widthPx: 3000, heightPx: 3000, sizeBytes: 24 });
    expect(result.fileUrl).toMatch(/^https:\/\/preview-assets[.]storzy[.]local\/uploads\/workspace-1\/[0-9a-f-]{36}[.]png$/);
    await expect(uploads.read("workspace-1", `${result.id}.png`)).resolves.toEqual(Buffer.from(png(3000, 3000)));
    await expect(uploads.read("workspace-2", `${result.id}.png`)).resolves.toBeNull();
    await expect(uploads.inspect(result.fileUrl)).resolves.toMatchObject({ widthPx: 3000, heightPx: 3000, mimeType: "image/png" });
  });

  it("MIME 위장과 과도한 픽셀 크기를 거절한다", async () => {
    const uploads = await service();
    await expect(uploads.save("workspace-1", new TextEncoder().encode("not png"), "image/png")).rejects.toThrow("형식이 일치하지 않습니다");
    await expect(uploads.save("workspace-1", png(20_001, 100), "image/png")).rejects.toThrow("20,000픽셀");
    await expect(uploads.save("workspace-1", png(100, 100), "image/gif")).rejects.toThrow("PNG 또는 JPEG");
  });

  it("경로 탐색과 존재하지 않는 파일을 노출하지 않는다", async () => {
    const uploads = await service();
    await expect(uploads.read("workspace-1", "../secret.png")).resolves.toBeNull();
    await expect(uploads.read("workspace-1", "00000000-0000-0000-0000-000000000000.png")).resolves.toBeNull();
    await expect(uploads.read("../escape", "00000000-0000-0000-0000-000000000000.png")).rejects.toThrow("워크스페이스 ID");
  });
});
