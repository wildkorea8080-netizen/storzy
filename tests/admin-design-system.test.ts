import { describe, expect, it } from "vitest";
import { adminAuthSessionJs, adminKoreanJs, adminShellJs, adminSystemCss, decorateAdminHtml } from "../src/admin/design-system.js";

describe("admin design system", () => {
  it("adds consistent navigation and marks the current page", () => {
    const html=decorateAdminHtml("<html><head></head><body><main></main></body></html>","/admin/catalog");
    expect(html).toContain('/admin/assets/system.css');
    expect(html).toContain('aria-label="주요 메뉴"');
    expect(html).toContain('<a href="/admin/catalog" class="active" aria-current="page">상품</a>');
    expect(html).toContain('/admin/assets/i18n-ko.js');
    expect(html).toContain('/admin/assets/shell.js');
    expect(html).toContain('/admin/assets/auth-session.js');
    expect(html.match(/class="active"/g)).toHaveLength(1);
  });
  it("upgrades UUID fields with an authenticated workspace directory",()=>{expect(adminShellJs).toContain('/api/admin/workspaces');expect(adminShellJs).toContain("datalist");expect(adminShellJs).toContain("storzy.workspace")});
  it("restores server sessions and provides logout and expiry recovery",()=>{expect(adminAuthSessionJs).toContain("ADMIN_AUTH_REQUIRED");expect(adminAuthSessionJs).toContain("sessionStorage.removeItem(key)");expect(adminAuthSessionJs).toContain("관리자 세션이 만료되었습니다.");expect(adminAuthSessionJs).toContain("/api/auth/admin/session");expect(adminAuthSessionJs).toContain("session-logout");expect(adminSystemCss).toContain(".server-session #token")});
  it("uses cookies for server-session API calls without sending a marker bearer header",()=>{expect(adminAuthSessionJs).toContain("headers.get('Authorization')==='Bearer session'");expect(adminAuthSessionJs).toContain("headers.delete('Authorization')");expect(adminAuthSessionJs).toContain("credentials:init.credentials||'same-origin'");expect(adminAuthSessionJs).toContain("window.storzyAdminFetch=adminFetch");expect(adminSystemCss).toContain(".server-session .onboarding-auth")});
  it("localizes visible operations copy while preserving technical identifiers",()=>{
    expect(adminKoreanJs).toContain("스토어 운영 현황");
    expect(adminKoreanJs).toContain("관리자 API 토큰");
    expect(adminKoreanJs).toContain("Printful");
    expect(adminKoreanJs).toContain("JSON");
  });
  it("provides responsive tokens and visible focus treatment", () => {
    expect(adminSystemCss).toContain("--acid:#c9f135");
    expect(adminSystemCss).toContain("input:focus");
    expect(adminSystemCss).toContain("@media(max-width:620px)");
  });
});
