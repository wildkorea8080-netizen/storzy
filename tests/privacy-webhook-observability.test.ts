import{readFileSync}from"node:fs";
import{describe,expect,it,vi}from"vitest";
import{privacyWebhookCss,privacyWebhookJs}from"../src/admin/privacy-webhook-ui.js";
import{PrivacyRequestService}from"../src/privacy/request-service.js";

describe("privacy webhook observability",()=>{
  it("summarizes deliveries, duplicates and unmatched stores",async()=>{const query=vi.fn().mockResolvedValue({rows:[{unique_deliveries:"3",total_deliveries:"5",duplicates:"2",unmatched:"1",received_24h:"2",last_received_at:new Date("2026-08-13T00:00:00Z")}]}),service=new PrivacyRequestService({query}as never);await expect(service.webhookReceiptSummary({workspaceId:"workspace-1"})).resolves.toEqual({uniqueDeliveries:3,totalDeliveries:5,duplicates:2,unmatched:1,received24h:2,lastReceivedAt:"2026-08-13T00:00:00.000Z"});expect(query.mock.calls[0]?.[1]).toEqual(["workspace-1"])});
  it("renders an authenticated Korean operations panel",()=>{for(const text of ["Shopify 개인정보 Webhook 수신","privacy-webhook-receipts/summary","워크스페이스 미연결","Authorization:'Bearer '"])expect(privacyWebhookJs).toContain(text);expect(privacyWebhookCss).toContain(".privacy-webhook-row");expect(()=>new Function(privacyWebhookJs)).not.toThrow()});
  it("redacts receipt identifiers with shop redaction",()=>{const sql=readFileSync(new URL("../migrations/066_shopify_privacy_webhook_receipts.sql",import.meta.url),"utf8");expect(sql).toContain("BEFORE UPDATE OF status");expect(sql).toContain("webhook_id='redacted:'");expect(sql).toContain("shop_domain='redacted.invalid'")});
});
