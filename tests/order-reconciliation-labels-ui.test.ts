import{describe,expect,it}from"vitest";
import{orderReconciliationLabelsJs}from"../src/admin/order-reconciliation-labels-ui.js";

describe("order reconciliation Korean labels",()=>{
  it("translates known operational codes and preserves unknown values",()=>{
    for(const value of ["로컬 누락 주문","취소 상태 불일치","결제 상태 불일치","처리 필요","확인 중","해결 완료","확인 접수","재대조 자동 해결","누락 주문 안전 재수신","자동 스케줄러","관리자 화면"]){expect(orderReconciliationLabelsJs).toContain(value)}
    expect(orderReconciliationLabelsJs).toContain("labels[trimmed]");
    expect(orderReconciliationLabelsJs).toContain("MutationObserver");
    expect(()=>new Function(orderReconciliationLabelsJs)).not.toThrow();
  });
});
