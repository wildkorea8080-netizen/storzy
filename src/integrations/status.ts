export type ProviderConnectionStatus = Readonly<{
  provider: "SHOPIFY" | "PRINTFUL";
  status: "CONNECTED" | "PARTIAL" | "NOT_CONFIGURED" | "REAUTH_REQUIRED";
  accountLabel: string | null;
  capabilities: Readonly<Record<string, boolean>>;
  missing: readonly string[];
  source: "WORKSPACE" | "ENVIRONMENT" | "NONE";
  tokenHealth?:Readonly<{mode:"EXPIRING"|"NON_EXPIRING"|"UNKNOWN";state:"VALID"|"EXPIRING_SOON"|"EXPIRED"|"REAUTH_REQUIRED"|"LEGACY"|"UNKNOWN";accessTokenExpiresAt:string|null;refreshTokenExpiresAt:string|null;reason:string|null}>;
}>;

export type IntegrationStatus = Readonly<{
  shopify: ProviderConnectionStatus;
  printful: ProviderConnectionStatus;
  tokenMetrics:Readonly<{reauthRequired:number;expiringSoon:number;expired:number}>;
}>;

type StoredSummary=Readonly<{provider:"SHOPIFY"|"PRINTFUL";status:"CONNECTED"|"DISCONNECTED"|"REAUTH_REQUIRED";accountLabel:string;metadata?:Record<string,unknown>}>;

const present = (value: string | undefined): boolean => Boolean(value?.trim());

export function integrationStatusFromEnv(env: NodeJS.ProcessEnv): IntegrationStatus {
  const shopDomain=env.SHOPIFY_SHOP_DOMAIN?.trim()||null;
  const shopifyMissing=[
    ...(!present(env.SHOPIFY_SHOP_DOMAIN)?["SHOPIFY_SHOP_DOMAIN"]:[]),
    ...(!present(env.SHOPIFY_ADMIN_ACCESS_TOKEN)?["SHOPIFY_ADMIN_ACCESS_TOKEN"]:[]),
  ];
  const shopifyCapabilities={
    oauth:present(env.SHOPIFY_API_KEY)&&present(env.SHOPIFY_API_SECRET),
    adminApi:shopifyMissing.length===0,
    orderWebhook:present(env.SHOPIFY_WEBHOOK_SECRET)&&present(env.SHOPIFY_ORDER_WORKSPACE_ID),
  };
  const printfulMissing=[
    ...(!present(env.PRINTFUL_TOKEN)?["PRINTFUL_TOKEN"]:[]),
    ...(!present(env.PRINTFUL_STORE_ID)?["PRINTFUL_STORE_ID"]:[]),
  ];
  const printfulCapabilities={
    api:present(env.PRINTFUL_TOKEN),
    storeScope:present(env.PRINTFUL_STORE_ID),
    webhook:isValidPrintfulWebhookSecret(env.PRINTFUL_WEBHOOK_SECRET_HEX),
  };
  const status=(ready:boolean,configured:boolean):ProviderConnectionStatus["status"]=>ready?"CONNECTED":configured?"PARTIAL":"NOT_CONFIGURED";
  return {
    shopify:{provider:"SHOPIFY",status:status(shopifyCapabilities.adminApi,shopifyMissing.length<2),accountLabel:shopDomain,capabilities:shopifyCapabilities,missing:shopifyMissing,source:shopifyMissing.length<2?"ENVIRONMENT":"NONE"},
    printful:{provider:"PRINTFUL",status:status(printfulCapabilities.api&&printfulCapabilities.storeScope,printfulMissing.length<2),accountLabel:env.PRINTFUL_STORE_ID?.trim()||null,capabilities:printfulCapabilities,missing:printfulMissing,source:printfulMissing.length<2?"ENVIRONMENT":"NONE"},tokenMetrics:{reauthRequired:0,expiringSoon:0,expired:0},
  };
}

export function mergeStoredIntegrationStatus(base:IntegrationStatus,stored:readonly StoredSummary[],now=new Date()):IntegrationStatus{
  const shopify=stored.find(item=>item.provider==="SHOPIFY"&&item.status!=="DISCONNECTED"),printful=stored.find(item=>item.provider==="PRINTFUL"&&item.status==="CONNECTED"),metadata=shopify?.metadata??{},mode:NonNullable<ProviderConnectionStatus["tokenHealth"]>["mode"]=metadata.tokenMode==="EXPIRING"?"EXPIRING":metadata.tokenMode==="NON_EXPIRING"?"NON_EXPIRING":"UNKNOWN",accessTokenExpiresAt=typeof metadata.accessTokenExpiresAt==="string"?metadata.accessTokenExpiresAt:null,refreshTokenExpiresAt=typeof metadata.refreshTokenExpiresAt==="string"?metadata.refreshTokenExpiresAt:null,accessExpiry=accessTokenExpiresAt?Date.parse(accessTokenExpiresAt):NaN,expired=Number.isFinite(accessExpiry)&&accessExpiry<=now.getTime(),expiringSoon=Number.isFinite(accessExpiry)&&accessExpiry>now.getTime()&&accessExpiry<=now.getTime()+24*60*60*1000,state:NonNullable<ProviderConnectionStatus["tokenHealth"]>["state"]=shopify?.status==="REAUTH_REQUIRED"?"REAUTH_REQUIRED":mode==="NON_EXPIRING"?"LEGACY":expired?"EXPIRED":expiringSoon?"EXPIRING_SOON":mode==="EXPIRING"?"VALID":"UNKNOWN",tokenHealth=shopify?{mode,state,accessTokenExpiresAt,refreshTokenExpiresAt,reason:typeof metadata.reauthReason==="string"?metadata.reauthReason:null}:undefined,mergedShopify:ProviderConnectionStatus=shopify?{...base.shopify,status:shopify.status==="REAUTH_REQUIRED"?"REAUTH_REQUIRED":"CONNECTED",accountLabel:shopify.accountLabel,capabilities:{...base.shopify.capabilities,oauth:true,adminApi:shopify.status==="CONNECTED"},missing:shopify.status==="REAUTH_REQUIRED"?["SHOPIFY_REAUTHORIZATION"]:[],source:"WORKSPACE",...(tokenHealth?{tokenHealth}:{})}:base.shopify;
  return {
    shopify:mergedShopify,
    printful:printful?{...base.printful,status:"CONNECTED",accountLabel:printful.accountLabel,capabilities:{...base.printful.capabilities,api:true,storeScope:true},missing:[],source:"WORKSPACE"}:base.printful,
    tokenMetrics:{reauthRequired:state==="REAUTH_REQUIRED"?1:0,expiringSoon:state==="EXPIRING_SOON"?1:0,expired:state==="EXPIRED"?1:0},
  };
}
import {isValidPrintfulWebhookSecret} from "./printful.js";
