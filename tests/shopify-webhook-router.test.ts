import { createHmac } from "node:crypto";
import { describe,expect,it,vi } from "vitest";
import { ShopifyOrderWebhookRouter } from "../src/orders/shopify-webhook-router.js";

const policy={maxOrderAmountMinor:50000n,maxItemCount:10,maxCostIncreaseBasisPoints:1000};
describe("Shopify webhook workspace router",()=>{
  it("rejects an unknown shop after authenticating the payload",async()=>{
    const raw=Buffer.from("{}"),secret="secret",connections={connectedWorkspaceForAccount:vi.fn().mockResolvedValue(null)};
    const router=new ShopifyOrderWebhookRouter({} as never,secret,connections as never,new Set(["US"]),policy);
    await expect(router.receive(raw,{hmac:createHmac("sha256",secret).update(raw).digest("base64"),shopDomain:"unknown.myshopify.com",webhookId:"id",topic:"orders/paid"})).rejects.toMatchObject({status:400});
    expect(connections.connectedWorkspaceForAccount).toHaveBeenCalledWith("SHOPIFY","unknown.myshopify.com");
  });
  it("rejects a forged signature before looking up a workspace",async()=>{
    const connections={connectedWorkspaceForAccount:vi.fn()};
    const router=new ShopifyOrderWebhookRouter({} as never,"secret",connections as never,new Set(["US"]),policy);
    await expect(router.receive(Buffer.from("{}"),{hmac:"forged",shopDomain:"store.myshopify.com"})).rejects.toMatchObject({status:401});
    expect(connections.connectedWorkspaceForAccount).not.toHaveBeenCalled();
  });
});
