import { describe, expect, it } from "vitest";
import { integrationStatusFromEnv, mergeStoredIntegrationStatus } from "../src/integrations/status.js";

describe("integration readiness",()=>{
  it("marks Printful webhook verification ready with a valid 32-byte HMAC secret",()=>{expect(integrationStatusFromEnv({PRINTFUL_WEBHOOK_SECRET_HEX:"aa".repeat(32)}).printful.capabilities.webhook).toBe(true);expect(integrationStatusFromEnv({PRINTFUL_WEBHOOK_SECRET_HEX:"aa"}).printful.capabilities.webhook).toBe(false)});
  it("reports complete Shopify and Printful capabilities without returning secrets",()=>{
    const result=integrationStatusFromEnv({SHOPIFY_SHOP_DOMAIN:"seoul.myshopify.com",SHOPIFY_ADMIN_ACCESS_TOKEN:"shop-secret",SHOPIFY_API_KEY:"key",SHOPIFY_API_SECRET:"api-secret",SHOPIFY_WEBHOOK_SECRET:"hook-secret",SHOPIFY_ORDER_WORKSPACE_ID:"workspace",PRINTFUL_TOKEN:"pf-secret",PRINTFUL_STORE_ID:"42",PRINTFUL_WEBHOOK_SECRET_HEX:"aa".repeat(32),PRINTFUL_WEBHOOK_PUBLIC_KEY:"public"});
    expect(result.shopify).toMatchObject({status:"CONNECTED",source:"ENVIRONMENT",accountLabel:"seoul.myshopify.com",capabilities:{oauth:true,adminApi:true,orderWebhook:true},missing:[]});
    expect(result.printful).toMatchObject({status:"CONNECTED",source:"ENVIRONMENT",accountLabel:"42",capabilities:{api:true,storeScope:true,webhook:true},missing:[]});
    expect(JSON.stringify(result)).not.toContain("shop-secret");
    expect(JSON.stringify(result)).not.toContain("pf-secret");
  });

  it("lists missing configuration and distinguishes partial setup",()=>{
    const result=integrationStatusFromEnv({SHOPIFY_SHOP_DOMAIN:"seoul.myshopify.com",PRINTFUL_TOKEN:"token"});
    expect(result.shopify.status).toBe("PARTIAL");
    expect(result.shopify.missing).toEqual(["SHOPIFY_ADMIN_ACCESS_TOKEN"]);
    expect(result.printful.status).toBe("PARTIAL");
    expect(result.printful.missing).toEqual(["PRINTFUL_STORE_ID"]);
  });
  it("prefers an encrypted workspace connection over process-wide environment credentials",()=>{
    const merged=mergeStoredIntegrationStatus(integrationStatusFromEnv({}),[{provider:"SHOPIFY",status:"CONNECTED",accountLabel:"seoul.myshopify.com"}]);
    expect(merged.shopify).toMatchObject({status:"CONNECTED",source:"WORKSPACE",accountLabel:"seoul.myshopify.com",capabilities:{oauth:true,adminApi:true},missing:[]});
    expect(merged.printful.status).toBe("NOT_CONFIGURED");
    expect(merged.printful.source).toBe("NONE");
  });
  it("reports expiring and reauthentication token health without exposing credentials",()=>{const now=new Date("2026-08-12T00:00:00Z"),expiring=mergeStoredIntegrationStatus(integrationStatusFromEnv({}),[{provider:"SHOPIFY",status:"CONNECTED",accountLabel:"seoul.myshopify.com",metadata:{tokenMode:"EXPIRING",accessTokenExpiresAt:"2026-08-12T12:00:00.000Z",refreshTokenExpiresAt:"2026-11-10T00:00:00.000Z",accessToken:"must-not-leak"}}],now);expect(expiring.shopify.tokenHealth).toMatchObject({state:"EXPIRING_SOON",mode:"EXPIRING"});expect(expiring.tokenMetrics).toEqual({reauthRequired:0,expiringSoon:1,expired:0});expect(JSON.stringify(expiring)).not.toContain("must-not-leak");const reauth=mergeStoredIntegrationStatus(integrationStatusFromEnv({SHOPIFY_ADMIN_ACCESS_TOKEN:"env-token",SHOPIFY_SHOP_DOMAIN:"fallback.myshopify.com"}),[{provider:"SHOPIFY",status:"REAUTH_REQUIRED",accountLabel:"seoul.myshopify.com",metadata:{tokenMode:"EXPIRING",reauthReason:"refresh token expired"}}],now);expect(reauth.shopify).toMatchObject({status:"REAUTH_REQUIRED",source:"WORKSPACE",accountLabel:"seoul.myshopify.com",capabilities:{adminApi:false},tokenHealth:{state:"REAUTH_REQUIRED",reason:"refresh token expired"}});expect(reauth.tokenMetrics.reauthRequired).toBe(1);expect(JSON.stringify(reauth)).not.toContain("env-token")});
});
