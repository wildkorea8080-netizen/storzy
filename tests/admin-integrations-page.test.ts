import { describe, expect, it } from "vitest";
import { integrationsCss, integrationsHtml, integrationsJs } from "../src/admin/integrations-page.js";
import { integrationsTestCss, integrationsTestJs } from "../src/admin/integrations-test-ui.js";
import { shopifyConnectCss, shopifyConnectJs } from "../src/admin/shopify-connect-ui.js";
import { printfulConnectCss, printfulConnectJs } from "../src/admin/printful-connect-ui.js";
import { pilotReadinessCss, pilotReadinessJs } from "../src/admin/pilot-readiness-ui.js";

describe("관리자 연동 설정 화면",()=>{
  it("Shopify와 Printful 연결 준비 상태를 한국어로 제공한다",()=>{
    expect(integrationsHtml).toContain("외부 서비스 연동");
    expect(integrationsHtml).toContain("비밀키 원문은 화면과 API 응답에 포함하지 않습니다");
    expect(integrationsJs).toContain("/integrations");
    expect(integrationsJs).toContain("Admin GraphQL API");
    expect(integrationsJs).toContain("Printful Store 범위");
    expect(integrationsCss).toContain("@media(max-width:720px)");
    expect(()=>new Function(integrationsJs)).not.toThrow();
  });
  it("공급자별 실제 연결 테스트 결과를 카드 안에 표시한다",()=>{
    expect(integrationsTestJs).toContain("실제 연결 테스트");
    expect(integrationsTestJs).toContain("/integrations/'+provider+'/test");
    expect(integrationsTestJs).toContain("연결 확인 중…");
    expect(integrationsTestJs).toContain("d.latencyMs");
    expect(integrationsTestJs).toContain("aria-live=\"polite\"");
    expect(integrationsTestCss).toContain(".test-result.CONNECTED");
    expect(integrationsTestCss).toContain(".test-result.FAILED");
    expect(()=>new Function(integrationsTestJs)).not.toThrow();
  });
  it("Shopify 도메인을 검증하고 OAuth 시작 경로로 연결한다",()=>{
    expect(shopifyConnectJs).toContain("[.]myshopify[.]com");
    expect(shopifyConnectJs).toContain("/integrations/shopify/oauth/start");
    expect(shopifyConnectJs).toContain("/integrations/shopify/oauth/readiness");
    expect(shopifyConnectJs).toContain("서버 설정 완료 후 연결 가능");
    expect(shopifyConnectJs).toContain("target.protocol!=='https:'");
    expect(shopifyConnectJs).toContain("target.hostname!==shopDomain");
    expect(shopifyConnectJs).toContain("Shopify 연결과 암호화 저장이 완료되었습니다");
    expect(shopifyConnectCss).toContain(".shopify-connect");
    expect(shopifyConnectCss).toContain(".oauth-missing");
    expect(()=>new Function(shopifyConnectJs)).not.toThrow();
  });
  it("Printful token을 브라우저에 보존하지 않고 검증 후 등록한다",()=>{
    expect(printfulConnectJs).toContain("autocomplete=\"new-password\"");
    expect(printfulConnectJs).toContain("/integrations/printful/register");
    expect(printfulConnectJs).toContain("tokenField.value=''");
    expect(printfulConnectJs).not.toContain("localStorage.setItem");
    expect(printfulConnectJs).not.toContain("sessionStorage.setItem");
    expect(printfulConnectCss).toContain(".printful-warning");
    expect(()=>new Function(printfulConnectJs)).not.toThrow();
  });
  it("서버가 판정한 E2E 파일럿 준비 상태를 표시한다",()=>{expect(pilotReadinessJs).toContain('E2E 파일럿 준비 체크리스트');expect(pilotReadinessJs).toContain("integrations/pilot-readiness");expect(pilotReadinessJs).not.toContain("integrations/webhook-readiness");expect(pilotReadinessJs).not.toContain("admin-overview");expect(pilotReadinessJs).toContain("data.nextStep");expect(pilotReadinessCss).toContain('.pilot-steps');expect(()=>new Function(pilotReadinessJs)).not.toThrow()});
});
