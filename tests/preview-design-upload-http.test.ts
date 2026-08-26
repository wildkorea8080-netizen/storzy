import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryBrandProfileStore } from "../src/brand/memory-store.js";
import { BrandProfileService } from "../src/brand/service.js";
import { createApp } from "../src/http/app.js";
import { PreviewDesignUploadService } from "../src/mockups/preview-upload-service.js";
import { designsHtml, designsJs } from "../src/admin/designs-page.js";

const servers: ReturnType<typeof createServer>[] = [];
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width); view.setUint32(20, height);
  return bytes;
}

async function start() {
  const directory = await mkdtemp(join(tmpdir(), "storzy-http-upload-"));
  directories.push(directory);
  const uploads = new PreviewDesignUploadService(directory);
  const brand = new BrandProfileService(new MemoryBrandProfileStore());
  const workspace = await brand.createWorkspace({ name: "Upload test", actorId: "test" });
  const app = createApp(brand, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, "secret", undefined, undefined, undefined, undefined, uploads);
  const server = createServer(app); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, workspaceId: workspace.id };
}

describe("미리보기 디자인 업로드 HTTP 연결", () => {
  it("관리자 인증 후 바이너리를 업로드하고 다시 제공한다", async () => {
    const { base, workspaceId } = await start();
    const path = `/api/workspaces/${workspaceId}/design-uploads`;
    expect((await fetch(base + path, { method: "POST", headers: { "Content-Type": "image/png" }, body: png(3000, 3000) })).status).toBe(401);
    const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "image/png", Authorization: "Bearer secret" }, body: png(3000, 3000) });
    expect(response.status).toBe(201);
    const body = await response.json() as { data: { fileUrl: string; widthPx: number; heightPx: number } };
    expect(body.data).toMatchObject({ widthPx: 3000, heightPx: 3000 });
    expect(body.data.fileUrl).toContain(`/uploads/${workspaceId}/`);
    const localPath = new URL(body.data.fileUrl).pathname.replace("/uploads/", "/preview-assets/uploads/");
    const asset = await fetch(base + localPath);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await asset.arrayBuffer())).toEqual(png(3000, 3000));
    const usage = await fetch(base + path, { headers: { Authorization: "Bearer secret" } });
    expect(usage.status).toBe(200);
    await expect(usage.json()).resolves.toMatchObject({ data: { fileCount: 1, sizeBytes: 24, maxFiles: 100, maxBytes: 524288000 } });
    const foreignPath = localPath.replace(workspaceId, "00000000-0000-0000-0000-000000000000");
    expect((await fetch(base + foreignPath)).status).toBe(404);
  });

  it("존재하지 않는 워크스페이스는 업로드 전에 거절한다", async () => {
    const { base } = await start();
    const response = await fetch(base + "/api/workspaces/missing-workspace/design-uploads", { method: "POST", headers: { "Content-Type": "image/png", Authorization: "Bearer secret" }, body: png(100, 100) });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("디자인 화면에서 명시적 파일 선택과 업로드를 제공한다", () => {
    expect(designsHtml).toContain('type="file"');
    expect(designsHtml).toContain('accept="image/png,image/jpeg"');
    expect(designsHtml).toContain("선택한 파일 업로드");
    expect(designsJs).toContain("/design-uploads");
    expect(designsJs).toContain("body:file");
  });
});
