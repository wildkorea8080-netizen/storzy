import { describe, expect, it } from "vitest";
import { designsHtml, designsJs } from "../src/admin/designs-page.js";

describe("디자인 업로드 사용량 UI", () => {
  it("현재 파일 수와 저장 용량을 조회하고 표시한다", () => {
    expect(designsHtml).toContain('id="upload-usage"');
    expect(designsJs).toContain("async function loadUploadUsage()");
    expect(designsJs).toContain("u.fileCount+' / '+u.maxFiles");
    expect(designsJs).toContain("formatBytes(u.sizeBytes)");
  });

  it("패널을 열거나 업로드가 끝나면 사용량을 갱신한다", () => {
    expect((designsJs.match(/loadUploadUsage\(\)/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(designsJs).toContain("업로드 완료';await loadUploadUsage()");
  });
});
