import{describe,expect,it}from"vitest";
import{privacyMaintenanceCss,privacyMaintenanceJs}from"../src/admin/privacy-maintenance-ui.js";

describe("개인정보 자동 정리 UI",()=>{
  it("보호된 운영 요약과 사건 전송 상태를 한국어로 표시한다",()=>{for(const value of["/api/admin/privacy-maintenance/summary","/retry-delivery","개인정보 자동 정리","최근 24시간 익명화","처리 기한 경과 대기","Authorization:'Bearer '","SLA_SCAN_FAILED:'개인정보 SLA 점검 실패'","SENT:'전송 완료'","delivery.attempts","재전송 사유를 입력하세요."])expect(privacyMaintenanceJs).toContain(value);expect(privacyMaintenanceJs).toContain("STALE:'실행 지연'");expect(()=>new Function(privacyMaintenanceJs)).not.toThrow();});
  it("상태별 색상과 반응형 사건 배치를 제공한다",()=>{expect(privacyMaintenanceCss).toContain(".privacy-maintenance-state.HEALTHY");expect(privacyMaintenanceCss).toContain(".privacy-maintenance-state.FAILED");expect(privacyMaintenanceCss).toContain(".privacy-maintenance-delivery.SENT");expect(privacyMaintenanceCss).toContain(".privacy-maintenance-retry");expect(privacyMaintenanceCss).toContain("@media(max-width:720px)");});
});
