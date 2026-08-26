import { describe, expect, it, vi } from "vitest";
import { testIntegrationConnection } from "../src/integrations/connection-test.js";

describe("integration connection test",()=>{
  it("verifies Shopify with a read-only shop query",async()=>{
    const fetch=vi.fn(async(_input:unknown,init?:RequestInit)=>{
      expect(String(init?.body)).toContain("StorzyConnectionTest");
      expect(String(init?.body)).toContain("myshopifyDomain");
      return new Response(JSON.stringify({data:{shop:{name:"Seoul Side",myshopifyDomain:"seoul.myshopify.com"}}}),{status:200,headers:{"Content-Type":"application/json"}});
    });
    await expect(testIntegrationConnection("shopify",{SHOPIFY_SHOP_DOMAIN:"seoul.myshopify.com",SHOPIFY_ADMIN_ACCESS_TOKEN:"secret",SHOPIFY_API_VERSION:"2026-07"},fetch as typeof globalThis.fetch)).resolves.toMatchObject({provider:"SHOPIFY",ok:true,status:"CONNECTED",accountLabel:"Seoul Side · seoul.myshopify.com"});
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("verifies the configured Printful store with a read-only request",async()=>{
    const fetch=vi.fn(async(input:unknown,init?:RequestInit)=>{
      expect(String(input)).toBe("https://api.printful.com/stores/42");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer pf-secret");
      return new Response(JSON.stringify({code:200,result:{id:42,name:"Seoul Fulfillment"}}),{status:200,headers:{"Content-Type":"application/json"}});
    });
    await expect(testIntegrationConnection("printful",{PRINTFUL_TOKEN:"pf-secret",PRINTFUL_STORE_ID:"42"},fetch as typeof globalThis.fetch)).resolves.toMatchObject({provider:"PRINTFUL",ok:true,status:"CONNECTED",accountLabel:"Seoul Fulfillment · 42"});
  });

  it("does not call providers or expose secrets when configuration is missing or fails",async()=>{
    const unused=vi.fn();
    await expect(testIntegrationConnection("shopify",{},unused as typeof globalThis.fetch)).resolves.toMatchObject({status:"NOT_CONFIGURED",ok:false});
    expect(unused).not.toHaveBeenCalled();
    const failed=vi.fn(async()=>new Response("token=super-secret",{status:401}));
    const result=await testIntegrationConnection("shopify",{SHOPIFY_SHOP_DOMAIN:"seoul.myshopify.com",SHOPIFY_ADMIN_ACCESS_TOKEN:"super-secret"},failed as typeof globalThis.fetch);
    expect(result).toMatchObject({status:"FAILED",ok:false});
    expect(JSON.stringify(result)).not.toContain("super-secret");
    expect(JSON.stringify(result)).not.toContain("token=");
  });
});
