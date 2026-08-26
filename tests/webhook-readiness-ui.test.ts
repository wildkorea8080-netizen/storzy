import { describe,expect,it } from "vitest";
import { webhookReadinessCss,webhookReadinessJs } from "../src/admin/webhook-readiness-ui.js";

describe("webhook readiness UI",()=>{
  it("renders endpoint and non-secret verification checks",()=>{
    expect(webhookReadinessJs).toContain("/integrations/webhook-readiness");
    expect(webhookReadinessJs).toContain("공개 HTTPS 주소");
    expect(webhookReadinessJs).toContain("서명 검증");
    expect(webhookReadinessJs).toContain("item.provider.toLowerCase()");
    expect(webhookReadinessJs).toContain("'/webhooks/sync'");
    expect(webhookReadinessJs).toContain("startsWith('https://')");
    expect(webhookReadinessJs).not.toContain("WEBHOOK_SECRET");
    expect(webhookReadinessCss).toContain(".webhook-url");
    expect(()=>new Function(webhookReadinessJs)).not.toThrow();
  });
});
