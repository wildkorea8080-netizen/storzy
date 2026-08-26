import {describe,expect,it} from "vitest";
import {shopifyOAuthReadinessFromEnv} from "../src/integrations/shopify-oauth-readiness.js";

describe("Shopify OAuth 준비 상태",()=>{
  it("비밀값을 노출하지 않고 누락 설정을 반환한다",()=>{
    const result=shopifyOAuthReadinessFromEnv({SHOPIFY_API_KEY:"key"});
    expect(result.ready).toBe(false);
    expect(result.missing).toContain("SHOPIFY_API_KEY / SHOPIFY_API_SECRET");
    expect(JSON.stringify(result)).not.toContain("key");
  });

  it("공개 콜백과 필수 scope 및 암호화 키가 있으면 준비 완료다",()=>{
    const result=shopifyOAuthReadinessFromEnv({PUBLIC_APP_URL:"https://app.example",SHOPIFY_API_KEY:"key",SHOPIFY_API_SECRET:"secret",INTEGRATION_CREDENTIAL_KEY_BASE64:Buffer.alloc(32,7).toString("base64"),SHOPIFY_OAUTH_CALLBACK_URL:"https://app.example/api/integrations/shopify/oauth/callback",SHOPIFY_SCOPES:"write_products,write_content,read_orders"});
    expect(result).toMatchObject({ready:true,callbackUrl:"https://app.example/api/integrations/shopify/oauth/callback",checks:{clientCredentials:true,credentialEncryption:true,publicHttpsCallback:true,callbackPath:true,callbackOrigin:true,requiredScopes:true},missing:[]});
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("encrypted");
  });

  it("localhost와 잘못된 callback 경로를 거부한다",()=>{
    const result=shopifyOAuthReadinessFromEnv({PUBLIC_APP_URL:"https://app.example",SHOPIFY_API_KEY:"key",SHOPIFY_API_SECRET:"secret",INTEGRATION_CREDENTIAL_KEY_BASE64:Buffer.alloc(32).toString("base64"),SHOPIFY_OAUTH_CALLBACK_URL:"http://localhost:3000/callback",SHOPIFY_SCOPES:"write_products,write_content,read_orders"});
    expect(result.checks.publicHttpsCallback).toBe(false);
    expect(result.checks.callbackPath).toBe(false);
    expect(result.checks.callbackOrigin).toBe(false);
    expect(result.ready).toBe(false);
  });
  it("잘못된 암호화 키와 PUBLIC_APP_URL이 다른 callback을 거부한다",()=>{const result=shopifyOAuthReadinessFromEnv({PUBLIC_APP_URL:"https://app.example",SHOPIFY_API_KEY:"key",SHOPIFY_API_SECRET:"secret",INTEGRATION_CREDENTIAL_KEY_BASE64:"not-a-key",SHOPIFY_OAUTH_CALLBACK_URL:"https://other.example/api/integrations/shopify/oauth/callback",SHOPIFY_SCOPES:"write_products,write_content,read_orders"});expect(result.checks.credentialEncryption).toBe(false);expect(result.checks.callbackOrigin).toBe(false)});
});
