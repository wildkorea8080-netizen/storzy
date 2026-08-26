import { performance } from "node:perf_hooks";
import { ShopifyAdminClient } from "./shopify.js";
import { PrintfulClient } from "./printful.js";

export type IntegrationProvider = "shopify" | "printful";
export type ConnectionTestResult = Readonly<{
  provider: "SHOPIFY" | "PRINTFUL";
  ok: boolean;
  status: "CONNECTED" | "NOT_CONFIGURED" | "FAILED";
  accountLabel: string | null;
  latencyMs: number;
  checkedAt: string;
  message: string;
}>;

function timedFetch(base: typeof globalThis.fetch, timeoutMs: number): typeof globalThis.fetch {
  return (input,init={})=>base(input,{...init,signal:AbortSignal.timeout(timeoutMs)});
}

function result(provider:ConnectionTestResult["provider"],started:number,values:Omit<ConnectionTestResult,"provider"|"latencyMs"|"checkedAt">):ConnectionTestResult{
  return {provider,...values,latencyMs:Math.max(0,Math.round(performance.now()-started)),checkedAt:new Date().toISOString()};
}

export async function testIntegrationConnection(provider:IntegrationProvider,env:NodeJS.ProcessEnv,fetchImpl:typeof globalThis.fetch=globalThis.fetch):Promise<ConnectionTestResult>{
  const started=performance.now(),fetch=timedFetch(fetchImpl,8_000);
  if(provider==="shopify"){
    const shopDomain=env.SHOPIFY_SHOP_DOMAIN?.trim(),token=env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
    if(!shopDomain||!token)return result("SHOPIFY",started,{ok:false,status:"NOT_CONFIGURED",accountLabel:shopDomain||null,message:"Shopify shop domain과 Admin access token 설정이 필요합니다."});
    try{
      const client=new ShopifyAdminClient({shopDomain,accessToken:token,apiVersion:env.SHOPIFY_API_VERSION?.trim()||"2026-07",fetch});
      const data=await client.graphql<{shop:{name:string;myshopifyDomain:string}}>("query StorzyConnectionTest { shop { name myshopifyDomain } }");
      return result("SHOPIFY",started,{ok:true,status:"CONNECTED",accountLabel:`${data.shop.name} · ${data.shop.myshopifyDomain}`,message:"Shopify Admin GraphQL 연결이 정상입니다."});
    }catch{return result("SHOPIFY",started,{ok:false,status:"FAILED",accountLabel:shopDomain,message:"Shopify 인증, API 버전 또는 네트워크 연결을 확인해 주세요."});}
  }
  const token=env.PRINTFUL_TOKEN?.trim(),storeId=env.PRINTFUL_STORE_ID?.trim();
  if(!token||!storeId)return result("PRINTFUL",started,{ok:false,status:"NOT_CONFIGURED",accountLabel:storeId||null,message:"Printful token과 Store ID 설정이 필요합니다."});
  try{
    const client=new PrintfulClient({token,storeId,baseUrl:env.PRINTFUL_API_BASE_URL?.trim()||"https://api.printful.com",fetch});
    const data=await client.request<{result?:{id?:number|string;name?:string}}>(`/stores/${encodeURIComponent(storeId)}`),store=data.result;
    if(!store)throw new Error("missing store");
    return result("PRINTFUL",started,{ok:true,status:"CONNECTED",accountLabel:`${store.name||"Printful Store"} · ${store.id||storeId}`,message:"Printful Store 연결이 정상입니다."});
  }catch{return result("PRINTFUL",started,{ok:false,status:"FAILED",accountLabel:storeId,message:"Printful 인증, Store ID 또는 네트워크 연결을 확인해 주세요."});}
}
