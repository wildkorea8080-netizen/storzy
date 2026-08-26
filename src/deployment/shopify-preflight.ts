import {shopifyOAuthReadinessFromEnv} from "../integrations/shopify-oauth-readiness.js";
import {isValidPrintfulWebhookSecret} from "../integrations/printful.js";
import{productionProcesses}from"./production-templates.js";

export type PreflightCheck=Readonly<{key:string;ok:boolean;message:string}>;
export type ShopifyDeploymentPreflight=Readonly<{ready:boolean;checks:readonly PreflightCheck[]}>;

const value=(source:string,key:string)=>source.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`,`m`))?.[1]?.trim()??"";
const array=(source:string,key:string)=>{const body=source.match(new RegExp(`^\\s*${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`,`m`))?.[1]??"";return[...body.matchAll(/"([^"]+)"/g)].map(match=>match[1]!.trim())};
const topics=(source:string)=>[...source.matchAll(/(?:compliance_)?topics\s*=\s*\[([\s\S]*?)\]/g)].flatMap(match=>[...(match[1]??"").matchAll(/"([^"]+)"/g)].map(item=>item[1]!.trim()));
const sameUrl=(left:string,right:string)=>{try{return new URL(left).href===new URL(right).href}catch{return false}};
const realSecret=(value:string|undefined,minLength=1)=>Boolean(value?.trim()&&value.trim().length>=minLength&&!value.trim().startsWith("__SECRET_"));
const databaseUrl=(value:string|undefined)=>{try{const url=new URL(value?.trim()??"");return url.protocol==="postgresql:"||url.protocol==="postgres:"}catch{return false}};
const integerInRange=(raw:string|undefined,min:number,max:number)=>{const number=Number(raw);return Number.isInteger(number)&&number>=min&&number<=max};
const alertSchedule=(raw:string|undefined)=>{const match=raw?.trim().match(/^\*\/(\d+) \* \* \* \*$/),minutes=Number(match?.[1]);return Boolean(match&&minutes>=1&&minutes<=60)};
const publicHttps=(raw:string|undefined)=>{try{const url=new URL(raw?.trim()??"");return url.protocol==="https:"&&!url.username&&!url.password&&!['localhost','127.0.0.1','::1'].includes(url.hostname)}catch{return false}};

const processManifestReady=(source:string)=>{try{const actual=JSON.parse(source)as{version?:unknown;processes?:unknown},expected=productionProcesses();if(actual.version!==1||!Array.isArray(actual.processes))return false;const rows=new Map(actual.processes.filter((item):item is Record<string,unknown>=>Boolean(item&&typeof item==="object")).map(item=>[item.name,item]));return expected.processes.every(item=>{const row=rows.get(item.name);return row?.type===item.type&&row.command===item.command&&("schedule"in item?row.schedule===item.schedule:row.replicas===1)})}catch{return false}};

export function checkShopifyDeployment(env:NodeJS.ProcessEnv,toml:string,processManifest=""):ShopifyDeploymentPreflight{
  const oauth=shopifyOAuthReadinessFromEnv(env),clientId=value(toml,"client_id"),applicationUrl=value(toml,"application_url"),apiVersion=value(toml,"api_version"),scopeList=value(toml,"scopes").split(",").map(item=>item.trim()).filter(Boolean),redirectUrls=array(toml,"redirect_urls"),configuredTopics=new Set(topics(toml)),requiredScopes=["write_products","write_content","read_orders"],requiredTopics=["customers/data_request","customers/redact","shop/redact"],callback=env.SHOPIFY_OAUTH_CALLBACK_URL?.trim()??"",publicUrl=env.PUBLIC_APP_URL?.trim()??"",expectedVersion=env.SHOPIFY_API_VERSION?.trim()||"2026-07";
  const checks:PreflightCheck[]=[
    {key:"DEPLOYMENT_SECRETS",ok:databaseUrl(env.DATABASE_URL)&&realSecret(env.ADMIN_API_TOKEN,32)&&realSecret(env.OPENAI_API_KEY)&&realSecret(env.SHOPIFY_API_SECRET)&&realSecret(env.SHOPIFY_WEBHOOK_SECRET)&&isValidPrintfulWebhookSecret(env.PRINTFUL_WEBHOOK_SECRET_HEX),message:"DB·관리자·OpenAI·Shopify·Printful 운영 비밀값 준비"},
    {key:"OAUTH_ENV",ok:oauth.ready,message:oauth.ready?"OAuth 환경 설정 완료":`OAuth 누락: ${oauth.missing.join(", ")}`},
    {key:"CLIENT_ID",ok:Boolean(clientId)&&clientId===env.SHOPIFY_API_KEY?.trim()&&clientId!=="replace-with-shopify-client-id",message:"TOML client_id와 SHOPIFY_API_KEY 일치"},
    {key:"APPLICATION_URL",ok:Boolean(publicUrl)&&sameUrl(applicationUrl,publicUrl),message:"TOML application_url과 PUBLIC_APP_URL 일치"},
    {key:"REDIRECT_URL",ok:Boolean(callback)&&redirectUrls.some(url=>sameUrl(url,callback)),message:"OAuth callback이 TOML redirect_urls에 등록됨"},
    {key:"SCOPES",ok:requiredScopes.every(scope=>scopeList.includes(scope))&&requiredScopes.every(scope=>oauth.scopes.includes(scope)),message:"필수 Admin API scope 일치"},
    {key:"API_VERSION",ok:apiVersion===expectedVersion,message:`Webhook API 버전 ${expectedVersion}`},
    {key:"PRIVACY_WEBHOOKS",ok:requiredTopics.every(topic=>configuredTopics.has(topic)),message:"Shopify 개인정보 보호 Webhook 3종 등록"},
    {key:"APP_UNINSTALLED_WEBHOOK",ok:configuredTopics.has("app/uninstalled")&&toml.includes('uri = "/webhooks/shopify/app-uninstalled"'),message:"Shopify 앱 삭제 Webhook 등록"},
    {key:"TOKEN_ALERT_WEBHOOK",ok:publicHttps(env.SHOPIFY_TOKEN_ALERT_WEBHOOK_URL)&&realSecret(env.SHOPIFY_TOKEN_ALERT_WEBHOOK_SECRET,16),message:"Shopify 토큰 알림 HTTPS URL과 서명 비밀키 준비"},
    {key:"TOKEN_ALERT_SCHEDULER",ok:alertSchedule(env.SHOPIFY_TOKEN_ALERT_SCHEDULE)&&env.SHOPIFY_TOKEN_ALERT_COMMAND?.trim()==="node dist/src/process-supervisor.js shopify-token-alert-delivery scheduler npm run start:shopify-token-alerts:deliver",message:"Shopify 토큰 알림 scheduler 1~60분 주기와 실행 명령 확인"},
    {key:"TOKEN_ALERT_RETRY",ok:integerInRange(env.SHOPIFY_TOKEN_ALERT_MAX_ATTEMPTS,1,20)&&integerInRange(env.SHOPIFY_TOKEN_ALERT_LEASE_SECONDS,10,300)&&integerInRange(env.SHOPIFY_TOKEN_ALERT_BATCH_SIZE,1,100),message:"Shopify 토큰 알림 재시도·lease·batch 범위 확인"},
    {key:"PROCESS_MANIFEST",ok:processManifestReady(processManifest),message:"API·worker·scheduler 필수 실행 구성 확인"},
  ];
  return{ready:checks.every(check=>check.ok),checks};
}
