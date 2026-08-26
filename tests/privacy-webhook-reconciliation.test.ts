import{readFileSync}from"node:fs";
import{describe,expect,it,vi}from"vitest";
import{privacyWebhookJs}from"../src/admin/privacy-webhook-ui.js";
import{PrivacyRequestService}from"../src/privacy/request-service.js";

describe("privacy webhook workspace reconciliation",()=>{
  it("atomically assigns only null-workspace records matching the connected domain",async()=>{const calls:string[]=[],query=vi.fn(async(sql:string)=>{calls.push(sql);if(sql.startsWith("WITH updated"))return{rows:[{request_id:"request-1"}],rowCount:1};if(sql.startsWith("UPDATE shopify_privacy_webhook_receipts"))return{rows:[],rowCount:2};return{rows:[],rowCount:null}}),client={query,release:vi.fn()},service=new PrivacyRequestService({connect:vi.fn(async()=>client)}as never);await expect(service.reconcileWebhookWorkspace({workspaceId:"workspace-1",shopDomain:"Store.MyShopify.com",actorId:"admin-ui"})).resolves.toEqual({workspaceId:"workspace-1",shopDomain:"store.myshopify.com",reconciledRequests:1,reconciledReceipts:2});expect(calls.join(" ")).toContain("workspace_id IS NULL");expect(calls.join(" ")).toContain("RECONCILE_WORKSPACE");expect(query).toHaveBeenCalledWith("COMMIT")});
  it("exposes the reviewed admin action",()=>{expect(privacyWebhookJs).toContain("미연결 요청 다시 연결");expect(privacyWebhookJs).toContain("privacy-webhook-receipts/reconcile");expect(privacyWebhookJs).toContain("actorId:'admin-ui'");expect(()=>new Function(privacyWebhookJs)).not.toThrow()});
  it("extends the privacy action constraint",()=>{const sql=readFileSync(new URL("../migrations/067_privacy_request_workspace_reconciliation.sql",import.meta.url),"utf8");expect(sql).toContain("RECONCILE_WORKSPACE")});
});
