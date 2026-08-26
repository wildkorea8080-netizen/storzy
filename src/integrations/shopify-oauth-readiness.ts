const present=(value:string|undefined)=>Boolean(value?.trim());

export type ShopifyOAuthReadiness=Readonly<{
  ready:boolean;
  callbackUrl:string|null;
  scopes:readonly string[];
  checks:Readonly<{
    clientCredentials:boolean;
    credentialEncryption:boolean;
    publicHttpsCallback:boolean;
    callbackPath:boolean;
    callbackOrigin:boolean;
    requiredScopes:boolean;
  }>;
  missing:readonly string[];
}>;

export function shopifyOAuthReadinessFromEnv(env:NodeJS.ProcessEnv):ShopifyOAuthReadiness{
  const rawCallback=env.SHOPIFY_OAUTH_CALLBACK_URL?.trim()||"";
  const rawPublicUrl=env.PUBLIC_APP_URL?.trim()||"";
  const scopes=(env.SHOPIFY_SCOPES??"").split(",").map(scope=>scope.trim()).filter(Boolean);
  let callbackUrl:string|null=null,publicHttpsCallback=false,callbackPath=false,callbackOrigin=false;
  try{
    if(rawCallback){
      const parsed=new URL(rawCallback);
      callbackUrl=parsed.href;
      publicHttpsCallback=parsed.protocol==="https:"&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash&&!['localhost','127.0.0.1','::1'].includes(parsed.hostname);
      callbackPath=parsed.pathname==="/api/integrations/shopify/oauth/callback";
      if(rawPublicUrl)callbackOrigin=parsed.origin===new URL(rawPublicUrl).origin;
    }
  }catch{/* invalid callback is reported by the checks */}
  const checks={
    clientCredentials:present(env.SHOPIFY_API_KEY)&&present(env.SHOPIFY_API_SECRET),
    credentialEncryption:isValidCredentialKey(env.INTEGRATION_CREDENTIAL_KEY_BASE64),
    publicHttpsCallback,
    callbackPath,
    callbackOrigin,
    requiredScopes:["write_products","write_content","read_orders"].every(scope=>scopes.includes(scope)),
  };
  const missing=[
    ...(!checks.clientCredentials?["SHOPIFY_API_KEY / SHOPIFY_API_SECRET"]:[]),
    ...(!checks.credentialEncryption?["INTEGRATION_CREDENTIAL_KEY_BASE64"]:[]),
    ...(!checks.publicHttpsCallback?["SHOPIFY_OAUTH_CALLBACK_URL (공개 HTTPS)"]:[]),
    ...(!checks.callbackPath?["SHOPIFY_OAUTH_CALLBACK_URL callback 경로"]:[]),
    ...(!checks.callbackOrigin?["SHOPIFY_OAUTH_CALLBACK_URL / PUBLIC_APP_URL origin 일치"]:[]),
    ...(!checks.requiredScopes?["SHOPIFY_SCOPES (write_products, write_content, read_orders)"]:[]),
  ];
  return{ready:Object.values(checks).every(Boolean),callbackUrl,scopes,checks,missing};
}

function isValidCredentialKey(value:string|undefined):boolean{
  const normalized=value?.trim();
  if(!normalized)return false;
  try{const decoded=Buffer.from(normalized,"base64");return decoded.byteLength===32&&decoded.toString("base64")===normalized;}catch{return false;}
}
