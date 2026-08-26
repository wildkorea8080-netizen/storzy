import { createHash } from "node:crypto";
import { ShopifyAdminClient } from "../integrations/shopify.js";

export function createPreviewShopifyClient():ShopifyAdminClient{
  const fetcher:typeof fetch=async(_input,init)=>{
    const body=JSON.parse(String(init?.body??"{}")) as {variables?:{identifier?:{handle?:string};input?:{title?:string}}};
    const handle=body.variables?.identifier?.handle??"preview-product";
    const suffix=createHash("sha256").update(handle).digest("hex").slice(0,12);
    return new Response(JSON.stringify({data:{productSet:{product:{id:`gid://shopify/Product/${suffix}`,title:body.variables?.input?.title??"Preview product",status:"DRAFT"},productSetOperation:null,userErrors:[]}}}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  return new ShopifyAdminClient({shopDomain:"storzy-preview.myshopify.com",accessToken:"preview-only",apiVersion:"2026-07",fetch:fetcher});
}
