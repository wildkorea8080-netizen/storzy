import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type pg from "pg";
import type { IntegrationConnectionRepository } from "./connection-repository.js";

const SHOP=/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const safeEqual=(a:string,b:string)=>{const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right)};

export function shopifyOAuthMessage(params:URLSearchParams):string{
  return [...params.entries()].filter(([key])=>key!=="hmac").sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join("&");
}

export function verifyShopifyOAuthHmac(params:URLSearchParams,secret:string):boolean{
  const supplied=params.get("hmac");if(!supplied||!/^[0-9a-f]{64}$/i.test(supplied))return false;
  return safeEqual(createHmac("sha256",secret).update(shopifyOAuthMessage(params)).digest("hex"),supplied);
}

type OAuthOptions=Readonly<{apiKey:string;apiSecret:string;callbackUrl:string;scopes:readonly string[];fetch?:typeof globalThis.fetch;ttlSeconds?:number;now?:()=>Date}>;
type ShopifyOfflineTokenResponse=Readonly<{access_token?:unknown;scope?:unknown;expires_in?:unknown;refresh_token?:unknown;refresh_token_expires_in?:unknown}>;

export function parseShopifyOfflineTokenResponse(body:ShopifyOfflineTokenResponse,now=new Date()):Readonly<{credentials:Record<string,string>;scopes:string[];metadata:Record<string,unknown>}>{
  if(typeof body.access_token!=="string"||!body.access_token||typeof body.scope!=="string"||!body.scope)throw Object.assign(new Error("Invalid Shopify OAuth token response"),{status:502});
  const scopes=body.scope.split(",").map(value=>value.trim()).filter(Boolean),hasExpiry=body.expires_in!==undefined||body.refresh_token!==undefined||body.refresh_token_expires_in!==undefined;
  if(!hasExpiry)return{credentials:{accessToken:body.access_token},scopes,metadata:{scopes,tokenMode:"NON_EXPIRING"}};
  if(!Number.isInteger(body.expires_in)||Number(body.expires_in)<=0||typeof body.refresh_token!=="string"||!body.refresh_token||!Number.isInteger(body.refresh_token_expires_in)||Number(body.refresh_token_expires_in)<=0)throw Object.assign(new Error("Invalid Shopify expiring token response"),{status:502});
  const accessTokenExpiresAt=new Date(now.getTime()+Number(body.expires_in)*1000).toISOString(),refreshTokenExpiresAt=new Date(now.getTime()+Number(body.refresh_token_expires_in)*1000).toISOString();
  return{credentials:{accessToken:body.access_token,refreshToken:body.refresh_token,accessTokenExpiresAt,refreshTokenExpiresAt},scopes,metadata:{scopes,tokenMode:"EXPIRING",accessTokenExpiresAt,refreshTokenExpiresAt}};
}

export class ShopifyOAuthService{
  readonly #fetch:typeof globalThis.fetch;
  constructor(readonly pool:pg.Pool,readonly connections:IntegrationConnectionRepository,readonly options:OAuthOptions){
    if(!options.apiKey||!options.apiSecret)throw new Error("Shopify OAuth client credentials are required");
    if(!/^https?:\/\//.test(options.callbackUrl))throw new Error("Invalid Shopify OAuth callback URL");
    if(!options.scopes.length)throw new Error("At least one Shopify scope is required");
    this.#fetch=options.fetch??globalThis.fetch;
  }

  async begin(input:{workspaceId:string;shopDomain:string;actorId:string}):Promise<{authorizationUrl:string;cookie:string}>{
    if(!SHOP.test(input.shopDomain))throw Object.assign(new Error("Invalid Shopify shop domain"),{status:400});
    const state=randomBytes(32).toString("base64url"),signature=createHmac("sha256",this.options.apiSecret).update(state).digest("base64url"),expires=new Date(Date.now()+(this.options.ttlSeconds??600)*1000);
    await this.pool.query("INSERT INTO shopify_oauth_states(id,workspace_id,state_digest,shop_domain,actor_id,expires_at) VALUES($1,$2,$3,$4,$5,$6)",[randomUUID(),input.workspaceId,digest(state),input.shopDomain,input.actorId,expires]);
    const url=new URL(`https://${input.shopDomain}/admin/oauth/authorize`);url.searchParams.set("client_id",this.options.apiKey);url.searchParams.set("scope",this.options.scopes.join(","));url.searchParams.set("redirect_uri",this.options.callbackUrl);url.searchParams.set("state",state);
    const secure=this.options.callbackUrl.startsWith("https://")?"; Secure":"";
    return {authorizationUrl:url.href,cookie:`storzy_shopify_oauth=${state}.${signature}; Path=/api/integrations/shopify/oauth/callback; HttpOnly; SameSite=Lax; Max-Age=${this.options.ttlSeconds??600}${secure}`};
  }

  async complete(params:URLSearchParams,cookieHeader:string|undefined):Promise<{workspaceId:string;shopDomain:string;scopes:string[]}>{
    const state=params.get("state")??"",shop=params.get("shop")??"",code=params.get("code")??"";
    if(!state||!code||!SHOP.test(shop)||!verifyShopifyOAuthHmac(params,this.options.apiSecret))throw Object.assign(new Error("Invalid Shopify OAuth callback"),{status:400});
    const cookie=(cookieHeader??"").split(";").map(x=>x.trim()).find(x=>x.startsWith("storzy_shopify_oauth="))?.slice("storzy_shopify_oauth=".length),[cookieState,cookieSignature]=cookie?.split(".")??[];
    const expected=createHmac("sha256",this.options.apiSecret).update(state).digest("base64url");
    if(!cookieState||!cookieSignature||!safeEqual(cookieState,state)||!safeEqual(cookieSignature,expected))throw Object.assign(new Error("Invalid Shopify OAuth state cookie"),{status:400});
    const claimed=await this.pool.query<{workspace_id:string;shop_domain:string;actor_id:string}>("UPDATE shopify_oauth_states SET used_at=now() WHERE state_digest=$1 AND shop_domain=$2 AND used_at IS NULL AND expires_at>now() RETURNING workspace_id,shop_domain,actor_id",[digest(state),shop]);
    const pending=claimed.rows[0];if(!pending)throw Object.assign(new Error("Shopify OAuth state expired or already used"),{status:400});
    const response=await this.#fetch(`https://${shop}/admin/oauth/access_token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body:new URLSearchParams({client_id:this.options.apiKey,client_secret:this.options.apiSecret,code,expiring:"1"})});
    if(!response.ok)throw Object.assign(new Error("Shopify OAuth token exchange failed"),{status:502});
    const token=parseShopifyOfflineTokenResponse(await response.json() as ShopifyOfflineTokenResponse,this.options.now?.()??new Date()),granted=token.scopes,missing=this.options.scopes.filter(scope=>!granted.includes(scope));
    if(missing.length)throw Object.assign(new Error("Shopify did not grant all required scopes"),{status:403});
    await this.connections.upsert({workspaceId:pending.workspace_id,provider:"SHOPIFY",accountLabel:shop,credentials:token.credentials,metadata:token.metadata,actorId:pending.actor_id});
    return {workspaceId:pending.workspace_id,shopDomain:shop,scopes:granted};
  }
}
