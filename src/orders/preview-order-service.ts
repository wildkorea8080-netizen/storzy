import { createHmac, randomUUID } from "node:crypto";
import type pg from "pg";
import { ShopifyOrderWebhookService } from "./shopify-webhook-service.js";

type PublishedRow={shopify_product_id:string;recommended_retail_minor:string;external_product_id:string;snapshot_data:Record<string,unknown>};
export function buildPreviewShopifyOrder(input:Readonly<{productId:string;variantId:string;priceMinor:number;quantity:number;orderId:string}>){const price=(input.priceMinor/100).toFixed(2);return{admin_graphql_api_id:`gid://shopify/Order/${input.orderId}`,name:`#PREVIEW-${input.orderId.slice(0,8)}`,currency:"USD",current_subtotal_price:(input.priceMinor*input.quantity/100).toFixed(2),financial_status:"paid",shipping_address:{name:"STORZY Preview",address1:"123 Seoul Street",city:"New York",zip:"10001",country_code:"US"},line_items:[{id:`line-${input.orderId}`,product_id:input.productId,sku:`STORZY-PF-${input.variantId}`,quantity:input.quantity,current_quantity:input.quantity,price}]};}

export class PreviewOrderService{
  private readonly secret="storzy-preview-webhook-secret";
  constructor(private readonly pool:pg.Pool){}
  async create(workspaceId:string,quantity=1){
    if(!Number.isInteger(quantity)||quantity<1||quantity>5)throw Object.assign(new Error("quantity must be between 1 and 5"),{status:400});
    const result=await this.pool.query<PublishedRow>(`SELECT spj.shopify_product_id,c.recommended_retail_minor,c.external_product_id,cs.data snapshot_data FROM shopify_publication_jobs spj JOIN product_content_revisions r ON r.id=spj.content_revision_id JOIN product_contents pc ON pc.id=r.product_content_id JOIN product_candidates c ON c.id=pc.candidate_id JOIN catalog_snapshots cs ON cs.id=c.catalog_snapshot_id WHERE spj.workspace_id=$1 AND spj.status='SUCCEEDED' ORDER BY spj.finished_at DESC LIMIT 1`,[workspaceId]);
    const row=result.rows[0];if(!row?.shopify_product_id)throw Object.assign(new Error("No published preview product is available"),{status:422});
    const products=Array.isArray(row.snapshot_data.products)?row.snapshot_data.products:[],product=products.find(value=>value&&typeof value==="object"&&String((value as Record<string,unknown>).externalProductId)===row.external_product_id) as Record<string,unknown>|undefined,variants=Array.isArray(product?.catalogVariants)?product.catalogVariants as Record<string,unknown>[]:[],variantId=String(variants[0]?.externalVariantId??"");if(!variantId)throw Object.assign(new Error("Published product has no mapped variant"),{status:422});
    const orderId=randomUUID(),payload=buildPreviewShopifyOrder({productId:row.shopify_product_id,variantId,priceMinor:Number(row.recommended_retail_minor),quantity,orderId}),raw=Buffer.from(JSON.stringify(payload)),hmac=createHmac("sha256",this.secret).update(raw).digest("base64"),receiver=new ShopifyOrderWebhookService(this.pool,this.secret,workspaceId,new Set(["US","JP"]),{maxOrderAmountMinor:50_000n,maxItemCount:10,maxCostIncreaseBasisPoints:1000});
    return receiver.receive(raw,{hmac,webhookId:`preview-${orderId}`,topic:"orders/paid",shopDomain:"storzy-preview.myshopify.com",apiVersion:"2026-07"});
  }
}
