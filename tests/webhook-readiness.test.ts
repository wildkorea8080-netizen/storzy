import { describe,expect,it } from "vitest";
import { webhookReadinessFromEnv } from "../src/integrations/webhook-readiness.js";

describe("webhook readiness",()=>{
  it("returns public endpoints and readiness without exposing secrets",()=>{
    const result=webhookReadinessFromEnv({PUBLIC_APP_URL:"https://app.storzy.example",SHOPIFY_WEBHOOK_SECRET:"shop-secret",SHOPIFY_ORDER_WORKSPACE_ID:"workspace-1",PRINTFUL_WEBHOOK_SECRET_HEX:"aa".repeat(32),PRINTFUL_WEBHOOK_PUBLIC_KEY:"public-key",PRINTFUL_STORE_ID:"42"},"workspace-1");
    expect(result.shopify).toMatchObject({ready:true,endpoint:"https://app.storzy.example/webhooks/shopify/orders",checks:{publicUrl:true,signatureVerification:true,workspaceTarget:true},missing:[]});
    expect(result.printful).toMatchObject({ready:true,endpoint:"https://app.storzy.example/webhooks/printful"});
    expect(JSON.stringify(result)).not.toContain("shop-secret");
    expect(JSON.stringify(result)).not.toContain("aa".repeat(32));
  });
  it("rejects plain HTTP outside preview and detects a mismatched workspace",()=>{
    const result=webhookReadinessFromEnv({PUBLIC_APP_URL:"http://example.com",SHOPIFY_WEBHOOK_SECRET:"secret",SHOPIFY_ORDER_WORKSPACE_ID:"another"},"workspace-1");
    expect(result.shopify).toMatchObject({ready:false,endpoint:null,checks:{publicUrl:false,signatureVerification:true,workspaceTarget:false}});
    expect(result.shopify.missing).toEqual(["PUBLIC_APP_URL (공개 HTTPS)","Shopify 저장 연결 또는 SHOPIFY_ORDER_WORKSPACE_ID"]);
  });
  it("shows a localhost preview endpoint without marking it as publicly reachable",()=>{
    const result=webhookReadinessFromEnv({PREVIEW_MODE:"1"},"workspace-1");
    expect(result.shopify.endpoint).toBe("http://localhost:3000/webhooks/shopify/orders");
    expect(result.shopify.checks.publicUrl).toBe(false);
    expect(result.shopify.ready).toBe(false);
    expect(result.shopify.missing).toContain("PUBLIC_APP_URL (공개 HTTPS)");
  });
  it("rejects HTTPS loopback hosts as public webhook endpoints",()=>{expect(webhookReadinessFromEnv({PUBLIC_APP_URL:"https://localhost:3000"},"workspace-1").shopify.checks.publicUrl).toBe(false)});
  it("accepts an encrypted stored Printful connection as the workspace target",()=>{const result=webhookReadinessFromEnv({PUBLIC_APP_URL:"https://app.storzy.example",PRINTFUL_WEBHOOK_SECRET_HEX:"aa".repeat(32),PRINTFUL_WEBHOOK_PUBLIC_KEY:"public-key"},"workspace-1",false,true);expect(result.printful).toMatchObject({ready:true,checks:{publicUrl:true,signatureVerification:true,workspaceTarget:true},missing:[]});expect(result.shopify.checks.workspaceTarget).toBe(false)});
  it("describes both supported Printful workspace target sources",()=>{expect(webhookReadinessFromEnv({},"workspace-1").printful.missing).toContain("Printful 저장 연결 또는 PRINTFUL_STORE_ID")});
  it("treats the public-key allowlist as optional defense in depth",()=>{const result=webhookReadinessFromEnv({PUBLIC_APP_URL:"https://app.storzy.example",PRINTFUL_WEBHOOK_SECRET_HEX:"aa".repeat(32)},"workspace-1",false,true);expect(result.printful.ready).toBe(true);expect(result.printful.missing).not.toContain("PRINTFUL_WEBHOOK_PUBLIC_KEY")});
  it("rejects malformed or short Printful HMAC secrets",()=>{for(const secret of ['zz'.repeat(32),'aa','abc']){const result=webhookReadinessFromEnv({PUBLIC_APP_URL:"https://app.storzy.example",PRINTFUL_WEBHOOK_SECRET_HEX:secret},"workspace-1",false,true);expect(result.printful.checks.signatureVerification).toBe(false);expect(result.printful.missing).toContain("PRINTFUL_WEBHOOK_SECRET_HEX (최소 32바이트 hex)")}});
});
