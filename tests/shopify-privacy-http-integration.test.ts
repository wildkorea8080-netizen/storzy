import {createHmac} from "node:crypto";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import {afterEach,describe,expect,it,vi} from "vitest";
import {MemoryBrandProfileStore} from "../src/brand/memory-store.js";
import {BrandProfileService} from "../src/brand/service.js";
import {createApp} from "../src/http/app.js";
import {ShopifyPrivacyWebhookService} from "../src/privacy/shopify-privacy-webhook.js";

const servers:ReturnType<typeof createServer>[]=[];
afterEach(async()=>Promise.all(servers.splice(0).map(server=>new Promise<void>(resolve=>server.close(()=>resolve())))));

async function fixture(){
  const secret="privacy-integration-secret",query=vi.fn().mockResolvedValue({rowCount:1,rows:[{id:"privacy-1"}]}),privacy=new ShopifyPrivacyWebhookService({query} as never,secret),brands=new BrandProfileService(new MemoryBrandProfileStore());
  const server=createServer(createApp(brands,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,privacy));
  servers.push(server);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  return{baseUrl:`http://127.0.0.1:${(server.address() as AddressInfo).port}`,secret,query};
}

describe("Shopify privacy webhook HTTP contract",()=>{
  it("accepts a signed matching topic and rejects a signed cross-topic delivery",async()=>{
    const{baseUrl,secret,query}=await fixture(),body=JSON.stringify({shop_id:1,shop_domain:"store.myshopify.com"}),hmac=createHmac("sha256",secret).update(body).digest("base64"),headers={"Content-Type":"application/json","X-Shopify-Hmac-Sha256":hmac,"X-Shopify-Webhook-Id":"delivery-1","X-Shopify-Shop-Domain":"store.myshopify.com"};
    const accepted=await fetch(`${baseUrl}/webhooks/shopify/privacy/shop/redact`,{method:"POST",headers:{...headers,"X-Shopify-Topic":"shop/redact"},body});
    expect(accepted.status).toBe(200);await expect(accepted.json()).resolves.toMatchObject({data:{accepted:true,topic:"SHOP_REDACT"}});
    const rejected=await fetch(`${baseUrl}/webhooks/shopify/privacy/shop/redact`,{method:"POST",headers:{...headers,"X-Shopify-Webhook-Id":"delivery-2","X-Shopify-Topic":"customers/redact"},body});
    expect(rejected.status).toBe(400);await expect(rejected.json()).resolves.toMatchObject({error:{message:"Shopify privacy webhook topic mismatch"}});
    expect(query).toHaveBeenCalledTimes(2);
  });
});
