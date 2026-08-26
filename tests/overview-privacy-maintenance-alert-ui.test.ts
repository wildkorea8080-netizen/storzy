import{describe,expect,it}from"vitest";
import{overviewPrivacyMaintenanceAlertCss,overviewPrivacyMaintenanceAlertJs}from"../src/admin/overview-privacy-maintenance-alert-ui.js";

describe("관리자 홈 개인정보 자동 정리 경보",()=>{
  it("실패·지연·기한 경과 상태만 관리자 홈에 노출한다",()=>{for(const value of["/api/admin/privacy-maintenance/summary","FAILED","STALE","pendingExpired","개인정보 운영 열기","Authorization:'Bearer '"])expect(overviewPrivacyMaintenanceAlertJs).toContain(value);expect(overviewPrivacyMaintenanceAlertJs).toContain("panel.hidden=!attention");expect(()=>new Function(overviewPrivacyMaintenanceAlertJs)).not.toThrow();});
  it("주의와 위험 상태를 구분하고 모바일에서도 동작한다",()=>{expect(overviewPrivacyMaintenanceAlertCss).toContain('[data-level="danger"]');expect(overviewPrivacyMaintenanceAlertCss).toContain("@media(max-width:680px)");});
});
