export type WebhookReadinessItem=Readonly<{provider:"SHOPIFY"|"PRINTFUL";ready:boolean;endpoint:string|null;checks:Readonly<{publicUrl:boolean;signatureVerification:boolean;workspaceTarget:boolean}>;missing:readonly string[]}>;
import {isValidPrintfulWebhookSecret} from "./printful.js";
export type WebhookReadiness=Readonly<{shopify:WebhookReadinessItem;printful:WebhookReadinessItem}>;

const present=(value:string|undefined)=>Boolean(value?.trim());
const endpoint=(base:string|null,path:string)=>base?new URL(path,base.endsWith("/")?base:`${base}/`).href:null;

export function webhookReadinessFromEnv(env:NodeJS.ProcessEnv,workspaceId:string,hasStoredShopify=false,hasStoredPrintful=false):WebhookReadiness{
  const rawBase=env.PUBLIC_APP_URL?.trim()||(env.PREVIEW_MODE==="1"?"http://localhost:3000":null);
  let base:string|null=null,publicHttps=false;
  try{if(rawBase){const parsed=new URL(rawBase);publicHttps=parsed.protocol==="https:"&&!['localhost','127.0.0.1','::1'].includes(parsed.hostname);if(publicHttps||(env.PREVIEW_MODE==="1"&&parsed.protocol==="http:"))base=parsed.origin;}}catch{/* invalid URL is reported as missing */}
  const shopifyChecks={publicUrl:publicHttps,signatureVerification:present(env.SHOPIFY_WEBHOOK_SECRET)||present(env.SHOPIFY_API_SECRET),workspaceTarget:hasStoredShopify||env.SHOPIFY_ORDER_WORKSPACE_ID?.trim()===workspaceId};
  const printfulChecks={publicUrl:publicHttps,signatureVerification:isValidPrintfulWebhookSecret(env.PRINTFUL_WEBHOOK_SECRET_HEX),workspaceTarget:hasStoredPrintful||present(env.PRINTFUL_STORE_ID)};
  const item=(provider:"SHOPIFY"|"PRINTFUL",path:string,checks:typeof shopifyChecks,missing:string[]):WebhookReadinessItem=>({provider,ready:Object.values(checks).every(Boolean),endpoint:endpoint(base,path),checks,missing});
  return{
    shopify:item("SHOPIFY","/webhooks/shopify/orders",shopifyChecks,[...(!publicHttps?["PUBLIC_APP_URL (공개 HTTPS)"]:[]),...(!shopifyChecks.signatureVerification?["SHOPIFY_WEBHOOK_SECRET 또는 SHOPIFY_API_SECRET"]:[]),...(!shopifyChecks.workspaceTarget?["Shopify 저장 연결 또는 SHOPIFY_ORDER_WORKSPACE_ID"]:[])]),
    printful:item("PRINTFUL","/webhooks/printful",printfulChecks,[...(!publicHttps?["PUBLIC_APP_URL (공개 HTTPS)"]:[]),...(!printfulChecks.signatureVerification?["PRINTFUL_WEBHOOK_SECRET_HEX (최소 32바이트 hex)"]:[]),...(!printfulChecks.workspaceTarget?["Printful 저장 연결 또는 PRINTFUL_STORE_ID"]:[])]),
  };
}
