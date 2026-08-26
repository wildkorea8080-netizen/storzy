import {createHmac} from "node:crypto";
import {describe,expect,it,vi} from "vitest";
import {ShopifyPrivacyWebhookService} from "../src/privacy/shopify-privacy-webhook.js";

describe("Shopify mandatory privacy webhooks",()=>{
  it("queues only identifiers and does not persist contact data",async()=>{
    const calls:unknown[][]=[];const pool={query:vi.fn(async(_sql:string,values:unknown[])=>{calls.push(values);return{rowCount:1,rows:[{id:"privacy-1"}]}})},connections={privacyWorkspaceForShopifyAccount:vi.fn().mockResolvedValue("workspace-1")},secret="secret";
    const body={shop_id:954889,shop_domain:"store.myshopify.com",orders_requested:[299938],customer:{id:191167,email:"person@example.com",phone:"555-1234"},data_request:{id:9999}},raw=Buffer.from(JSON.stringify(body)),service=new ShopifyPrivacyWebhookService(pool as never,secret,connections as never);
    const result=await service.receive("CUSTOMERS_DATA_REQUEST",raw,{hmac:createHmac("sha256",secret).update(raw).digest("base64"),webhookId:"delivery-1",shopDomain:"store.myshopify.com",topic:"customers/data_request"});
    expect(result).toMatchObject({accepted:true,duplicate:false,workspaceMatched:true});
    expect(JSON.stringify(calls)).not.toContain("person@example.com");
    expect(JSON.stringify(calls)).not.toContain("555-1234");
    expect(calls[0]).toContain("191167");expect(calls[0]).toContain("[\"299938\"]");
    expect(String(pool.query.mock.calls[1]?.[0])).toContain("shopify_privacy_webhook_receipts");
    expect(connections.privacyWorkspaceForShopifyAccount).toHaveBeenCalledWith("store.myshopify.com",false);
  });
  it("uses the recent uninstall owner for a shop redaction request",async()=>{const secret="secret",body={shop_id:1,shop_domain:"store.myshopify.com"},raw=Buffer.from(JSON.stringify(body)),pool={query:vi.fn().mockResolvedValue({rowCount:1,rows:[{id:"privacy-1"}]})},connections={privacyWorkspaceForShopifyAccount:vi.fn().mockResolvedValue("workspace-before-uninstall")},service=new ShopifyPrivacyWebhookService(pool as never,secret,connections as never);await expect(service.receive("SHOP_REDACT",raw,{hmac:createHmac("sha256",secret).update(raw).digest("base64"),webhookId:"redact-1",shopDomain:"store.myshopify.com",topic:"shop/redact"})).resolves.toMatchObject({workspaceMatched:true});expect(connections.privacyWorkspaceForShopifyAccount).toHaveBeenCalledWith("store.myshopify.com",true)});
  it("returns 401 for a forged HMAC before database access",async()=>{
    const pool={query:vi.fn()},service=new ShopifyPrivacyWebhookService(pool as never,"secret");
    await expect(service.receive("SHOP_REDACT",Buffer.from("{}"),{hmac:"forged",webhookId:"id",shopDomain:"store.myshopify.com",topic:"shop/redact"})).rejects.toMatchObject({status:401});
    expect(pool.query).not.toHaveBeenCalled();
  });
  it("treats a repeated delivery as an accepted duplicate",async()=>{
    const pool={query:vi.fn().mockResolvedValue({rowCount:0,rows:[]})},secret="secret",raw=Buffer.from(JSON.stringify({shop_id:1,shop_domain:"store.myshopify.com"})),service=new ShopifyPrivacyWebhookService(pool as never,secret);
    await expect(service.receive("SHOP_REDACT",raw,{hmac:createHmac("sha256",secret).update(raw).digest("base64"),webhookId:"same",shopDomain:"store.myshopify.com",topic:"shop/redact"})).resolves.toMatchObject({accepted:true,duplicate:true});
  });
  it("rejects a validly signed delivery when its Shopify topic does not match the endpoint topic",async()=>{
    const pool={query:vi.fn()},secret="secret",raw=Buffer.from(JSON.stringify({shop_id:1,shop_domain:"store.myshopify.com"})),service=new ShopifyPrivacyWebhookService(pool as never,secret);
    await expect(service.receive("SHOP_REDACT",raw,{hmac:createHmac("sha256",secret).update(raw).digest("base64"),webhookId:"delivery-2",shopDomain:"store.myshopify.com",topic:"customers/redact"})).rejects.toMatchObject({status:400,message:"Shopify privacy webhook topic mismatch"});
    expect(pool.query).not.toHaveBeenCalled();
  });
});
