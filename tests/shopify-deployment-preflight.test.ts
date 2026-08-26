import {describe,expect,it} from "vitest";
import {checkShopifyDeployment} from "../src/deployment/shopify-preflight.js";
import{productionProcesses}from"../src/deployment/production-templates.js";

const env={PUBLIC_APP_URL:"https://app.example.com",DATABASE_URL:"postgresql://user:pass@db.example/storzy",ADMIN_API_TOKEN:"a".repeat(32),OPENAI_API_KEY:"openai-secret",SHOPIFY_API_KEY:"client",SHOPIFY_API_SECRET:"secret",SHOPIFY_WEBHOOK_SECRET:"webhook-secret",SHOPIFY_TOKEN_ALERT_WEBHOOK_URL:"https://alerts.example/shopify",SHOPIFY_TOKEN_ALERT_WEBHOOK_SECRET:"alert-secret-1234",SHOPIFY_TOKEN_ALERT_SCHEDULE:"*/5 * * * *",SHOPIFY_TOKEN_ALERT_COMMAND:"node dist/src/process-supervisor.js shopify-token-alert-delivery scheduler npm run start:shopify-token-alerts:deliver",SHOPIFY_TOKEN_ALERT_MAX_ATTEMPTS:"6",SHOPIFY_TOKEN_ALERT_LEASE_SECONDS:"30",SHOPIFY_TOKEN_ALERT_BATCH_SIZE:"20",PRINTFUL_WEBHOOK_SECRET_HEX:"ab".repeat(32),INTEGRATION_CREDENTIAL_KEY_BASE64:Buffer.alloc(32,4).toString("base64"),SHOPIFY_OAUTH_CALLBACK_URL:"https://app.example.com/api/integrations/shopify/oauth/callback",SHOPIFY_SCOPES:"write_products,write_content,read_orders",SHOPIFY_API_VERSION:"2026-07"};
const toml=`client_id = "client"
application_url = "https://app.example.com"
[access_scopes]
scopes = "write_products,write_content,read_orders"
[auth]
redirect_urls = ["https://app.example.com/api/integrations/shopify/oauth/callback"]
[webhooks]
api_version = "2026-07"
[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request"]
[[webhooks.subscriptions]]
compliance_topics = ["customers/redact"]
[[webhooks.subscriptions]]
compliance_topics = ["shop/redact"]
[[webhooks.subscriptions]]
topics = ["app/uninstalled"]
uri = "/webhooks/shopify/app-uninstalled"`;
const manifest=JSON.stringify(productionProcesses());

describe("Shopify 배포 사전점검",()=>{
  it("환경 변수와 앱 설정이 모두 일치하면 통과한다",()=>{const result=checkShopifyDeployment(env,toml,manifest);expect(result.ready).toBe(true);expect(result.checks.every(check=>check.ok)).toBe(true)});
  it("client ID와 redirect URL 불일치를 개별 실패로 보고한다",()=>{const result=checkShopifyDeployment(env,toml.replace('client_id = "client"','client_id = "other"').replace('["https://app.example.com/api/integrations/shopify/oauth/callback"]','["https://other.example/callback"]'),manifest);expect(result.ready).toBe(false);expect(result.checks.find(check=>check.key==="CLIENT_ID")?.ok).toBe(false);expect(result.checks.find(check=>check.key==="REDIRECT_URL")?.ok).toBe(false)});
  it("개인정보 보호 Webhook과 API 버전 누락을 차단한다",()=>{const result=checkShopifyDeployment(env,toml.replace('api_version = "2026-07"','api_version = "2025-10"').replace('compliance_topics = ["shop/redact"]','compliance_topics = ["shop/erase"]'),manifest);expect(result.checks.find(check=>check.key==="API_VERSION")?.ok).toBe(false);expect(result.checks.find(check=>check.key==="PRIVACY_WEBHOOKS")?.ok).toBe(false)});
  it("자리표시자 비밀값은 실제 운영 설정으로 인정하지 않는다",()=>{const result=checkShopifyDeployment({...env,ADMIN_API_TOKEN:"__SECRET_ADMIN_API_TOKEN_32_CHARS_MIN__"},toml,manifest);expect(result.ready).toBe(false);expect(result.checks.find(check=>check.key==="DEPLOYMENT_SECRETS")?.ok).toBe(false);expect(JSON.stringify(result)).not.toContain("ADMIN_API_TOKEN_32")});
  it("토큰 알림 Webhook과 scheduler 설정 오류를 배포 전에 차단한다",()=>{const result=checkShopifyDeployment({...env,SHOPIFY_TOKEN_ALERT_WEBHOOK_URL:"http://localhost/hook",SHOPIFY_TOKEN_ALERT_SCHEDULE:"*/90 * * * *",SHOPIFY_TOKEN_ALERT_BATCH_SIZE:"0"},toml,manifest);expect(result.checks.find(check=>check.key==="TOKEN_ALERT_WEBHOOK")?.ok).toBe(false);expect(result.checks.find(check=>check.key==="TOKEN_ALERT_SCHEDULER")?.ok).toBe(false);expect(result.checks.find(check=>check.key==="TOKEN_ALERT_RETRY")?.ok).toBe(false)});
  it("필수 worker 또는 scheduler 명령이 바뀐 manifest를 차단한다",()=>{const changed=manifest.replace("npm run start:shopify","npm run wrong-command");const result=checkShopifyDeployment(env,toml,changed);expect(result.ready).toBe(false);expect(result.checks.find(check=>check.key==="PROCESS_MANIFEST")?.ok).toBe(false)});
});
