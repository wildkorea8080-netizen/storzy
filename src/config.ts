import {isValidPrintfulWebhookSecret} from "./integrations/printful.js";
import {shopifyOAuthReadinessFromEnv} from "./integrations/shopify-oauth-readiness.js";

export type AppConfig = Readonly<{
  nodeEnv: "development" | "test" | "production";
  logLevel: "debug" | "info" | "warn" | "error";
  port: number;
  databaseUrl: string;
  openAiModel: string;
  openAiApiKey: string | null;
  adminApiToken: string | null;
  shopifyApiVersion: string;
  printfulApiBaseUrl: string;
  generationLeaseSeconds: number;
  generationMaxAttempts: number;
  workerPollMs: number;
  outboxLeaseSeconds: number;
  outboxMaxAttempts: number;
  outboxPollMs: number;
  candidateLeaseSeconds: number;
  candidateMaxAttempts: number;
  candidatePollMs: number;
  shutdownDrainMs:number;
  shutdownTimeoutMs:number;
}>;

function requiredString(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = requiredString(env.NODE_ENV, "development");
  if (!(["development", "test", "production"] as const).includes(nodeEnv as AppConfig["nodeEnv"])) {
    throw new Error(`Invalid NODE_ENV: ${nodeEnv}`);
  }
  const logLevel = requiredString(env.LOG_LEVEL, "info");
  if (!(["debug", "info", "warn", "error"] as const).includes(logLevel as AppConfig["logLevel"])) {
    throw new Error(`Invalid LOG_LEVEL: ${logLevel}`);
  }

  const adminApiToken = env.ADMIN_API_TOKEN?.trim() || null;
  if (nodeEnv === "production" && (!adminApiToken || adminApiToken.length < 32)) {
    throw new Error("ADMIN_API_TOKEN must be at least 32 characters in production");
  }
  const printfulWebhookSecret=env.PRINTFUL_WEBHOOK_SECRET_HEX?.trim()||null;
  if(nodeEnv==="production"&&printfulWebhookSecret&&!isValidPrintfulWebhookSecret(printfulWebhookSecret)){
    throw new Error("PRINTFUL_WEBHOOK_SECRET_HEX must be at least 32 bytes encoded as hexadecimal");
  }
  if(nodeEnv==="production"&&env.PRINTFUL_WEBHOOK_PUBLIC_KEY?.trim()&&!printfulWebhookSecret){
    throw new Error("PRINTFUL_WEBHOOK_SECRET_HEX is required when PRINTFUL_WEBHOOK_PUBLIC_KEY is configured");
  }
  if(nodeEnv==="production"){
    const rawPublicUrl=env.PUBLIC_APP_URL?.trim();
    let validPublicUrl=false;
    try{if(rawPublicUrl){const parsed=new URL(rawPublicUrl);validPublicUrl=parsed.protocol==="https:"&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash&&!['localhost','127.0.0.1','::1'].includes(parsed.hostname);}}catch{/* handled below */}
    if(!validPublicUrl)throw new Error("PUBLIC_APP_URL must be a public HTTPS origin in production");
    const hasShopifyOAuthConfiguration=[env.SHOPIFY_API_KEY,env.SHOPIFY_API_SECRET,env.SHOPIFY_OAUTH_CALLBACK_URL,env.SHOPIFY_SCOPES].some(value=>Boolean(value?.trim()));
    if(hasShopifyOAuthConfiguration){
      const readiness=shopifyOAuthReadinessFromEnv(env);
      if(!readiness.ready)throw new Error(`Shopify OAuth configuration is incomplete: ${readiness.missing.join(", ")}`);
    }
    const tokenAlertUrl=env.SHOPIFY_TOKEN_ALERT_WEBHOOK_URL?.trim(),tokenAlertSecret=env.SHOPIFY_TOKEN_ALERT_WEBHOOK_SECRET?.trim();
    if(Boolean(tokenAlertUrl)!==Boolean(tokenAlertSecret))throw new Error("SHOPIFY_TOKEN_ALERT_WEBHOOK_URL and SHOPIFY_TOKEN_ALERT_WEBHOOK_SECRET must be configured together");
    if(tokenAlertUrl){let valid=false;try{valid=new URL(tokenAlertUrl).protocol==="https:";}catch{/* handled below */}if(!valid)throw new Error("SHOPIFY_TOKEN_ALERT_WEBHOOK_URL must use HTTPS");if(tokenAlertSecret!.length<16)throw new Error("SHOPIFY_TOKEN_ALERT_WEBHOOK_SECRET must be at least 16 characters");}
  }

  const port = Number(requiredString(env.PORT, "3000"));
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid PORT: ${env.PORT ?? ""}`);
  }

  const generationLeaseSeconds = Number(requiredString(env.GENERATION_LEASE_SECONDS, "120"));
  const generationMaxAttempts = Number(requiredString(env.GENERATION_MAX_ATTEMPTS, "4"));
  const workerPollMs = Number(requiredString(env.WORKER_POLL_MS, "1000"));
  const outboxLeaseSeconds = Number(requiredString(env.OUTBOX_LEASE_SECONDS, "60"));
  const outboxMaxAttempts = Number(requiredString(env.OUTBOX_MAX_ATTEMPTS, "8"));
  const outboxPollMs = Number(requiredString(env.OUTBOX_POLL_MS, "1000"));
  const candidateLeaseSeconds = Number(requiredString(env.CANDIDATE_LEASE_SECONDS, "120"));
  const candidateMaxAttempts = Number(requiredString(env.CANDIDATE_MAX_ATTEMPTS, "4"));
  const candidatePollMs = Number(requiredString(env.CANDIDATE_POLL_MS, "1000"));
  const shutdownDrainMs=Number(requiredString(env.SHUTDOWN_DRAIN_MS,"5000"));
  const shutdownTimeoutMs=Number(requiredString(env.SHUTDOWN_TIMEOUT_MS,"30000"));
  if (!Number.isInteger(generationLeaseSeconds) || generationLeaseSeconds < 10) throw new Error("GENERATION_LEASE_SECONDS must be at least 10");
  if (!Number.isInteger(generationMaxAttempts) || generationMaxAttempts < 1 || generationMaxAttempts > 20) throw new Error("GENERATION_MAX_ATTEMPTS must be between 1 and 20");
  if (!Number.isInteger(workerPollMs) || workerPollMs < 100 || workerPollMs > 60_000) throw new Error("WORKER_POLL_MS must be between 100 and 60000");
  if (!Number.isInteger(outboxLeaseSeconds) || outboxLeaseSeconds < 10) throw new Error("OUTBOX_LEASE_SECONDS must be at least 10");
  if (!Number.isInteger(outboxMaxAttempts) || outboxMaxAttempts < 1 || outboxMaxAttempts > 100) throw new Error("OUTBOX_MAX_ATTEMPTS must be between 1 and 100");
  if (!Number.isInteger(outboxPollMs) || outboxPollMs < 100 || outboxPollMs > 60_000) throw new Error("OUTBOX_POLL_MS must be between 100 and 60000");
  if (!Number.isInteger(candidateLeaseSeconds) || candidateLeaseSeconds < 10) throw new Error("CANDIDATE_LEASE_SECONDS must be at least 10");
  if (!Number.isInteger(candidateMaxAttempts) || candidateMaxAttempts < 1 || candidateMaxAttempts > 20) throw new Error("CANDIDATE_MAX_ATTEMPTS must be between 1 and 20");
  if (!Number.isInteger(candidatePollMs) || candidatePollMs < 100 || candidatePollMs > 60_000) throw new Error("CANDIDATE_POLL_MS must be between 100 and 60000");
  if(!Number.isInteger(shutdownDrainMs)||shutdownDrainMs<0||shutdownDrainMs>60_000)throw new Error("SHUTDOWN_DRAIN_MS must be between 0 and 60000");
  if(!Number.isInteger(shutdownTimeoutMs)||shutdownTimeoutMs<1_000||shutdownTimeoutMs>120_000||shutdownTimeoutMs<=shutdownDrainMs)throw new Error("SHUTDOWN_TIMEOUT_MS must be between 1000 and 120000 and greater than SHUTDOWN_DRAIN_MS");

  return {
    nodeEnv: nodeEnv as AppConfig["nodeEnv"],
    logLevel: logLevel as AppConfig["logLevel"],
    port,
    databaseUrl: requiredString(env.DATABASE_URL, "postgresql://storzy:storzy@localhost:5432/storzy"),
    openAiModel: requiredString(env.OPENAI_MODEL, "gpt-5.6-sol"),
    openAiApiKey: env.OPENAI_API_KEY?.trim() || null,
    adminApiToken,
    shopifyApiVersion: requiredString(env.SHOPIFY_API_VERSION, "2026-07"),
    printfulApiBaseUrl: requiredString(env.PRINTFUL_API_BASE_URL, "https://api.printful.com"),
    generationLeaseSeconds,
    generationMaxAttempts,
    workerPollMs,
    outboxLeaseSeconds,
    outboxMaxAttempts,
    outboxPollMs,
    candidateLeaseSeconds,
    candidateMaxAttempts,
    candidatePollMs,
    shutdownDrainMs,
    shutdownTimeoutMs,
  };
}
