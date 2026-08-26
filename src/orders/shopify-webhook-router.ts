import type pg from "pg";
import type { OrderPolicy } from "../domain/order-policy.js";
import { verifyShopifyWebhook } from "../integrations/shopify.js";
import type { IntegrationConnectionRepository } from "../integrations/connection-repository.js";
import { ShopifyOrderWebhookService,type ShopifyWebhookHeaders } from "./shopify-webhook-service.js";
import type {OrderAutomationGate} from "./automation-control.js";

const SHOP=/^[a-zA-Z0-9][a-zA-Z0-9-]*[.]myshopify[.]com$/;

export class ShopifyOrderWebhookRouter{
  constructor(private readonly pool:pg.Pool,private readonly secret:string,private readonly connections:IntegrationConnectionRepository,private readonly allowedCountries:ReadonlySet<string>,private readonly policy:OrderPolicy,private readonly automationGate?:OrderAutomationGate){}
  async receive(raw:Buffer,headers:ShopifyWebhookHeaders){
    if(!headers.hmac||!verifyShopifyWebhook(raw,headers.hmac,this.secret))throw Object.assign(new Error("Invalid Shopify webhook signature"),{status:401});
    const shopDomain=headers.shopDomain?.trim().toLowerCase();
    if(!shopDomain||!SHOP.test(shopDomain))throw Object.assign(new Error("Invalid Shopify shop domain"),{status:400});
    const workspaceId=await this.connections.connectedWorkspaceForAccount("SHOPIFY",shopDomain);
    if(!workspaceId)throw Object.assign(new Error("Shopify store is not connected to an active workspace"),{status:400});
    return new ShopifyOrderWebhookService(this.pool,this.secret,workspaceId,this.allowedCountries,this.policy,this.automationGate).receive(raw,{...headers,shopDomain});
  }
}
