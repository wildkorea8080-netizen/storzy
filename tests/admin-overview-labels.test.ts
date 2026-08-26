import { describe, expect, it } from "vitest";
import { overviewHtml, overviewJs } from "../src/admin/overview-page.js";

describe("운영 현황 한국어 상태 표현", () => {
  it("파이프라인 상태를 한국어 칩으로 표시한다", () => {
    expect(overviewHtml).toContain("각 단계의 현재 상태");
    expect(overviewJs).toContain("APPROVED:'승인'");
    expect(overviewJs).toContain("SUCCEEDED:'완료'");
    expect(overviewJs).toContain("FAILED:'실패'");
    expect(overviewJs).toContain("stateChips");
  });

  it("알림 종류와 주문 사유를 운영자 문구로 변환한다", () => {
    expect(overviewJs).toContain("ORDER:'주문 예외'");
    expect(overviewJs).toContain("PRINTFUL_MOCKUP:'Printful 목업'");
    expect(overviewJs).toContain("COST_SPIKE:'공급 원가 급등'");
    expect(overviewJs).toContain("alertMessage");
  });

  it("확인할 문제가 없으면 정상 상태를 안내한다", () => {
    expect(overviewJs).toContain("모든 자동화 정상");
    expect(overviewHtml).toContain("자동화가 중단되거나 실패한 작업만 표시");
  });
});
