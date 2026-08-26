export type ProductionTemplates=Readonly<{env:string;shopifyToml:string;processManifest:string}>;
const workerCommands=[["generation","npm run start:worker"],["outbox","npm run start:outbox"],["candidate","npm run start:candidate"],["content","npm run start:content"],["mockup","npm run start:mockup"],["shopify-product","npm run start:shopify"],["shopify-storefront","npm run start:storefront"],["printful-order","npm run start:printful-order"],["shopify-fulfillment","npm run start:shopify-fulfillment"]]as const;

export const productionProcesses=()=>({version:1,processes:[
  {name:"api",type:"service",command:"node dist/src/process-supervisor.js api service npm start",replicas:1},
  ...workerCommands.map(([name,child])=>({name,type:"worker",command:`node dist/src/process-supervisor.js ${name} worker ${child}`,replicas:1})),
  {name:"privacy-sla-scan",type:"scheduler",command:"node dist/src/process-supervisor.js privacy-sla-scan scheduler npm run start:privacy-sla:scan",schedule:"0 * * * *"},
  {name:"privacy-alert-delivery",type:"scheduler",command:"node dist/src/process-supervisor.js privacy-alert-delivery scheduler npm run start:privacy-alerts:deliver",schedule:"*/5 * * * *"},
  {name:"order-reconciliation",type:"scheduler",command:"node dist/src/process-supervisor.js order-reconciliation scheduler npm run start:order-reconciliation:scan",schedule:"0 * * * *"},
  {name:"shopify-token-alert-delivery",type:"scheduler",command:"node dist/src/process-supervisor.js shopify-token-alert-delivery scheduler npm run start:shopify-token-alerts:deliver",schedule:"*/5 * * * *"},
  {name:"admin-auth-retention",type:"scheduler",command:"node dist/src/process-supervisor.js admin-auth-retention scheduler npm run start:admin-auth:cleanup",schedule:"*/5 * * * *"},
]});

const publicOrigin=(raw:string)=>{
  let url:URL;
  try{url=new URL(raw)}catch{throw new Error("Public URL must be a valid URL")}
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/"||['localhost','127.0.0.1','::1'].includes(url.hostname))throw new Error("Public URL must be a public HTTPS origin");
  return url.origin;
};

export function buildProductionTemplates(input:Readonly<{publicUrl:string;shopifyClientId:string;apiVersion?:string}>):ProductionTemplates{
  const origin=publicOrigin(input.publicUrl.trim()),clientId=input.shopifyClientId.trim(),apiVersion=input.apiVersion?.trim()||"2026-07";
  if(!/^[A-Za-z0-9_-]{8,128}$/.test(clientId))throw new Error("Shopify client ID format is invalid");
  if(!/^20\d{2}-(01|04|07|10)$/.test(apiVersion))throw new Error("Shopify API version format is invalid");
  const callback=`${origin}/api/integrations/shopify/oauth/callback`;
  const env=`# STORZY production deployment template
# Replace every __SECRET_*__ value through the deployment platform's Secret Manager.
NODE_ENV=production
PORT=3000
PUBLIC_APP_URL=${origin}
LOG_LEVEL=info
SHUTDOWN_DRAIN_MS=5000
SHUTDOWN_TIMEOUT_MS=30000
DATABASE_URL=__SECRET_DATABASE_URL__
ADMIN_API_TOKEN=__SECRET_ADMIN_API_TOKEN_32_CHARS_MIN__
ADMIN_SESSION_TTL_SECONDS=28800
ADMIN_LOGIN_MAX_ATTEMPTS=5
ADMIN_LOGIN_WINDOW_SECONDS=900
ADMIN_AUTH_EVENT_RETENTION_DAYS=90
ADMIN_SESSION_RECORD_RETENTION_DAYS=30
ADMIN_SECURITY_ALERT_WEBHOOK_URL=__ADMIN_SECURITY_ALERT_WEBHOOK_URL_HTTPS__
ADMIN_SECURITY_ALERT_WEBHOOK_SECRET=__SECRET_ADMIN_SECURITY_ALERT_WEBHOOK_SECRET_16_CHARS_MIN__
ADMIN_SECURITY_ALERT_BATCH_SIZE=20
INTEGRATION_CREDENTIAL_KEY_BASE64=__SECRET_32_BYTE_BASE64_KEY__
INTEGRATION_CREDENTIAL_KEY_VERSION=v1
OPENAI_API_KEY=__SECRET_OPENAI_API_KEY__
OPENAI_MODEL=gpt-5.6-sol
SHOPIFY_API_VERSION=${apiVersion}
SHOPIFY_API_KEY=${clientId}
SHOPIFY_API_SECRET=__SECRET_SHOPIFY_API_SECRET__
SHOPIFY_OAUTH_CALLBACK_URL=${callback}
SHOPIFY_SCOPES=write_products,write_content,read_orders
SHOPIFY_WEBHOOK_SECRET=__SECRET_SHOPIFY_WEBHOOK_SECRET__
SHOPIFY_TOKEN_ALERT_WEBHOOK_URL=__SHOPIFY_TOKEN_ALERT_WEBHOOK_URL_HTTPS__
SHOPIFY_TOKEN_ALERT_WEBHOOK_SECRET=__SECRET_SHOPIFY_TOKEN_ALERT_WEBHOOK_SECRET_16_CHARS_MIN__
SHOPIFY_TOKEN_ALERT_SCHEDULE=*/5 * * * *
SHOPIFY_TOKEN_ALERT_COMMAND=node dist/src/process-supervisor.js shopify-token-alert-delivery scheduler npm run start:shopify-token-alerts:deliver
SHOPIFY_TOKEN_ALERT_MAX_ATTEMPTS=6
SHOPIFY_TOKEN_ALERT_LEASE_SECONDS=30
SHOPIFY_TOKEN_ALERT_BATCH_SIZE=20
PRINTFUL_API_BASE_URL=https://api.printful.com
PRINTFUL_WEBHOOK_SECRET_HEX=__SECRET_32_BYTE_HEX_KEY__
ORDER_ALLOWED_COUNTRIES=US,JP
ORDER_MAX_AMOUNT_MINOR=50000
ORDER_MAX_ITEM_COUNT=10
ORDER_MAX_COST_INCREASE_BPS=1000
PRINTFUL_ORDER_RATE_LIMIT_PER_MINUTE=2
`;
  const shopifyToml=`name = "STORZY"
client_id = "${clientId}"
application_url = "${origin}"
embedded = false

[build]
include_config_on_deploy = true

[access_scopes]
scopes = "write_products,write_content,read_orders"

[auth]
redirect_urls = ["${callback}"]

[webhooks]
api_version = "${apiVersion}"

[[webhooks.subscriptions]]
topics = ["app/uninstalled"]
uri = "/webhooks/shopify/app-uninstalled"

[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request"]
uri = "/webhooks/shopify/privacy/customers/data_request"

[[webhooks.subscriptions]]
compliance_topics = ["customers/redact"]
uri = "/webhooks/shopify/privacy/customers/redact"

[[webhooks.subscriptions]]
compliance_topics = ["shop/redact"]
uri = "/webhooks/shopify/privacy/shop/redact"
`;
  return{env,shopifyToml,processManifest:JSON.stringify(productionProcesses(),null,2)+"\n"};
}
