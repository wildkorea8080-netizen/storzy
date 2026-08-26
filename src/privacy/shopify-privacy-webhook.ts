import {createHash,randomUUID} from "node:crypto";
import type pg from "pg";
import type {IntegrationConnectionRepository} from "../integrations/connection-repository.js";
import {verifyShopifyWebhook} from "../integrations/shopify.js";

export type PrivacyTopic="CUSTOMERS_DATA_REQUEST"|"CUSTOMERS_REDACT"|"SHOP_REDACT";
type Headers=Readonly<{hmac?:string;webhookId?:string;shopDomain?:string;topic?:string}>;
const SHOP=/^[a-zA-Z0-9][a-zA-Z0-9-]*[.]myshopify[.]com$/;
const ids=(value:unknown)=>Array.isArray(value)?value.map(String).filter(id=>/^[0-9]+$/.test(id)):[];
const SHOPIFY_TOPICS:Readonly<Record<PrivacyTopic,string>>={CUSTOMERS_DATA_REQUEST:"customers/data_request",CUSTOMERS_REDACT:"customers/redact",SHOP_REDACT:"shop/redact"};

export class ShopifyPrivacyWebhookService{
  constructor(private readonly pool:pg.Pool,private readonly secret:string,private readonly connections?:IntegrationConnectionRepository){}
  async receive(topic:PrivacyTopic,raw:Buffer,headers:Headers){
    if(!headers.hmac||!verifyShopifyWebhook(raw,headers.hmac,this.secret))throw Object.assign(new Error("Invalid Shopify webhook signature"),{status:401});
    const shopDomain=headers.shopDomain?.trim().toLowerCase(),webhookId=headers.webhookId?.trim(),shopifyTopic=headers.topic?.trim().toLowerCase();
    if(!shopDomain||!SHOP.test(shopDomain)||!webhookId||!shopifyTopic)throw Object.assign(new Error("Missing Shopify privacy webhook headers"),{status:400});
    if(shopifyTopic!==SHOPIFY_TOPICS[topic])throw Object.assign(new Error("Shopify privacy webhook topic mismatch"),{status:400});
    let body:Record<string,unknown>;
    try{body=JSON.parse(raw.toString("utf8")) as Record<string,unknown>;}catch{throw Object.assign(new Error("Invalid webhook JSON"),{status:400});}
    if(String(body.shop_domain??"").toLowerCase()!==shopDomain||!String(body.shop_id??"").trim())throw Object.assign(new Error("Privacy webhook shop mismatch"),{status:400});
    const customer=(body.customer??{}) as Record<string,unknown>,orderIds=ids(topic==="CUSTOMERS_DATA_REQUEST"?body.orders_requested:topic==="CUSTOMERS_REDACT"?body.orders_to_redact:[]),request=(body.data_request??{}) as Record<string,unknown>;
    const workspaceId=this.connections?await this.connections.privacyWorkspaceForShopifyAccount(shopDomain,topic==="SHOP_REDACT"):null,digest=createHash("sha256").update(raw).digest("hex");
    const saved=await this.pool.query<{id:string}>(`INSERT INTO shopify_privacy_requests(id,workspace_id,request_type,shop_domain,shop_id,customer_id,order_ids,external_request_id,payload_digest,webhook_id) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id`,[randomUUID(),workspaceId,topic,shopDomain,String(body.shop_id),customer.id===undefined?null:String(customer.id),JSON.stringify(orderIds),request.id===undefined?null:String(request.id),digest,webhookId]);
    const duplicate=!saved.rowCount,requestId=saved.rows[0]?.id??null;
    await this.pool.query(`INSERT INTO shopify_privacy_webhook_receipts(id,workspace_id,request_id,webhook_id,topic,shop_domain,last_outcome) VALUES($1,$2,COALESCE($3,(SELECT id FROM shopify_privacy_requests WHERE webhook_id=$4)),$4,$5,$6,$7) ON CONFLICT(webhook_id) DO UPDATE SET last_outcome='DUPLICATE',delivery_count=shopify_privacy_webhook_receipts.delivery_count+1,last_received_at=now()`,[randomUUID(),workspaceId,requestId,webhookId,topic,shopDomain,duplicate?"DUPLICATE":"ACCEPTED"]);
    return{accepted:true,duplicate,requestId,topic,workspaceMatched:Boolean(workspaceId)};
  }
}
