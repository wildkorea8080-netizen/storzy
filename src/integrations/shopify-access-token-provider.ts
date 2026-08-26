import type {IntegrationConnectionRepository} from "./connection-repository.js";
import {parseShopifyOfflineTokenResponse} from "./shopify-oauth.js";

export type ShopifyWorkspaceAccess=Readonly<{shopDomain:string;accessToken:string}>;

export class ShopifyAccessTokenProvider{
  readonly #fetch:typeof globalThis.fetch;readonly #now:()=>Date;
  constructor(private readonly connections:IntegrationConnectionRepository,private readonly options:Readonly<{apiKey:string;apiSecret:string;fetch?:typeof globalThis.fetch;now?:()=>Date;refreshBeforeSeconds?:number}>){
    if(!options.apiKey||!options.apiSecret)throw new Error("Shopify OAuth client credentials are required for token refresh");this.#fetch=options.fetch??globalThis.fetch;this.#now=options.now??(()=>new Date());
  }
  async resolve(workspaceId:string):Promise<ShopifyWorkspaceAccess|null>{
    const current=await this.#read(workspaceId);if(!current)return null;if(!this.#needsRefresh(current.credentials))return{shopDomain:current.shopDomain,accessToken:current.credentials.accessToken!};
    if(typeof this.connections.withCredentialRotationLock==="function")return this.connections.withCredentialRotationLock(workspaceId,"SHOPIFY",()=>this.#resolveLocked(workspaceId));
    return this.#resolveLocked(workspaceId);
  }
  async #read(workspaceId:string){
    const connection=(await this.connections.list(workspaceId)).find(item=>item.provider==="SHOPIFY"&&item.status==="CONNECTED");if(!connection)return null;
    const credentials=await this.connections.credentials(workspaceId,"SHOPIFY");if(!credentials?.accessToken)return null;
    return{shopDomain:connection.accountLabel,credentials};
  }
  #needsRefresh(credentials:Record<string,string>){if(!credentials.accessTokenExpiresAt)return false;const expiresAt=Date.parse(credentials.accessTokenExpiresAt),refreshAt=this.#now().getTime()+(this.options.refreshBeforeSeconds??300)*1000;return!Number.isFinite(expiresAt)||expiresAt<=refreshAt;}
  async #resolveLocked(workspaceId:string):Promise<ShopifyWorkspaceAccess|null>{
    const current=await this.#read(workspaceId);if(!current)return null;const{shopDomain,credentials}=current;if(!this.#needsRefresh(credentials))return{shopDomain,accessToken:credentials.accessToken!};
    const now=this.#now();
    const refreshExpiresAt=Date.parse(credentials.refreshTokenExpiresAt??"");
    if(!credentials.refreshToken||!Number.isFinite(refreshExpiresAt)||refreshExpiresAt<=now.getTime()){await this.#reauth(workspaceId,"Shopify refresh token expired");return null;}
    let response:Response;try{response=await this.#fetch(`https://${shopDomain}/admin/oauth/access_token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body:new URLSearchParams({client_id:this.options.apiKey,client_secret:this.options.apiSecret,grant_type:"refresh_token",refresh_token:credentials.refreshToken})});}catch(error){await this.#recordFailure(workspaceId,error instanceof Error?error.message:String(error));throw error;}
    const body=await response.json().catch(()=>({})) as Record<string,unknown>;
    if(!response.ok){if(response.status===401&&body.error==="invalid_request"&&body.error_description==="This request requires an active refresh_token"){await this.#reauth(workspaceId,"Shopify refresh token is no longer active");return null;}const error=`Shopify token refresh failed (${response.status})`;await this.#recordFailure(workspaceId,error);throw Object.assign(new Error(error),{status:response.status});}
    const token=parseShopifyOfflineTokenResponse(body,this.#now());
    await this.connections.upsert({workspaceId,provider:"SHOPIFY",accountLabel:shopDomain,credentials:token.credentials,metadata:token.metadata,actorId:"shopify-token-refresh"});
    return{shopDomain,accessToken:token.credentials.accessToken!};
  }
  async #reauth(workspaceId:string,reason:string){await this.connections.markReauthRequired({workspaceId,provider:"SHOPIFY",actorId:"shopify-token-refresh",reason});}
  async #recordFailure(workspaceId:string,error:string){if(typeof this.connections.recordCredentialRefreshFailure==="function")await this.connections.recordCredentialRefreshFailure({workspaceId,provider:"SHOPIFY",error});}
}
