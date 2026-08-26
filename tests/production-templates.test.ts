import {describe,expect,it} from "vitest";
import {buildProductionTemplates} from "../src/deployment/production-templates.js";
import {checkShopifyDeployment} from "../src/deployment/shopify-preflight.js";

describe("운영 배포 템플릿",()=>{
  it("하나의 공개 origin에서 환경 변수와 Shopify 설정을 생성한다",()=>{
    const result=buildProductionTemplates({publicUrl:"https://app.storzy.example",shopifyClientId:"client_12345678"});
    expect(result.env).toContain("PUBLIC_APP_URL=https://app.storzy.example");
    expect(result.env).toContain("SHOPIFY_OAUTH_CALLBACK_URL=https://app.storzy.example/api/integrations/shopify/oauth/callback");
    expect(result.env).toContain("SHOPIFY_TOKEN_ALERT_SCHEDULE=*/5 * * * *");
    expect(result.env).toContain("SHOPIFY_TOKEN_ALERT_COMMAND=node dist/src/process-supervisor.js shopify-token-alert-delivery scheduler npm run start:shopify-token-alerts:deliver");
    expect(result.env).toContain("SHOPIFY_TOKEN_ALERT_WEBHOOK_URL=__SHOPIFY_TOKEN_ALERT_WEBHOOK_URL_HTTPS__");
    const manifest=JSON.parse(result.processManifest);expect(manifest.processes).toHaveLength(15);expect(manifest.processes).toContainEqual({name:"api",type:"service",command:"node dist/src/process-supervisor.js api service npm start",replicas:1});expect(manifest.processes).toContainEqual({name:"shopify-token-alert-delivery",type:"scheduler",command:"node dist/src/process-supervisor.js shopify-token-alert-delivery scheduler npm run start:shopify-token-alerts:deliver",schedule:"*/5 * * * *"});expect(manifest.processes).toContainEqual({name:"admin-auth-retention",type:"scheduler",command:"node dist/src/process-supervisor.js admin-auth-retention scheduler npm run start:admin-auth:cleanup",schedule:"*/5 * * * *"});
    expect(result.shopifyToml).toContain('client_id = "client_12345678"');
    expect(result.shopifyToml).toContain('redirect_urls = ["https://app.storzy.example/api/integrations/shopify/oauth/callback"]');
    expect(result.env).not.toMatch(/ADMIN_API_TOKEN=[A-Za-z0-9]{32,}/);
  });
  it("localhost, 경로가 있는 URL, 잘못된 client ID를 거부한다",()=>{
    for(const publicUrl of ["http://app.example","https://localhost:3000","https://app.example/path"]){expect(()=>buildProductionTemplates({publicUrl,shopifyClientId:"client_12345678"})).toThrow("public HTTPS origin")}
    expect(()=>buildProductionTemplates({publicUrl:"https://app.example",shopifyClientId:"short"})).toThrow("client ID");
  });
  it("생성한 TOML은 실제 비밀값 주입 후 사전점검을 통과한다",()=>{
    const result=buildProductionTemplates({publicUrl:"https://app.example",shopifyClientId:"client_12345678"}),env={PUBLIC_APP_URL:"https://app.example",DATABASE_URL:"postgresql://user:pass@db.example/storzy",ADMIN_API_TOKEN:"a".repeat(32),OPENAI_API_KEY:"openai-secret",SHOPIFY_API_KEY:"client_12345678",SHOPIFY_API_SECRET:"secret",SHOPIFY_WEBHOOK_SECRET:"webhook-secret",SHOPIFY_TOKEN_ALERT_WEBHOOK_URL:"https://alerts.example/shopify",SHOPIFY_TOKEN_ALERT_WEBHOOK_SECRET:"alert-secret-1234",SHOPIFY_TOKEN_ALERT_SCHEDULE:"*/5 * * * *",SHOPIFY_TOKEN_ALERT_COMMAND:"node dist/src/process-supervisor.js shopify-token-alert-delivery scheduler npm run start:shopify-token-alerts:deliver",SHOPIFY_TOKEN_ALERT_MAX_ATTEMPTS:"6",SHOPIFY_TOKEN_ALERT_LEASE_SECONDS:"30",SHOPIFY_TOKEN_ALERT_BATCH_SIZE:"20",PRINTFUL_WEBHOOK_SECRET_HEX:"ab".repeat(32),INTEGRATION_CREDENTIAL_KEY_BASE64:Buffer.alloc(32,2).toString("base64"),SHOPIFY_OAUTH_CALLBACK_URL:"https://app.example/api/integrations/shopify/oauth/callback",SHOPIFY_SCOPES:"write_products,write_content,read_orders",SHOPIFY_API_VERSION:"2026-07"};
    expect(checkShopifyDeployment(env,result.shopifyToml,result.processManifest).ready).toBe(true);
  });
});
