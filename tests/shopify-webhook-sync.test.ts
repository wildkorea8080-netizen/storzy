import {describe,expect,it,vi} from "vitest";
import {syncShopifyOrderWebhooks} from "../src/integrations/shopify-webhook-sync.js";

describe("Shopify webhook subscription sync",()=>{
  it("creates only missing order topics",async()=>{
    const fetcher=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{webhookSubscriptions:{nodes:[{id:"existing",topic:"ORDERS_CREATE",uri:"https://app.example/webhooks/shopify/orders"}]}}}),{status:200,headers:{"content-type":"application/json"}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{webhookSubscriptionCreate:{webhookSubscription:{id:"paid",topic:"ORDERS_PAID",uri:"https://app.example/webhooks/shopify/orders"},userErrors:[]}}}),{status:200,headers:{"content-type":"application/json"}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{webhookSubscriptionCreate:{webhookSubscription:{id:"updated",topic:"ORDERS_UPDATED",uri:"https://app.example/webhooks/shopify/orders"},userErrors:[]}}}),{status:200,headers:{"content-type":"application/json"}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{webhookSubscriptionCreate:{webhookSubscription:{id:"cancelled",topic:"ORDERS_CANCELLED",uri:"https://app.example/webhooks/shopify/orders"},userErrors:[]}}}),{status:200,headers:{"content-type":"application/json"}}));
    fetcher
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{webhookSubscriptions:{nodes:[]}}}),{status:200,headers:{"content-type":"application/json"}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{webhookSubscriptionCreate:{webhookSubscription:{id:"uninstalled",topic:"APP_UNINSTALLED",uri:"https://app.example/webhooks/shopify/app-uninstalled"},userErrors:[]}}}),{status:200,headers:{"content-type":"application/json"}}));
    const result=await syncShopifyOrderWebhooks({shopDomain:"store.myshopify.com",accessToken:"secret",apiVersion:"2026-07",publicAppUrl:"https://app.example",fetch:fetcher});
    expect(result).toMatchObject({total:5,created:4,existing:1,endpoint:"https://app.example/webhooks/shopify/orders",endpoints:{appUninstalled:"https://app.example/webhooks/shopify/app-uninstalled"}});
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain("secret");
  });
  it("is idempotent when every topic already exists",async()=>{
    const nodes=[...["ORDERS_CREATE","ORDERS_PAID","ORDERS_UPDATED","ORDERS_CANCELLED"].map((topic,index)=>({id:String(index),topic,uri:"https://app.example/webhooks/shopify/orders"})),{id:"5",topic:"APP_UNINSTALLED",uri:"https://app.example/webhooks/shopify/app-uninstalled"}],fetcher=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({data:{webhookSubscriptions:{nodes}}}),{status:200,headers:{"content-type":"application/json"}}));
    await expect(syncShopifyOrderWebhooks({shopDomain:"store.myshopify.com",accessToken:"secret",apiVersion:"2026-07",publicAppUrl:"https://app.example",fetch:fetcher})).resolves.toMatchObject({created:0,existing:5});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("refuses a local or insecure callback",async()=>{
    await expect(syncShopifyOrderWebhooks({shopDomain:"store.myshopify.com",accessToken:"secret",apiVersion:"2026-07",publicAppUrl:"http://localhost:3000"})).rejects.toMatchObject({code:"WEBHOOK_PUBLIC_HTTPS_REQUIRED"});
  });
});
