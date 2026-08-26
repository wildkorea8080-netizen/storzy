import {ShopifyAdminClient} from "../integrations/shopify.js";
import type {IntegrationConnectionRepository} from "../integrations/connection-repository.js";
import type {ShopifyWorkspaceAccess} from "../integrations/shopify-access-token-provider.js";
import {ShopifyProductPublisher,type ProductSetPayload,type ProductSetResult,type ShopifyPublisher} from "./publisher.js";

export class ShopifyConnectionUnavailableError extends Error{constructor(){super("Workspace Shopify connection is unavailable");this.name="ShopifyConnectionUnavailableError"}}
export class WorkspaceShopifyPublisher implements ShopifyPublisher{
  constructor(private readonly connections:IntegrationConnectionRepository|undefined,private readonly apiVersion:string,private readonly fallback?:Readonly<{shopDomain:string;accessToken:string}>,private readonly accessProvider?:Readonly<{resolve(workspaceId:string):Promise<ShopifyWorkspaceAccess|null>}>){ }
  async publish(payload:ProductSetPayload,workspaceId?:string):Promise<ProductSetResult>{
    if(this.accessProvider&&workspaceId){const access=await this.accessProvider.resolve(workspaceId);if(access)return new ShopifyProductPublisher(new ShopifyAdminClient({...access,apiVersion:this.apiVersion})).publish(payload);throw new ShopifyConnectionUnavailableError()}
    else if(this.connections&&workspaceId){const connection=(await this.connections.list(workspaceId)).find(item=>item.provider==="SHOPIFY"&&item.status==="CONNECTED"),credentials=await this.connections.credentials(workspaceId,"SHOPIFY");if(connection&&credentials?.accessToken)return new ShopifyProductPublisher(new ShopifyAdminClient({shopDomain:connection.accountLabel,accessToken:credentials.accessToken,apiVersion:this.apiVersion})).publish(payload)}
    if(this.fallback)return new ShopifyProductPublisher(new ShopifyAdminClient({...this.fallback,apiVersion:this.apiVersion})).publish(payload);
    throw new ShopifyConnectionUnavailableError();
  }
}
