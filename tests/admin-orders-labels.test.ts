import { describe, expect, it } from "vitest";
import { ordersHtml, ordersJs } from "../src/admin/orders-page.js";

describe("주문 운영 한국어 UX", () => {
  it("주문부터 배송까지 3단계 흐름을 표시한다", () => {
    expect(ordersHtml).toContain("1. Shopify 주문 검증");
    expect(ordersHtml).toContain("2. Printful 제작 요청");
    expect(ordersHtml).toContain("3. Shopify 배송 반영");
    expect(ordersJs).toContain("renderFlow");
  });

  it("주문 상태와 자동 중단 사유를 한국어로 변환한다", () => {
    expect(ordersJs).toContain("HELD:'자동 처리 중단'");
    expect(ordersJs).toContain("COST_SPIKE:'공급 원가 급등'");
    expect(ordersJs).toContain("MISSING_DESIGN:'디자인 파일 누락'");
    expect(ordersJs).toContain("UNSUPPORTED_COUNTRY:'배송 불가 국가'");
  });

  it("수동 처리의 책임과 사유 입력을 안내한다", () => {
    expect(ordersHtml).toContain("결정 근거를 반드시 기록");
    expect(ordersHtml).toContain("수동 승인 후 재개");
    expect(ordersJs).toContain("처리 사유를 입력해 주세요.");
  });
});
