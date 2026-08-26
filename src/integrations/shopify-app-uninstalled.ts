import type {IntegrationConnectionRepository}from"./connection-repository.js";
import{verifyShopifyWebhook}from"./shopify.js";

const SHOP=/^[a-zA-Z0-9][a-zA-Z0-9-]*[.]myshopify[.]com$/;
type Headers=Readonly<{hmac?:string;webhookId?:string;shopDomain?:string;topic?:string}>;
export class ShopifyAppUninstalledWebhookService{
  constructor(private readonly secret:string,private readonly connections:IntegrationConnectionRepository){}
  async receive(raw:Buffer,headers:Headers){if(!headers.hmac||!verifyShopifyWebhook(raw,headers.hmac,this.secret))throw Object.assign(new Error("Invalid Shopify webhook signature"),{status:401});const shopDomain=headers.shopDomain?.trim().toLowerCase(),webhookId=headers.webhookId?.trim(),topic=headers.topic?.trim().toLowerCase();if(!shopDomain||!SHOP.test(shopDomain)||!webhookId||topic!=="app/uninstalled")throw Object.assign(new Error("Invalid Shopify app uninstall webhook headers"),{status:400});return this.connections.revokeShopifyInstallation({shopDomain,webhookId});}
}
