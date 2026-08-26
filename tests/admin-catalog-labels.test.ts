import { describe, expect, it } from "vitest";
import { catalogJs } from "../src/admin/catalog-page.js";

describe("상품 후보 운영자용 표기", () => {
  it("반품 안정성 점수 키를 한국어로 변환한다", () => {
    expect(catalogJs).toContain("returnSafety:'반품 안정성'");
  });

  it("부적격 후보를 결정 전 상태가 아닌 자동 제외로 표시한다", () => {
    expect(catalogJs).toContain("c.eligibility==='ELIGIBLE'?c.decisionStatus:'EXCLUDED'");
    expect(catalogJs).toContain("labelStatus('EXCLUDED')");
  });
});
