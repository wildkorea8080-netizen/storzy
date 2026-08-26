import {ShopifyAdminClient} from "../integrations/shopify.js";
import type {IntegrationConnectionRepository} from "../integrations/connection-repository.js";
import type {ShopifyWorkspaceAccess} from "../integrations/shopify-access-token-provider.js";
import {ShopifyConnectionUnavailableError} from "../shopify/workspace-publisher.js";
import type {ShopifyStorePublicationPlan} from "./shopify-plan.js";
import {ShopifyStorePublisher,type StorePublicationResult,type StorePublisher} from "./shopify-publisher.js";

export class WorkspaceShopifyStorePublisher implements StorePublisher{
  constructor(private readonly connections:IntegrationConnectionRepository|undefined,private readonly apiVersion:string,private readonly fallback?:Readonly<{shopDomain:string;accessToken:string}>,private readonly accessProvider?:Readonly<{resolve(workspaceId:string):Promise<ShopifyWorkspaceAccess|null>}>){ }
  async publish(plan:ShopifyStorePublicationPlan,workspaceId?:string):Promise<StorePublicationResult>{
    if(this.accessProvider&&workspaceId){const access=await this.accessProvider.resolve(workspaceId);if(access)return new ShopifyStorePublisher(new ShopifyAdminClient({...access,apiVersion:this.apiVersion})).publish(plan);throw new ShopifyConnectionUnavailableError()}
    else if(this.connections&&workspaceId){const connection=(await this.connections.list(workspaceId)).find(item=>item.provider==="SHOPIFY"&&item.status==="CONNECTED"),credentials=await this.connections.credentials(workspaceId,"SHOPIFY");if(connection&&credentials?.accessToken)return new ShopifyStorePublisher(new ShopifyAdminClient({shopDomain:connection.accountLabel,accessToken:credentials.accessToken,apiVersion:this.apiVersion})).publish(plan)}
    if(this.fallback)return new ShopifyStorePublisher(new ShopifyAdminClient({...this.fallback,apiVersion:this.apiVersion})).publish(plan);
    throw new ShopifyConnectionUnavailableError();
  }
}
