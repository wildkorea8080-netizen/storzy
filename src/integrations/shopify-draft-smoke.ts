import {ShopifyAdminClient} from "./shopify.js";
import {mapProductSet} from "../shopify/product-mapper.js";
import {ShopifyProductPublisher} from "../shopify/publisher.js";

export const SHOPIFY_DRAFT_SMOKE_HANDLE="storzy-provider-smoke-v1";

export type ShopifyDraftSmokePlan=Readonly<{
  shopDomain:string;
  handle:string;
  title:string;
  status:"DRAFT";
  price:string;
}>;

export type ShopifyDraftSmokeResult=Readonly<{
  productId:string;
  title:string;
  handle:string;
  status:string;
  variants:readonly Readonly<{id:string;title:string;price:string;sku:string|null}>[];
}>;

function required(env:NodeJS.ProcessEnv,key:string):string{
  const value=env[key]?.trim();
  if(!value)throw new Error(`${key}이 필요합니다.`);
  return value;
}

export function buildShopifyDraftSmokePlan(env:NodeJS.ProcessEnv):ShopifyDraftSmokePlan{
  const shopDomain=required(env,"SHOPIFY_SHOP_DOMAIN");
  return{shopDomain,handle:SHOPIFY_DRAFT_SMOKE_HANDLE,title:"[STORZY TEST] Seoul One-Way Street Tee",status:"DRAFT",price:"39.00"};
}

export function assertShopifyDraftSmokeConfirmation(env:NodeJS.ProcessEnv,plan:ShopifyDraftSmokePlan):void{
  const confirmation=required(env,"SHOPIFY_WRITE_SMOKE_CONFIRM");
  if(confirmation.toLowerCase()!==plan.shopDomain.toLowerCase())throw new Error("SHOPIFY_WRITE_SMOKE_CONFIRM이 대상 스토어 도메인과 일치해야 합니다.");
}

const VERIFY=`#graphql
query StorzyDraftSmokeVerify($id: ID!) {
  product(id: $id) {
    id title handle status
    variants(first: 5) { nodes { id title price sku } }
  }
}`;

export async function runShopifyDraftSmoke(env:NodeJS.ProcessEnv,fetch:typeof globalThis.fetch=globalThis.fetch):Promise<ShopifyDraftSmokeResult>{
  const plan=buildShopifyDraftSmokePlan(env);
  assertShopifyDraftSmokeConfirmation(env,plan);
  const client=new ShopifyAdminClient({
    shopDomain:plan.shopDomain,
    accessToken:required(env,"SHOPIFY_ADMIN_ACCESS_TOKEN"),
    apiVersion:env.SHOPIFY_API_VERSION?.trim()||"2026-07",
    fetch,
  });
  const payload=mapProductSet({
    contentRevisionId:"provider-smoke-v1",
    brandName:"STORZY",
    productType:"Smoke Test",
    retailMinor:3900,
    currency:"USD",
    content:{
      title_en:plan.title,
      description:"A non-public draft product created by the STORZY provider smoke test.",
      key_features:["Draft only","Idempotent fixed handle"],
      tags:["storzy-smoke","do-not-publish"],
      seo:{title:"STORZY provider smoke test",description:"Non-public Shopify draft integration test."},
    },
  });
  const published=await new ShopifyProductPublisher(client).publish(payload);
  const verified=await client.graphql<{product:null|{id:string;title:string;handle:string;status:string;variants:{nodes:Array<{id:string;title:string;price:string;sku:string|null}>}}}>(VERIFY,{id:published.productId});
  if(!verified.product)throw new Error("Shopify draft smoke 상품을 게시 후 조회할 수 없습니다.");
  if(verified.product.status!=="DRAFT"||verified.product.handle!==plan.handle)throw new Error("Shopify draft smoke 검증 결과가 안전 조건과 일치하지 않습니다.");
  return{productId:verified.product.id,title:verified.product.title,handle:verified.product.handle,status:verified.product.status,variants:verified.product.variants.nodes};
}
