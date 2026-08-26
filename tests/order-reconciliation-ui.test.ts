import{describe,expect,it}from"vitest";
import{orderReconciliationCss,orderReconciliationJs}from"../src/admin/order-reconciliation-ui.js";

describe("order reconciliation UI",()=>{
  it("runs comparison and records manual issue decisions",()=>{
    for(const value of ["/order-reconciliation","#reconciliation-actor","actorId:operator()","/schedule-status","/schedule-history?limit=20","현재 워크스페이스 다시 대조","상품 제작이나 주문 제출은 실행하지 않습니다","주기 실행","마지막 주기 대조","workspace_result","/history?limit=50","처리 이력","ACKNOWLEDGE","RESOLVE","sync-cancellation","sync-financial-status","결제 상태 반영","취소 상태 반영","안전 재수신","Printful에는 전송되지 않습니다","'Idempotency-Key':crypto.randomUUID()","result.issues"]){expect(orderReconciliationJs).toContain(value)}
    expect(orderReconciliationCss).toContain(".audit-list");
    expect(()=>new Function(orderReconciliationJs)).not.toThrow();
  });
});
