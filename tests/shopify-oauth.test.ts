import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parseShopifyOfflineTokenResponse, ShopifyOAuthService, shopifyOAuthMessage, verifyShopifyOAuthHmac } from "../src/integrations/shopify-oauth.js";

describe("Shopify OAuth",()=>{
  it("creates a signed one-time state and stores the granted offline token encrypted through the repository",async()=>{
    let pending:{workspace_id:string;shop_domain:string;actor_id:string}|null=null,used=false;
    let tokenRequestBody="";const pool={query:vi.fn(async(sql:string,params:unknown[])=>{if(sql.startsWith("INSERT INTO shopify_oauth_states")){pending={workspace_id:String(params[1]),shop_domain:String(params[3]),actor_id:String(params[4])};return{rows:[]};}if(sql.startsWith("UPDATE shopify_oauth_states")){if(used||!pending)return{rows:[]};used=true;return{rows:[pending]};}throw new Error("unexpected query");})},upsert=vi.fn(),connections={upsert},fetch=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>{tokenRequestBody=String(init?.body??"");return new Response(JSON.stringify({access_token:"offline-secret",expires_in:3600,refresh_token:"refresh-secret",refresh_token_expires_in:7776000,scope:"write_products,read_orders"}),{status:200,headers:{"Content-Type":"application/json"}})}),secret="client-secret";
    const oauth=new ShopifyOAuthService(pool as never,connections as never,{apiKey:"client-key",apiSecret:secret,callbackUrl:"https://app.example/api/integrations/shopify/oauth/callback",scopes:["write_products","read_orders"],fetch:fetch as typeof globalThis.fetch,now:()=>new Date("2026-08-12T00:00:00Z")});
    const started=await oauth.begin({workspaceId:"workspace-1",shopDomain:"seoul.myshopify.com",actorId:"admin"}),url=new URL(started.authorizationUrl),state=url.searchParams.get("state")!;
    expect(url.origin).toBe("https://seoul.myshopify.com");expect(url.searchParams.get("client_id")).toBe("client-key");expect(started.cookie).toContain("HttpOnly");expect(started.cookie).toContain("SameSite=Lax");expect(started.cookie).toContain("Secure");
    const callback=new URLSearchParams({code:"authorization-code",shop:"seoul.myshopify.com",state,timestamp:"1"});callback.set("hmac",createHmac("sha256",secret).update(shopifyOAuthMessage(callback)).digest("hex"));
    await expect(oauth.complete(callback,started.cookie.split(";",1)[0])).resolves.toEqual({workspaceId:"workspace-1",shopDomain:"seoul.myshopify.com",scopes:["write_products","read_orders"]});
    expect(tokenRequestBody).toContain("expiring=1");
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({workspaceId:"workspace-1",provider:"SHOPIFY",accountLabel:"seoul.myshopify.com",credentials:{accessToken:"offline-secret",refreshToken:"refresh-secret",accessTokenExpiresAt:"2026-08-12T01:00:00.000Z",refreshTokenExpiresAt:"2026-11-10T00:00:00.000Z"},metadata:{scopes:["write_products","read_orders"],tokenMode:"EXPIRING",accessTokenExpiresAt:"2026-08-12T01:00:00.000Z",refreshTokenExpiresAt:"2026-11-10T00:00:00.000Z"}}));
    await expect(oauth.complete(callback,started.cookie.split(";",1)[0])).rejects.toThrow("expired or already used");
  });

  it("rejects invalid HMAC, state cookies, shops and missing scopes",async()=>{
    const params=new URLSearchParams({shop:"bad.example.com",state:"x",code:"x",hmac:"0".repeat(64)});expect(verifyShopifyOAuthHmac(params,"secret")).toBe(false);
    const pool={query:vi.fn()},oauth=new ShopifyOAuthService(pool as never,{upsert:vi.fn()} as never,{apiKey:"key",apiSecret:"secret",callbackUrl:"http://localhost/callback",scopes:["write_products"],fetch:vi.fn() as never});
    await expect(oauth.complete(params,undefined)).rejects.toThrow("Invalid Shopify OAuth callback");expect(pool.query).not.toHaveBeenCalled();
  });

  it("keeps legacy non-expiring token responses readable and rejects partial expiring responses",()=>{
    expect(parseShopifyOfflineTokenResponse({access_token:"legacy",scope:"read_orders"})).toEqual({credentials:{accessToken:"legacy"},scopes:["read_orders"],metadata:{scopes:["read_orders"],tokenMode:"NON_EXPIRING"}});
    expect(()=>parseShopifyOfflineTokenResponse({access_token:"token",scope:"read_orders",expires_in:3600})).toThrow("Invalid Shopify expiring token response");
  });
});
