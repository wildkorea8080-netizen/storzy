import {describe,expect,it} from "vitest";
import {loadConfig} from "../src/config.js";

describe("production security configuration",()=>{
  const productionBase={NODE_ENV:"production",ADMIN_API_TOKEN:"a".repeat(32),PUBLIC_APP_URL:"https://app.storzy.example"};
  it("rejects production startup without an admin token",()=>{
    expect(()=>loadConfig({NODE_ENV:"production",PUBLIC_APP_URL:"https://app.storzy.example"})).toThrow("ADMIN_API_TOKEN");
  });

  it("rejects a short production admin token",()=>{
    expect(()=>loadConfig({NODE_ENV:"production",ADMIN_API_TOKEN:"too-short",PUBLIC_APP_URL:"https://app.storzy.example"})).toThrow("at least 32 characters");
  });

  it("accepts a strong production token and keeps development optional",()=>{
    const token="a".repeat(32);
    expect(loadConfig({...productionBase,ADMIN_API_TOKEN:`  ${token}  `}).adminApiToken).toBe(token);
    expect(loadConfig({NODE_ENV:"development"}).adminApiToken).toBeNull();
  });
  it("rejects malformed Printful webhook secrets in production",()=>{for(const secret of ["aa","zz".repeat(32),"abc"]){expect(()=>loadConfig({...productionBase,PRINTFUL_WEBHOOK_SECRET_HEX:secret})).toThrow("PRINTFUL_WEBHOOK_SECRET_HEX")}});
  it("requires the HMAC secret when the optional Printful public key is configured",()=>{expect(()=>loadConfig({...productionBase,PRINTFUL_WEBHOOK_PUBLIC_KEY:"public"})).toThrow("is required")});
  it("accepts a valid production Printful webhook secret",()=>{expect(()=>loadConfig({...productionBase,PRINTFUL_WEBHOOK_SECRET_HEX:"ab".repeat(32)})).not.toThrow()});
  it("requires a public HTTPS origin in production",()=>{for(const value of [undefined,"http://app.example","https://localhost:3000","https://127.0.0.1","https://user:pass@app.example","https://app.example?token=x","not-a-url"]){expect(()=>loadConfig({...productionBase,PUBLIC_APP_URL:value})).toThrow("PUBLIC_APP_URL")}});
  it("accepts a clean public HTTPS origin",()=>{expect(()=>loadConfig(productionBase)).not.toThrow()});
  it("validates graceful shutdown drain and timeout windows",()=>{expect(()=>loadConfig({...productionBase,SHUTDOWN_DRAIN_MS:"30000",SHUTDOWN_TIMEOUT_MS:"30000"})).toThrow("SHUTDOWN_TIMEOUT_MS");expect(loadConfig({...productionBase,SHUTDOWN_DRAIN_MS:"0",SHUTDOWN_TIMEOUT_MS:"1000"})).toMatchObject({shutdownDrainMs:0,shutdownTimeoutMs:1000})});
  it("rejects partial Shopify OAuth configuration in production",()=>{expect(()=>loadConfig({...productionBase,SHOPIFY_API_KEY:"key"})).toThrow("Shopify OAuth configuration is incomplete")});
  it("rejects a Shopify callback on a different origin",()=>{expect(()=>loadConfig({...productionBase,SHOPIFY_API_KEY:"key",SHOPIFY_API_SECRET:"secret",INTEGRATION_CREDENTIAL_KEY_BASE64:Buffer.alloc(32).toString("base64"),SHOPIFY_OAUTH_CALLBACK_URL:"https://other.example/api/integrations/shopify/oauth/callback",SHOPIFY_SCOPES:"write_products,write_content,read_orders"})).toThrow("origin 일치")});
  it("accepts complete Shopify OAuth production configuration",()=>{expect(()=>loadConfig({...productionBase,SHOPIFY_API_KEY:"key",SHOPIFY_API_SECRET:"secret",INTEGRATION_CREDENTIAL_KEY_BASE64:Buffer.alloc(32).toString("base64"),SHOPIFY_OAUTH_CALLBACK_URL:"https://app.storzy.example/api/integrations/shopify/oauth/callback",SHOPIFY_SCOPES:"write_products,write_content,read_orders"})).not.toThrow()});
});
