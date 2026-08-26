import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { AdminSessionService } from "../auth/admin-session-service.js";
import {AdminLoginRateLimiter}from"../auth/admin-login-rate-limiter.js";
import {adminLoginCss,adminLoginHtml,adminLoginJs}from"../admin/login-page.js";
import{securityCss,securityHtml,securityJs}from"../admin/security-page.js";
import{adminSecurityAlertCss,adminSecurityAlertJs}from"../admin/admin-security-alert-ui.js";
import{SignedAdminSecurityAlertWebhook}from"../auth/admin-security-alert-delivery.js";
import { DomainError } from "../brand/errors.js";
import type { BrandProfileService } from "../brand/service.js";
import { NoopLogger, type Logger } from "../observability/logger.js";
import type { NotificationService } from "../notifications/types.js";
import type { CandidateReviewService } from "../candidates/review-types.js";
import type { ProductContentReviewService } from "../content/review-service.js";
import type { DesignAssetService } from "../mockups/design-service.js";
import type { ShopifyWebhookHeaders } from "../orders/shopify-webhook-service.js";
import type {OrderAutomationControlService} from "../orders/automation-control.js";
import type {RemoteDraftCleanupService} from "../orders/remote-draft-cleanup.js";
import type { OrderExceptionService } from "../orders/exception-service.js";
import type {ReturnCaseService} from "../orders/return-case-service.js";
import {fetchRecentShopifyOrders,fetchShopifyOrderForReplay,type OrderReconciliationService} from "../orders/shopify-reconciliation.js";
import {reconciliationScanCsv} from "../orders/reconciliation-csv.js";
import { ordersCss, ordersHtml, ordersJs } from "../admin/orders-page.js";
import {orderReturnsCss,orderReturnsJs} from "../admin/order-returns-ui.js";
import {orderReconciliationCss,orderReconciliationJs} from "../admin/order-reconciliation-ui.js";
import {orderReconciliationScansJs} from "../admin/order-reconciliation-scans-ui.js";
import {orderReconciliationLabelsJs} from "../admin/order-reconciliation-labels-ui.js";
import { overviewCss, overviewHtml, overviewJs } from "../admin/overview-page.js";
import {overviewReconciliationJs} from "../admin/overview-reconciliation-ui.js";
import {overviewAutomationCss,overviewAutomationJs} from "../admin/overview-automation-ui.js";
import {overviewShopifyThrottleCss,overviewShopifyThrottleJs} from "../admin/overview-shopify-throttle-ui.js";
import {processHealthCss,processHealthJs} from "../admin/process-health-ui.js";
import {overviewPrivacyMaintenanceAlertCss,overviewPrivacyMaintenanceAlertJs} from "../admin/overview-privacy-maintenance-alert-ui.js";
import type { AdminOverviewService } from "../admin/overview-service.js";
import { catalogCss, catalogHtml, catalogJs } from "../admin/catalog-page.js";
import { onboardingCss, onboardingHtml, onboardingJs } from "../admin/onboarding-page.js";
import { onboardingAuthCss, onboardingAuthJs } from "../admin/onboarding-auth-ui.js";
import { onboardingIdempotencyJs } from "../admin/onboarding-idempotency-ui.js";
import type { StoreConfigService } from "../storefront/config-service.js";
import type { PreviewOrderService } from "../orders/preview-order-service.js";
import type { PreviewFulfillmentService } from "../fulfillment/preview-service.js";
import { storeCss, storeHtml, storeJs } from "../admin/store-page.js";
import { designsCss, designsHtml, designsJs } from "../admin/designs-page.js";
import { adminAuthSessionJs, adminKoreanJs, adminShellJs, adminSystemCss, decorateAdminHtml } from "../admin/design-system.js";
import type { PreviewDesignUploadService } from "../mockups/preview-upload-service.js";
import { storefrontPreviewCss, storefrontPreviewHtml, storefrontPreviewJs } from "../admin/storefront-preview-page.js";
import { storefrontCartCss, storefrontCartJs } from "../admin/storefront-cart.js";
import { storefrontCheckoutCss, storefrontCheckoutJs } from "../admin/storefront-checkout.js";
import { storefrontCatalogCss, storefrontCatalogJs } from "../admin/storefront-catalog.js";
import { storefrontSeoJs } from "../admin/storefront-seo.js";
import { storefrontA11yCss, storefrontA11yJs } from "../admin/storefront-a11y.js";
import { storefrontImagesJs } from "../admin/storefront-images.js";
import { storefrontDataCacheJs } from "../admin/storefront-data-cache.js";
import { storefrontResilienceCss, storefrontResilienceJs } from "../admin/storefront-resilience.js";
import { integrationsCss, integrationsHtml, integrationsJs } from "../admin/integrations-page.js";
import{shopifyTokenAlertCss,shopifyTokenAlertJs}from"../admin/shopify-token-alert-ui.js";
import type{ShopifyTokenAlertDeliveryService}from"../integrations/shopify-token-alert-delivery.js";
import type{ProcessHeartbeatStore}from"../operations/process-heartbeat.js";
import { integrationStatusFromEnv, mergeStoredIntegrationStatus } from "../integrations/status.js";
import { testIntegrationConnection, type IntegrationProvider } from "../integrations/connection-test.js";
import { integrationsTestCss, integrationsTestJs } from "../admin/integrations-test-ui.js";
import type { ShopifyOAuthService } from "../integrations/shopify-oauth.js";
import type { IntegrationConnectionRepository } from "../integrations/connection-repository.js";
import type {ShopifyWorkspaceAccess} from "../integrations/shopify-access-token-provider.js";
import { shopifyConnectCss, shopifyConnectJs } from "../admin/shopify-connect-ui.js";
import { registerPrintfulConnection } from "../integrations/printful-registration.js";
import { printfulConnectCss, printfulConnectJs } from "../admin/printful-connect-ui.js";
import { integrationDisconnectCss, integrationDisconnectJs } from "../admin/integration-disconnect-ui.js";
import { webhookReadinessCss, webhookReadinessJs } from "../admin/webhook-readiness-ui.js";
import { pilotReadinessCss, pilotReadinessJs } from "../admin/pilot-readiness-ui.js";
import {orderAutomationCss,orderAutomationJs} from "../admin/order-automation-ui.js";
import {orderAutomationHistoryJs} from "../admin/order-automation-history-ui.js";
import {orderAutomationActivityCss,orderAutomationActivityJs} from "../admin/order-automation-activity-ui.js";
import {printfulDraftCleanupCss,printfulDraftCleanupJs} from "../admin/printful-draft-cleanup-ui.js";
import {orderAutomationOrderGuardCss,orderAutomationOrderGuardJs} from "../admin/order-automation-order-guard-ui.js";
import {orderAuditHistoryCss,orderAuditHistoryJs} from "../admin/order-audit-history-ui.js";
import { webhookReadinessFromEnv } from "../integrations/webhook-readiness.js";
import { buildPilotReadiness,orderAutomationApproval } from "../integrations/pilot-readiness.js";
import { shopifyOAuthReadinessFromEnv } from "../integrations/shopify-oauth-readiness.js";
import { syncShopifyOrderWebhooks } from "../integrations/shopify-webhook-sync.js";
import { syncPrintfulWebhooks } from "../integrations/printful-webhook-sync.js";
import type { WebhookHealthService } from "../integrations/webhook-health-service.js";
import { webhookHealthCss,webhookHealthJs } from "../admin/webhook-health-ui.js";
import type {ShopifyPrivacyWebhookService,PrivacyTopic} from "../privacy/shopify-privacy-webhook.js";
import type {ShopifyAppUninstalledWebhookService} from "../integrations/shopify-app-uninstalled.js";
import type {PrivacyRequestService} from "../privacy/request-service.js";
import {privacyCss,privacyHtml,privacyJs} from "../admin/privacy-page.js";
import {privacyRedactionCss,privacyRedactionJs} from "../admin/privacy-redaction-ui.js";
import {privacyExportCss,privacyExportJs} from "../admin/privacy-export-ui.js";
import {shopRedactionImpactCss,shopRedactionImpactJs} from "../admin/shop-redaction-impact-ui.js";
import {privacySlaCss,privacySlaJs} from "../admin/privacy-sla-ui.js";
import type {PrivacySlaAlertService} from "../privacy/sla-alert-service.js";
import {privacyAlertsCss,privacyAlertsJs} from "../admin/privacy-alerts-ui.js";
import {privacyWebhookCss,privacyWebhookJs} from "../admin/privacy-webhook-ui.js";
import {privacyMaintenanceCss,privacyMaintenanceJs} from "../admin/privacy-maintenance-ui.js";
import {privacyMaintenanceHistoryCss,privacyMaintenanceHistoryJs} from "../admin/privacy-maintenance-history-ui.js";
import {overviewUninstallAlertCss,overviewUninstallAlertJs} from "../admin/overview-uninstall-alert-ui.js";

const MAX_BODY_BYTES = 128 * 1024;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new DomainError("PAYLOAD_TOO_LARGE", "Request body exceeds 128 KiB");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body is not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new DomainError("INVALID_JSON", "Request body must be a JSON object");
  }
}

async function readBinary(request: IncomingMessage, maxBytes = 50 * 1024 * 1024): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new DomainError("PAYLOAD_TOO_LARGE", "Design upload exceeds 50 MB");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function requestIdFromHeader(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : randomUUID();
}

const ADMIN_SESSION_AUTH=Symbol("admin-session-auth");
type SessionRequest=IncomingMessage&{[ADMIN_SESSION_AUTH]?:string};
function requireAdmin(request:IncomingMessage,configured:string|undefined):void{if((request as SessionRequest)[ADMIN_SESSION_AUTH])return;if(!configured)return;const raw=request.headers.authorization,authorization=Array.isArray(raw)?raw[0]:raw,provided=authorization?.startsWith('Bearer ')?authorization.slice(7):'';const a=Buffer.from(provided),b=Buffer.from(configured);if(a.length!==b.length||!timingSafeEqual(a,b))throw Object.assign(new Error('관리자 인증이 필요합니다.'),{status:401,authKind:'ADMIN'});}
function requireSessionSameOrigin(request:IncomingMessage,method:string,pathname:string):void{if(!(request as SessionRequest)[ADMIN_SESSION_AUTH]||!pathname.startsWith('/api/')||!['POST','PUT','PATCH','DELETE'].includes(method))return;const fetchSite=Array.isArray(request.headers['sec-fetch-site'])?request.headers['sec-fetch-site'][0]:request.headers['sec-fetch-site'];if(fetchSite==='cross-site')throw Object.assign(new Error('교차 사이트 관리자 요청을 허용하지 않습니다.'),{status:403,authKind:'ADMIN_CSRF'});const rawOrigin=Array.isArray(request.headers.origin)?request.headers.origin[0]:request.headers.origin;if(!rawOrigin)return;let origin:URL;try{origin=new URL(rawOrigin)}catch{throw Object.assign(new Error('요청 출처를 확인할 수 없습니다.'),{status:403,authKind:'ADMIN_CSRF'});}const configured=process.env.PUBLIC_APP_URL?.trim();if(configured){try{if(origin.origin===new URL(configured).origin)return}catch{}}else{const host=Array.isArray(request.headers.host)?request.headers.host[0]:request.headers.host;if(host&&origin.host===host&&(origin.protocol==='http:'||origin.protocol==='https:'))return}throw Object.assign(new Error('관리자 요청 출처가 일치하지 않습니다.'),{status:403,authKind:'ADMIN_CSRF'});}

export function createApp(
  service: BrandProfileService,
  logger: Logger = new NoopLogger(),
  notifications?: NotificationService,
  candidates?: CandidateReviewService,
  contentReviews?: ProductContentReviewService,
  designs?: DesignAssetService,
  printfulWebhook?: {receive(raw:Buffer,headers:Readonly<{signature?:string;publicKey?:string}>):Promise<unknown>},
  shopifyOrders?: {receive(raw:Buffer,headers:ShopifyWebhookHeaders):Promise<unknown>},
  orderExceptions?: OrderExceptionService,
  adminToken?: string,
  adminOverview?: AdminOverviewService,
  storeConfig?: StoreConfigService,
  previewOrders?: PreviewOrderService,
  previewFulfillment?: PreviewFulfillmentService,
  previewDesignUploads?: PreviewDesignUploadService,
  previewStorefront?: StoreConfigService,
  shopifyOAuth?: ShopifyOAuthService,
  integrationConnections?: IntegrationConnectionRepository,
  webhookHealth?: WebhookHealthService,
  privacyWebhooks?: ShopifyPrivacyWebhookService,
  privacyRequests?: PrivacyRequestService,
  privacyAlerts?: PrivacySlaAlertService,
  returnCases?: ReturnCaseService,
  orderReconciliation?: OrderReconciliationService,
  readiness?: {check():Promise<void>},
  shopifyAccess?: {resolve(workspaceId:string):Promise<ShopifyWorkspaceAccess|null>},
  shopifyTokenAlerts?: ShopifyTokenAlertDeliveryService,
  processHeartbeats?: ProcessHeartbeatStore,
  orderAutomation?:OrderAutomationControlService,
  remoteDraftCleanup?:RemoteDraftCleanupService,
  shopifyAppUninstalled?:ShopifyAppUninstalledWebhookService,
  adminSessions?:AdminSessionService,
) {
  const adminLoginLimiter=new AdminLoginRateLimiter({maxAttempts:Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS??"5"),windowMs:Number(process.env.ADMIN_LOGIN_WINDOW_SECONDS??"900")*1000});
  return async function app(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const requestId = requestIdFromHeader(request.headers["x-request-id"]);
    const startedAt = performance.now();
    const requestLogger = logger.child({ requestId, method: request.method, url: request.url });
    response.setHeader("X-Request-ID", requestId);
    response.once("finish", () => {
      requestLogger.info("http.request.completed", {
        statusCode: response.statusCode,
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
    });
    try {
      const method = request.method ?? "GET";
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if(adminSessions&&request.headers.cookie){const authenticated=await adminSessions.authenticate(request.headers.cookie);if(authenticated)(request as SessionRequest)[ADMIN_SESSION_AUTH]=authenticated.id;}
      requireSessionSameOrigin(request,method,pathname);
      if(pathname.startsWith("/api/")&&!pathname.startsWith("/api/preview/")){
        response.setHeader("Cache-Control","no-store, private");
        response.setHeader("Pragma","no-cache");
      }
      if(method==="POST"&&pathname==="/api/auth/admin/session"&&adminSessions){if(!adminToken)throw new DomainError("SERVICE_UNAVAILABLE","관리자 로그인이 설정되지 않았습니다.");const loginKey=request.socket.remoteAddress??"unknown",clientDigest=adminSessions.clientDigest(loginKey),limit=adminLoginLimiter.check(loginKey);if(!limit.allowed){await adminSessions.record("LOGIN_RATE_LIMITED","REJECTED",clientDigest,{detail:{retryAfterSeconds:limit.retryAfterSeconds}});response.setHeader("Retry-After",String(limit.retryAfterSeconds));sendJson(response,429,{error:{code:"ADMIN_LOGIN_RATE_LIMITED",message:"로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."}});return;}const body=await readJson(request),provided=typeof body.token==="string"?body.token:"",a=Buffer.from(provided),b=Buffer.from(adminToken);if(a.length!==b.length||!timingSafeEqual(a,b)){adminLoginLimiter.fail(loginKey);await adminSessions.record("LOGIN_FAILED","REJECTED",clientDigest);throw Object.assign(new Error("관리자 토큰이 올바르지 않습니다."),{status:401,authKind:"ADMIN"});}adminLoginLimiter.success(loginKey);const created=await adminSessions.create();await adminSessions.record("LOGIN_SUCCEEDED","SUCCEEDED",clientDigest,{sessionId:created.session.id});response.setHeader("Set-Cookie",created.setCookie);sendJson(response,201,{data:{authenticated:true,expiresAt:created.session.expiresAt}});return;}
      if(method==="GET"&&pathname==="/api/auth/admin/session"&&adminSessions){sendJson(response,200,{data:{authenticated:Boolean((request as SessionRequest)[ADMIN_SESSION_AUTH])}});return;}
      if(method==="DELETE"&&pathname==="/api/auth/admin/session"&&adminSessions){const sessionId=await adminSessions.revoke(request.headers.cookie);if(sessionId)await adminSessions.record("LOGOUT","SUCCEEDED",adminSessions.clientDigest(request.socket.remoteAddress),{sessionId});response.setHeader("Set-Cookie",adminSessions.clearCookie());sendJson(response,200,{data:{authenticated:false}});return;}
      if(method==="GET"&&pathname==="/api/admin/auth/sessions"&&adminSessions){requireAdmin(request,adminToken);const current=(request as SessionRequest)[ADMIN_SESSION_AUTH];sendJson(response,200,{data:(await adminSessions.active()).map(item=>({...item,current:item.id===current}))});return;}
      if(method==="GET"&&pathname==="/api/admin/auth/events"&&adminSessions){requireAdmin(request,adminToken);const limit=Number(new URL(request.url??"/","http://localhost").searchParams.get("limit")??50);if(!Number.isInteger(limit)||limit<1||limit>100)throw new DomainError("INVALID_INPUT","limit은 1~100 사이의 정수여야 합니다.");sendJson(response,200,{data:await adminSessions.events(limit)});return;}
      if(method==="GET"&&pathname==="/api/admin/auth/alerts"&&adminSessions){requireAdmin(request,adminToken);sendJson(response,200,{data:await adminSessions.alerts(50)});return;}
      const adminAlertActionMatch=pathname.match(/^\/api\/admin\/auth\/alerts\/([^/]+)\/(acknowledge|resolve|requeue)$/);
      if(method==="POST"&&adminAlertActionMatch?.[1]&&adminAlertActionMatch[2]&&adminSessions){requireAdmin(request,adminToken);const body=await readJson(request),id=decodeURIComponent(adminAlertActionMatch[1]),action=adminAlertActionMatch[2];const item=action==="requeue"?await adminSessions.requeueAlert({id,actorId:String(body.actorId??""),reason:String(body.reason??"")}):await adminSessions.actAlert({id,action:action==="acknowledge"?"ACKNOWLEDGE":"RESOLVE",actorId:String(body.actorId??""),reason:String(body.reason??"")});if(!item)throw new DomainError("NOT_FOUND","보안 경보를 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}
      const adminAlertActionsMatch=pathname.match(/^\/api\/admin\/auth\/alerts\/([^/]+)\/actions$/);
      if(method==="GET"&&adminAlertActionsMatch?.[1]&&adminSessions){requireAdmin(request,adminToken);sendJson(response,200,{data:await adminSessions.alertActions(decodeURIComponent(adminAlertActionsMatch[1]))});return;}
      if(method==="POST"&&pathname==="/api/admin/auth/alerts/webhook-test"){requireAdmin(request,adminToken);const url=process.env.ADMIN_SECURITY_ALERT_WEBHOOK_URL?.trim(),secret=process.env.ADMIN_SECURITY_ALERT_WEBHOOK_SECRET?.trim();if(!url||!secret)throw new DomainError("SERVICE_UNAVAILABLE","보안 경보 Webhook이 설정되지 않았습니다.");sendJson(response,200,{data:await new SignedAdminSecurityAlertWebhook(url,secret).verify()});return;}
      if(method==="POST"&&pathname==="/api/admin/auth/sessions/revoke-all"&&adminSessions){requireAdmin(request,adminToken);const count=await adminSessions.revokeAll();await adminSessions.record("REVOKE_ALL","SUCCEEDED",adminSessions.clientDigest(request.socket.remoteAddress),{detail:{revokedSessions:count}});response.setHeader("Set-Cookie",adminSessions.clearCookie());sendJson(response,200,{data:{revokedSessions:count}});return;}
      const adminSessionRevokeMatch=pathname.match(/^\/api\/admin\/auth\/sessions\/([^/]+)$/);
      if(method==="DELETE"&&adminSessionRevokeMatch?.[1]&&adminSessions){requireAdmin(request,adminToken);const sessionId=decodeURIComponent(adminSessionRevokeMatch[1]),revoked=await adminSessions.revokeById(sessionId);if(!revoked)throw new DomainError("NOT_FOUND","활성 관리자 세션을 찾을 수 없습니다.");await adminSessions.record("REVOKE_SESSION","SUCCEEDED",adminSessions.clientDigest(request.socket.remoteAddress),{sessionId});const current=(request as SessionRequest)[ADMIN_SESSION_AUTH]===sessionId;if(current)response.setHeader("Set-Cookie",adminSessions.clearCookie());sendJson(response,200,{data:{revoked:true,current}});return;}
      if(method==="POST"&&pathname==="/api/admin/auth/retention-cleanup"&&adminSessions){requireAdmin(request,adminToken);const result=await adminSessions.cleanup({eventRetentionDays:Number(process.env.ADMIN_AUTH_EVENT_RETENTION_DAYS??"90"),sessionRetentionDays:Number(process.env.ADMIN_SESSION_RECORD_RETENTION_DAYS??"30")});await adminSessions.record("RETENTION_CLEANUP","SUCCEEDED",adminSessions.clientDigest(request.socket.remoteAddress),{detail:result});sendJson(response,200,{data:result});return;}
      if(method==="GET"&&pathname==="/api/admin/process-health"&&processHeartbeats){requireAdmin(request,adminToken);sendJson(response,200,{data:await processHeartbeats.health()});return;}
      if(method==="GET"&&pathname==="/api/admin/privacy-maintenance/summary"&&privacyRequests){requireAdmin(request,adminToken);sendJson(response,200,{data:await privacyRequests.maintenanceSummary()});return;}
      const privacyMaintenanceRetryMatch=pathname.match(/^\/api\/admin\/privacy-maintenance\/incidents\/([^/]+)\/retry-delivery$/);
      if(method==="POST"&&privacyMaintenanceRetryMatch?.[1]&&privacyRequests){requireAdmin(request,adminToken);const body=await readJson(request),item=await privacyRequests.requeueMaintenanceDelivery({incidentId:decodeURIComponent(privacyMaintenanceRetryMatch[1]),actorId:String(body.actorId??""),reason:String(body.reason??"")});if(!item)throw new DomainError("NOT_FOUND","재전송할 열린 유지관리 사건을 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}
      const privacyMaintenanceActionsMatch=pathname.match(/^\/api\/admin\/privacy-maintenance\/incidents\/([^/]+)\/actions$/);
      if(method==="GET"&&privacyMaintenanceActionsMatch?.[1]&&privacyRequests){requireAdmin(request,adminToken);const limit=Number(new URL(request.url??"/","http://localhost").searchParams.get("limit")??20);if(!Number.isInteger(limit)||limit<1||limit>100)throw new DomainError("INVALID_INPUT","limit은 1~100 사이의 정수여야 합니다.");sendJson(response,200,{data:await privacyRequests.maintenanceDeliveryActions(decodeURIComponent(privacyMaintenanceActionsMatch[1]),limit)});return;}
      const automationMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-automation$/);
      if(automationMatch?.[1]&&orderAutomation&&(method==="GET"||method==="POST")){
        requireAdmin(request,adminToken);
        const workspaceId=decodeURIComponent(automationMatch[1]),workspace=await service.getWorkspace(workspaceId);
        if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","활성 워크스페이스만 주문 자동화를 설정할 수 있습니다.");
        if(method==="GET"){
          const [control,history,activity]=await Promise.all([orderAutomation.get(workspaceId),orderAutomation.history(workspaceId),orderAutomation.activity(workspaceId)]);
          if(!adminOverview){sendJson(response,200,{data:{...control,history,activity,approval:{canEnable:false,blockers:[]}}});return;}
          const stored=integrationConnections?await integrationConnections.list(workspaceId):[],integrations=mergeStoredIntegrationStatus(integrationStatusFromEnv(process.env),stored),hasStoredShopify=stored.some(item=>item.provider==="SHOPIFY"&&item.status==="CONNECTED"),hasStoredPrintful=stored.some(item=>item.provider==="PRINTFUL"&&item.status==="CONNECTED"),webhooks=webhookReadinessFromEnv(process.env,workspaceId,hasStoredShopify,hasStoredPrintful),overview=await adminOverview.get(workspaceId);
          if(!overview)throw new DomainError("NOT_FOUND","워크스페이스 운영 현황을 찾을 수 없습니다.");
          const approval=orderAutomationApproval(buildPilotReadiness({integrations,webhooks,counts:overview.counts,automationEnabled:control.enabled}));
          sendJson(response,200,{data:{...control,history,activity,approval}});return;
        }
        const body=await readJson(request);
        if(typeof body.enabled!=="boolean")throw new DomainError("INVALID_INPUT","enabled 값은 boolean이어야 합니다.");
        if(body.enabled){
          if(!adminOverview)throw new DomainError("SERVICE_UNAVAILABLE","파일럿 준비 상태를 확인할 수 없습니다.");
          const stored=integrationConnections?await integrationConnections.list(workspaceId):[],integrations=mergeStoredIntegrationStatus(integrationStatusFromEnv(process.env),stored),hasStoredShopify=stored.some(item=>item.provider==="SHOPIFY"&&item.status==="CONNECTED"),hasStoredPrintful=stored.some(item=>item.provider==="PRINTFUL"&&item.status==="CONNECTED"),webhooks=webhookReadinessFromEnv(process.env,workspaceId,hasStoredShopify,hasStoredPrintful),overview=await adminOverview.get(workspaceId);
          if(!overview)throw new DomainError("NOT_FOUND","워크스페이스 운영 현황을 찾을 수 없습니다.");
          const prerequisites=buildPilotReadiness({integrations,webhooks,counts:overview.counts,automationEnabled:true});
          const approval=orderAutomationApproval(prerequisites);
          if(!approval.canEnable)throw Object.assign(new Error(`출시 승인 전 필수 조건을 완료해 주세요: ${approval.blockers.map(step=>step.label).join(", ")}`),{status:409});
        }
        sendJson(response,200,{data:await orderAutomation.set({workspaceId,enabled:body.enabled,actorId:String(body.actorId??""),reason:String(body.reason??"")})});return;
      }
      const draftCleanupMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/orders\/([^/]+)\/printful-draft\/cleanup$/);
      if(method==="POST"&&draftCleanupMatch?.[1]&&draftCleanupMatch[2]&&remoteDraftCleanup){requireAdmin(request,adminToken);const keyValue=request.headers["idempotency-key"],idempotencyKey=Array.isArray(keyValue)?keyValue[0]:keyValue;if(!idempotencyKey||!/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey))throw new DomainError("INVALID_INPUT","유효한 Idempotency-Key가 필요합니다.");const body=await readJson(request);sendJson(response,200,{data:await remoteDraftCleanup.cleanup({workspaceId:decodeURIComponent(draftCleanupMatch[1]),orderId:decodeURIComponent(draftCleanupMatch[2]),actorId:String(body.actorId??""),reason:String(body.reason??""),idempotencyKey})});return;}
      const draftCleanupActionsMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/orders\/([^/]+)\/printful-draft\/cleanup-actions$/);
      if(method==="GET"&&draftCleanupActionsMatch?.[1]&&draftCleanupActionsMatch[2]&&remoteDraftCleanup){requireAdmin(request,adminToken);const limit=Number(new URL(request.url??"/","http://localhost").searchParams.get("limit")??20);if(!Number.isInteger(limit)||limit<1||limit>100)throw new DomainError("INVALID_INPUT","limit은 1~100 사이의 정수여야 합니다.");sendJson(response,200,{data:await remoteDraftCleanup.list(decodeURIComponent(draftCleanupActionsMatch[1]),decodeURIComponent(draftCleanupActionsMatch[2]),limit)});return;}
      if((pathname==="/admin"||pathname==="/admin/"||pathname.startsWith("/admin/"))&&!pathname.startsWith("/admin/assets/")){
        response.setHeader("Cache-Control","no-store, private");
        response.setHeader("Pragma","no-cache");
        response.setHeader("Referrer-Policy","no-referrer");
        response.setHeader("X-Frame-Options","DENY");
        response.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=(), usb=()");
      }

      if(method==="GET"&&pathname==="/admin/assets/system.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(adminSystemCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/i18n-ko.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(adminKoreanJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/shell.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(adminShellJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/auth-session.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(adminAuthSessionJs);return;}
      if(method==="GET"&&pathname==="/admin/login"){response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'","Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY","X-Content-Type-Options":"nosniff"});response.end(adminLoginHtml);return;}
      if(method==="GET"&&pathname==="/admin/assets/login.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(adminLoginCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/login.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(adminLoginJs);return;}
      if(method==="GET"&&pathname==="/admin/security"){response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"});response.end(decorateAdminHtml(securityHtml.replace("</head>",'<link rel="stylesheet" href="/admin/assets/security-alerts.css"></head>').replace("</body>",'<script src="/admin/assets/security-alerts.js" defer></script></body>'),pathname));return;}
      if(method==="GET"&&pathname==="/admin/assets/security.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(securityCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/security.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(securityJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/security-alerts.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(adminSecurityAlertCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/security-alerts.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(adminSecurityAlertJs);return;}
      if(method==="GET"&&pathname==="/admin/orders"){response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"});const page=ordersHtml.replace("</head>",'<link rel="stylesheet" href="/admin/assets/order-returns.css"><link rel="stylesheet" href="/admin/assets/order-reconciliation.css"><link rel="stylesheet" href="/admin/assets/printful-draft-cleanup.css"><link rel="stylesheet" href="/admin/assets/order-automation-order-guard.css"><link rel="stylesheet" href="/admin/assets/order-audit-history.css"></head>').replace("</body>",'<script src="/admin/assets/order-returns.js" defer></script><script src="/admin/assets/order-reconciliation.js" defer></script><script src="/admin/assets/order-reconciliation-scans.js" defer></script><script src="/admin/assets/order-reconciliation-labels.js" defer></script><script src="/admin/assets/printful-draft-cleanup.js" defer></script><script src="/admin/assets/order-automation-order-guard.js" defer></script><script src="/admin/assets/order-audit-history.js" defer></script></body>');response.end(decorateAdminHtml(page,pathname));return;}
      if(method==="GET"&&pathname==="/admin/assets/orders.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(ordersCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/orders.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(ordersJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/printful-draft-cleanup.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(printfulDraftCleanupCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/printful-draft-cleanup.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(printfulDraftCleanupJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-automation-order-guard.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(orderAutomationOrderGuardCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-automation-order-guard.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(orderAutomationOrderGuardJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-audit-history.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(orderAuditHistoryCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-audit-history.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(orderAuditHistoryJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-returns.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(orderReturnsCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-returns.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(orderReturnsJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-reconciliation.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(orderReconciliationCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-reconciliation.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(orderReconciliationJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-reconciliation-scans.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(orderReconciliationScansJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-reconciliation-labels.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(orderReconciliationLabelsJs);return;}
      if(method==="GET"&&(pathname==="/admin"||pathname==="/admin/")){response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"});const page=overviewHtml.replace("</head>",'<link rel="stylesheet" href="/admin/assets/process-health.css"><link rel="stylesheet" href="/admin/assets/overview-automation.css"><link rel="stylesheet" href="/admin/assets/overview-privacy-maintenance-alert.css"></head>').replace('<section class="panel"><div class="journey-head">','<section id="automation-overview" class="panel automation-overview"><div class="automation-overview-head"><div><span class="eyebrow">ORDER SAFETY</span><h2>주문 자동화 안전 상태</h2></div><span class="automation-overview-state">확인 중</span></div><p class="automation-overview-body muted">워크스페이스 연결 후 상태를 확인합니다.</p><div class="automation-overview-blockers"></div><p class="automation-overview-meta"></p></section><section class="panel"><div class="journey-head">').replace("</main>",'<section id="process-health" class="panel"><div class="process-health-head"><div><h2>프로세스 운영 상태</h2><p class="muted">API·워커·예약 작업의 마지막 실행 신호를 확인합니다.</p></div><div><button id="process-health-refresh">상태 새로고침</button><div id="process-health-updated" class="muted"></div></div></div><div id="process-health-summary" class="process-health-summary"></div><div id="process-health-list" class="process-health-list"><div class="empty">관리자 연결 후 상태를 확인합니다.</div></div><p id="process-health-note" class="process-health-note" hidden>로컬 미리보기는 프로덕션 supervisor를 사용하지 않으므로 실행 기록 없음으로 표시될 수 있습니다.</p></section></main>').replace("</body>",'<script src="/admin/assets/overview-reconciliation.js" defer></script><script src="/admin/assets/process-health.js" defer></script><script src="/admin/assets/overview-automation.js" defer></script><script src="/admin/assets/overview-privacy-maintenance-alert.js" defer></script></body>');response.end(decorateAdminHtml(page,pathname));return;}
      if(method==="GET"&&pathname==="/admin/assets/overview.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(overviewCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/overview.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(overviewJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/overview-reconciliation.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(overviewReconciliationJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/overview-automation.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(overviewAutomationCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/overview-automation.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(overviewAutomationJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/overview-shopify-throttle.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(overviewShopifyThrottleCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/overview-shopify-throttle.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(overviewShopifyThrottleJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/overview-uninstall-alert.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(overviewUninstallAlertCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/overview-uninstall-alert.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(overviewUninstallAlertJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/process-health.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(processHealthCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/process-health.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(processHealthJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/overview-privacy-maintenance-alert.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(overviewPrivacyMaintenanceAlertCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/overview-privacy-maintenance-alert.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(overviewPrivacyMaintenanceAlertJs);return;}
      if(method==="GET"&&pathname==="/admin/catalog"){response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"});response.end(decorateAdminHtml(catalogHtml,pathname));return;}
      if(method==="GET"&&pathname==="/admin/assets/catalog.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(catalogCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/catalog.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(catalogJs);return;}
      if(method==="GET"&&pathname==="/admin/onboarding"){response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"});const page=onboardingHtml.replace('</head>','<link rel="stylesheet" href="/admin/assets/onboarding-auth.css"></head>').replace('<script src="/admin/assets/onboarding.js"','<script src="/admin/assets/onboarding-auth.js" defer></script><script src="/admin/assets/onboarding-idempotency.js" defer></script><script src="/admin/assets/onboarding.js"');response.end(decorateAdminHtml(page,pathname));return;}
      if(method==="GET"&&pathname==="/admin/assets/onboarding.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(onboardingCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/onboarding.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(onboardingJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/onboarding-auth.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(onboardingAuthJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/onboarding-auth.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(onboardingAuthCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/onboarding-idempotency.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(onboardingIdempotencyJs);return;}
      if(method==="GET"&&pathname==="/admin/store"){response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"});response.end(decorateAdminHtml(storeHtml,pathname));return;}
      if(method==="GET"&&pathname==="/admin/assets/store.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(storeCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/store.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(storeJs);return;}
      if(method==="GET"&&pathname==="/admin/designs"){response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"});response.end(decorateAdminHtml(designsHtml,pathname));return;}
      if(method==="GET"&&pathname==="/admin/assets/designs.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(designsCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/designs.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(designsJs);return;}
      if(method==="GET"&&pathname==="/admin/integrations"){response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"});const page=integrationsHtml.replace("</head>",'<link rel="stylesheet" href="/admin/assets/integrations-test.css"><link rel="stylesheet" href="/admin/assets/shopify-connect.css"><link rel="stylesheet" href="/admin/assets/printful-connect.css"><link rel="stylesheet" href="/admin/assets/integration-disconnect.css"><link rel="stylesheet" href="/admin/assets/webhook-readiness.css"><link rel="stylesheet" href="/admin/assets/webhook-health.css"><link rel="stylesheet" href="/admin/assets/pilot-readiness.css"><link rel="stylesheet" href="/admin/assets/shopify-token-alerts.css"><link rel="stylesheet" href="/admin/assets/order-automation.css"></head>').replace("</body>",'<script src="/admin/assets/integrations-test.js" defer></script><script src="/admin/assets/shopify-connect.js" defer></script><script src="/admin/assets/printful-connect.js" defer></script><script src="/admin/assets/integration-disconnect.js" defer></script><script src="/admin/assets/webhook-readiness.js" defer></script><script src="/admin/assets/webhook-health.js" defer></script><script src="/admin/assets/pilot-readiness.js" defer></script><script src="/admin/assets/shopify-token-alerts.js" defer></script><script src="/admin/assets/order-automation.js" defer></script><script src="/admin/assets/order-automation-history.js" defer></script></body>');response.end(decorateAdminHtml(page,pathname));return;}
      if(method==="GET"&&pathname==="/admin/privacy"){response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"});const page=privacyHtml.replace("</head>",'<link rel="stylesheet" href="/admin/assets/privacy-redaction.css"><link rel="stylesheet" href="/admin/assets/privacy-export.css"><link rel="stylesheet" href="/admin/assets/shop-redaction-impact.css"><link rel="stylesheet" href="/admin/assets/privacy-sla.css"><link rel="stylesheet" href="/admin/assets/privacy-alerts.css"><link rel="stylesheet" href="/admin/assets/privacy-webhook.css"><link rel="stylesheet" href="/admin/assets/privacy-maintenance.css"><link rel="stylesheet" href="/admin/assets/privacy-maintenance-history.css"></head>').replace("</body>",'<script src="/admin/assets/privacy-redaction.js" defer></script><script src="/admin/assets/privacy-export.js" defer></script><script src="/admin/assets/shop-redaction-impact.js" defer></script><script src="/admin/assets/privacy-sla.js" defer></script><script src="/admin/assets/privacy-alerts.js" defer></script><script src="/admin/assets/privacy-webhook.js" defer></script><script src="/admin/assets/privacy-maintenance.js" defer></script><script src="/admin/assets/privacy-maintenance-history.js" defer></script></body>');response.end(decorateAdminHtml(page,pathname));return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(privacyCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(privacyJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-redaction.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(privacyRedactionCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-redaction.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(privacyRedactionJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-export.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(privacyExportCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-export.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(privacyExportJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/shop-redaction-impact.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(shopRedactionImpactCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/shop-redaction-impact.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(shopRedactionImpactJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-sla.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(privacySlaCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-sla.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(privacySlaJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-alerts.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(privacyAlertsCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-alerts.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(privacyAlertsJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-webhook.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(privacyWebhookCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-webhook.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(privacyWebhookJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-maintenance.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(privacyMaintenanceCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-maintenance.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(privacyMaintenanceJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-maintenance-history.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(privacyMaintenanceHistoryCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/privacy-maintenance-history.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(privacyMaintenanceHistoryJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/integrations.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(integrationsCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/integrations.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(integrationsJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/shopify-token-alerts.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(shopifyTokenAlertCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/shopify-token-alerts.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(shopifyTokenAlertJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/integrations-test.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(integrationsTestCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/integrations-test.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(integrationsTestJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/shopify-connect.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(shopifyConnectCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/shopify-connect.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(shopifyConnectJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/printful-connect.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(printfulConnectCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/printful-connect.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(printfulConnectJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/integration-disconnect.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(integrationDisconnectCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/integration-disconnect.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(integrationDisconnectJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/webhook-readiness.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(webhookReadinessCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/webhook-readiness.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(webhookReadinessJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/webhook-health.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(webhookHealthCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/webhook-health.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(webhookHealthJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/pilot-readiness.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(pilotReadinessCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/pilot-readiness.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(pilotReadinessJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-automation.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(orderAutomationCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-automation.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(orderAutomationJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-automation-history.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(orderAutomationHistoryJs);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-automation-activity.css"){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(orderAutomationActivityCss);return;}
      if(method==="GET"&&pathname==="/admin/assets/order-automation-activity.js"){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(orderAutomationActivityJs);return;}
      if(method==="GET"&&/^\/preview\/store\/[^/]+$/.test(pathname)&&previewStorefront){response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'self'; connect-src 'self'; img-src 'self' https://*.printful.com https://*.printfulusercontent.com; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'self'","X-Content-Type-Options":"nosniff"});response.end(storefrontPreviewHtml);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront.css"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(storefrontPreviewCss);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront.js"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(storefrontPreviewJs);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-cart.css"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(storefrontCartCss);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-cart.js"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(storefrontCartJs);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-checkout.css"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(storefrontCheckoutCss);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-checkout.js"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(storefrontCheckoutJs);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-catalog.css"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(storefrontCatalogCss);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-catalog.js"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(storefrontCatalogJs);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-seo.js"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(storefrontSeoJs);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-a11y.css"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(storefrontA11yCss);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-a11y.js"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(storefrontA11yJs);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-images.js"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(storefrontImagesJs);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-data-cache.js"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(storefrontDataCacheJs);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-resilience.css"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/css; charset=utf-8","Cache-Control":"no-cache"});response.end(storefrontResilienceCss);return;}
      if(method==="GET"&&pathname==="/preview/assets/storefront-resilience.js"&&previewStorefront){response.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});response.end(storefrontResilienceJs);return;}
      const previewStorefrontMatch=pathname.match(/^\/api\/preview\/workspaces\/([^/]+)\/storefront$/);
      if(method==="GET"&&previewStorefrontMatch?.[1]&&previewStorefront){const workspaceId=decodeURIComponent(previewStorefrontMatch[1]),item=await previewStorefront.published(workspaceId);if(!item)throw new DomainError("NOT_FOUND","게시 완료된 스토어 구성이 없습니다.");sendJson(response,200,{data:{draft:item,products:await previewStorefront.publishedProducts(workspaceId)}});return;}
      if(method==="GET"&&pathname==="/preview/assets/product-placeholder.svg"&&previewStorefront){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><rect width="900" height="900" fill="#ecebe5"/><path d="M320 250h260l70 90-80 75-35-45v300H365V370l-35 45-80-75z" fill="#d3d1c8"/><text x="450" y="760" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#77746c">STORZY PRODUCT PREVIEW</text></svg>`;response.writeHead(200,{"Content-Type":"image/svg+xml; charset=utf-8","Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff"});response.end(svg);return;}

      if(method==="POST"&&pathname==="/webhooks/shopify/orders"&&shopifyOrders){const chunks:Buffer[]=[];let size=0;for await(const chunk of request){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>MAX_BODY_BYTES)throw new DomainError("PAYLOAD_TOO_LARGE","Request body exceeds 128 KiB");chunks.push(b);}const header=(name:string)=>{const value=request.headers[name];return Array.isArray(value)?value[0]:value;},hmac=header("x-shopify-hmac-sha256"),webhookId=header("x-shopify-webhook-id"),topic=header("x-shopify-topic"),shopDomain=header("x-shopify-shop-domain"),apiVersion=header("x-shopify-api-version");const result=await shopifyOrders.receive(Buffer.concat(chunks),{...(hmac?{hmac}:{}),...(webhookId?{webhookId}:{}),...(topic?{topic}:{}),...(shopDomain?{shopDomain}:{}),...(apiVersion?{apiVersion}:{})});sendJson(response,200,{data:result});return;}
      if(method==="POST"&&pathname==="/webhooks/shopify/app-uninstalled"&&shopifyAppUninstalled){const chunks:Buffer[]=[];let size=0;for await(const chunk of request){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>MAX_BODY_BYTES)throw new DomainError("PAYLOAD_TOO_LARGE","Request body exceeds 128 KiB");chunks.push(b);}const header=(name:string)=>{const value=request.headers[name];return Array.isArray(value)?value[0]:value;},hmac=header("x-shopify-hmac-sha256"),webhookId=header("x-shopify-webhook-id"),topic=header("x-shopify-topic"),shopDomain=header("x-shopify-shop-domain");sendJson(response,200,{data:await shopifyAppUninstalled.receive(Buffer.concat(chunks),{...(hmac?{hmac}:{}),...(webhookId?{webhookId}:{}),...(topic?{topic}:{}),...(shopDomain?{shopDomain}:{})})});return;}
      const privacyMatch=pathname.match(/^\/webhooks\/shopify\/privacy\/(customers\/data_request|customers\/redact|shop\/redact)$/);
      if(method==="POST"&&privacyMatch?.[1]&&privacyWebhooks){const chunks:Buffer[]=[];let size=0;for await(const chunk of request){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>MAX_BODY_BYTES)throw new DomainError("PAYLOAD_TOO_LARGE","Request body exceeds 128 KiB");chunks.push(b);}const header=(name:string)=>{const value=request.headers[name];return Array.isArray(value)?value[0]:value;},topics:Record<string,PrivacyTopic>={"customers/data_request":"CUSTOMERS_DATA_REQUEST","customers/redact":"CUSTOMERS_REDACT","shop/redact":"SHOP_REDACT"},hmac=header("x-shopify-hmac-sha256"),webhookId=header("x-shopify-webhook-id"),shopDomain=header("x-shopify-shop-domain"),shopifyTopic=header("x-shopify-topic");const result=await privacyWebhooks.receive(topics[privacyMatch[1]]!,Buffer.concat(chunks),{...(hmac?{hmac}:{}),...(webhookId?{webhookId}:{}),...(shopDomain?{shopDomain}:{}),...(shopifyTopic?{topic:shopifyTopic}:{})});sendJson(response,200,{data:result});return;}

      if(method==="POST"&&pathname==="/webhooks/printful"&&printfulWebhook){const chunks:Buffer[]=[];let size=0;for await(const chunk of request){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>MAX_BODY_BYTES)throw new DomainError("PAYLOAD_TOO_LARGE","Request body exceeds 128 KiB");chunks.push(b);}const header=(name:string)=>{const value=request.headers[name];return Array.isArray(value)?value[0]:value;},signature=header("x-pf-webhook-signature"),publicKey=header("x-pf-webhook-public-key");const result=await printfulWebhook.receive(Buffer.concat(chunks),{...(signature?{signature}:{}),...(publicKey?{publicKey}:{})});sendJson(response,200,{data:result});return;}

      if (method === "GET" && pathname === "/health") {
        response.setHeader("Cache-Control","no-store");
        sendJson(response, 200, { status: "ok", service: "storzy", release:process.env.STORZY_RELEASE?.trim()||"development", timestamp: new Date().toISOString() });
        return;
      }
      if(method==="GET"&&pathname==="/ready"){
        response.setHeader("Cache-Control","no-store");
        if(!readiness){sendJson(response,503,{status:"unavailable",service:"storzy",checks:{database:false,schema:false},timestamp:new Date().toISOString()});return;}
        try{await readiness.check();sendJson(response,200,{status:"ready",service:"storzy",checks:{database:true,schema:true},timestamp:new Date().toISOString()})}
        catch{sendJson(response,503,{status:"unavailable",service:"storzy",checks:{database:false,schema:false},timestamp:new Date().toISOString()})}
        return;
      }

      const previewAssetMatch=pathname.match(/^\/preview-assets\/uploads\/([A-Za-z0-9_-]{1,128})\/([0-9a-f-]{36}[.](?:png|jpg))$/);
      if(method==="GET"&&previewAssetMatch?.[1]&&previewAssetMatch[2]&&previewDesignUploads){const bytes=await previewDesignUploads.read(decodeURIComponent(previewAssetMatch[1]),previewAssetMatch[2]);if(!bytes)throw new DomainError("NOT_FOUND","Uploaded design was not found");const type=previewAssetMatch[2].endsWith(".png")?"image/png":"image/jpeg";response.writeHead(200,{"Content-Type":type,"Content-Length":bytes.byteLength,"Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"});response.end(bytes);return;}

      const protectedBrandPath=pathname==="/api/workspaces"||/^\/api\/workspaces\/[^/]+\/(?:brand-profile-revisions|notifications(?:\/[^/]+\/read)?)$/.test(pathname)||/^\/api\/brand-profile-revisions\/[^/]+(?:\/(?:approve|editor-revisions))?$/.test(pathname);
      if(protectedBrandPath)requireAdmin(request,adminToken);

      const designUploadMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/design-uploads$/);
      if(method==="GET"&&designUploadMatch?.[1]&&previewDesignUploads){requireAdmin(request,adminToken);const workspaceId=decodeURIComponent(designUploadMatch[1]),workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","Only active workspaces can access design uploads");sendJson(response,200,{data:await previewDesignUploads.usage(workspaceId)});return;}
      if(method==="POST"&&designUploadMatch?.[1]&&previewDesignUploads){requireAdmin(request,adminToken);const workspaceId=decodeURIComponent(designUploadMatch[1]),workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","Only active workspaces can upload designs");const rawType=Array.isArray(request.headers["content-type"])?request.headers["content-type"][0]:request.headers["content-type"],mimeType=(rawType??"").split(";",1)[0]!.trim().toLowerCase();const bytes=await readBinary(request);const item=await previewDesignUploads.save(workspaceId,bytes,mimeType);sendJson(response,201,{data:item});return;}

      if (method === "POST" && pathname === "/api/workspaces") {
        const body = await readJson(request);
        const workspace = await service.createWorkspace({ name: body.name, actorId: body.actorId });
        sendJson(response, 201, { data: workspace });
        return;
      }
      if(method==="GET"&&pathname==="/api/admin/workspaces"){requireAdmin(request,adminToken);const limit=Number(new URL(request.url??"/","http://localhost").searchParams.get("limit")??50);sendJson(response,200,{data:await service.listWorkspaces(limit)});return;}
      const shopifyOAuthStartMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/integrations\/shopify\/oauth\/start$/);
      if(method==="POST"&&shopifyOAuthStartMatch?.[1]){requireAdmin(request,adminToken);if(!shopifyOAuth)throw new DomainError("SERVICE_UNAVAILABLE","Shopify OAuth is not configured");const workspaceId=decodeURIComponent(shopifyOAuthStartMatch[1]),workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","Only active workspaces can connect Shopify");const body=await readJson(request),started=await shopifyOAuth.begin({workspaceId,shopDomain:String(body.shopDomain??"").trim(),actorId:String(body.actorId??"").trim()||"admin-ui"});response.setHeader("Set-Cookie",started.cookie);sendJson(response,200,{data:{authorizationUrl:started.authorizationUrl}});return;}
      const shopifyOAuthReadinessMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/integrations\/shopify\/oauth\/readiness$/);
      if(method==="GET"&&shopifyOAuthReadinessMatch?.[1]){requireAdmin(request,adminToken);const workspaceId=decodeURIComponent(shopifyOAuthReadinessMatch[1]),workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","Only active workspaces can inspect Shopify OAuth readiness");sendJson(response,200,{data:shopifyOAuthReadinessFromEnv(process.env)});return;}
      if(method==="GET"&&pathname==="/api/integrations/shopify/oauth/callback"){if(!shopifyOAuth)throw new DomainError("SERVICE_UNAVAILABLE","Shopify OAuth is not configured");const completed=await shopifyOAuth.complete(new URL(request.url??"/","http://localhost").searchParams,Array.isArray(request.headers.cookie)?request.headers.cookie[0]:request.headers.cookie);response.writeHead(303,{Location:`/admin/integrations?shopify=connected&workspace=${encodeURIComponent(completed.workspaceId)}`,"Set-Cookie":"storzy_shopify_oauth=; Path=/api/integrations/shopify/oauth/callback; HttpOnly; SameSite=Lax; Max-Age=0","Cache-Control":"no-store"});response.end();return;}
      const integrationMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/integrations$/);
      if(method==="GET"&&integrationMatch?.[1]){requireAdmin(request,adminToken);const workspaceId=decodeURIComponent(integrationMatch[1]),workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","Only active workspaces can inspect integrations");const base=integrationStatusFromEnv(process.env),stored=integrationConnections?await integrationConnections.list(workspaceId):[];sendJson(response,200,{data:mergeStoredIntegrationStatus(base,stored)});return;}
      const tokenAlertListMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/shopify-token-alert-deliveries$/),tokenAlertRequeueMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/shopify-token-alert-deliveries\/([^/]+)\/requeue$/);
      if(method==="GET"&&tokenAlertListMatch?.[1]&&shopifyTokenAlerts){requireAdmin(request,adminToken);sendJson(response,200,{data:await shopifyTokenAlerts.list({workspaceId:decodeURIComponent(tokenAlertListMatch[1])})});return;}
      if(method==="POST"&&tokenAlertRequeueMatch?.[1]&&tokenAlertRequeueMatch[2]&&shopifyTokenAlerts){requireAdmin(request,adminToken);const body=await readJson(request),saved=await shopifyTokenAlerts.requeue({workspaceId:decodeURIComponent(tokenAlertRequeueMatch[1]),id:decodeURIComponent(tokenAlertRequeueMatch[2]),actorId:String(body.actorId??""),reason:String(body.reason??"")});if(!saved)throw new DomainError("NOT_FOUND","알림 전송 이력을 찾을 수 없습니다.");sendJson(response,200,{data:saved});return;}
      const integrationTestMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/integrations\/(shopify|printful)\/test$/);
      if(method==="POST"&&integrationTestMatch?.[1]&&integrationTestMatch[2]){requireAdmin(request,adminToken);const workspaceId=decodeURIComponent(integrationTestMatch[1]),workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","Only active workspaces can test integrations");let testEnv=process.env;const provider=integrationTestMatch[2] as IntegrationProvider;if(provider==="shopify"&&shopifyAccess){const access=await shopifyAccess.resolve(workspaceId);if(!access)throw new DomainError("SHOPIFY_REAUTH_REQUIRED","Shopify 스토어를 다시 연결해야 합니다.");testEnv={...process.env,SHOPIFY_SHOP_DOMAIN:access.shopDomain,SHOPIFY_ADMIN_ACCESS_TOKEN:access.accessToken};}else if(integrationConnections){const stored=await integrationConnections.credentials(workspaceId,provider==="shopify"?"SHOPIFY":"PRINTFUL"),items=await integrationConnections.list(workspaceId),connection=items.find(item=>item.provider===(provider==="shopify"?"SHOPIFY":"PRINTFUL"));if(stored&&connection)testEnv={...process.env,...(provider==="shopify"?{SHOPIFY_SHOP_DOMAIN:connection.accountLabel,SHOPIFY_ADMIN_ACCESS_TOKEN:stored.accessToken}:{PRINTFUL_TOKEN:stored.token,PRINTFUL_STORE_ID:stored.storeId})};}sendJson(response,200,{data:await testIntegrationConnection(provider,testEnv)});return;}
      const printfulRegisterMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/integrations\/printful\/register$/);
      if(method==="POST"&&printfulRegisterMatch?.[1]){requireAdmin(request,adminToken);if(!integrationConnections)throw new DomainError("SERVICE_UNAVAILABLE","Encrypted integration storage is not configured");const workspaceId=decodeURIComponent(printfulRegisterMatch[1]),workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","Only active workspaces can connect Printful");const body=await readJson(request);sendJson(response,200,{data:await registerPrintfulConnection({workspaceId,token:String(body.token??""),storeId:String(body.storeId??""),actorId:String(body.actorId??"")||"admin-ui"},integrationConnections,process.env.PRINTFUL_API_BASE_URL?.trim()||"https://api.printful.com")});return;}
      const integrationDisconnectMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/integrations\/(shopify|printful)\/disconnect$/);
      if(integrationDisconnectMatch?.[1]&&integrationDisconnectMatch[2]){requireAdmin(request,adminToken);if(!integrationConnections)throw new DomainError("SERVICE_UNAVAILABLE","Encrypted integration storage is not configured");const workspaceId=decodeURIComponent(integrationDisconnectMatch[1]),provider=integrationDisconnectMatch[2]==="shopify"?"SHOPIFY":"PRINTFUL";if(method==="GET"){sendJson(response,200,{data:await integrationConnections.disconnectReadiness(workspaceId,provider)});return;}if(method==="POST"){const workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","Only active workspaces can disconnect integrations");const readiness=await integrationConnections.disconnectReadiness(workspaceId,provider);if(!readiness.safe)throw new DomainError("INTEGRATION_HAS_ACTIVE_WORK","진행 중인 주문 또는 작업이 있어 연결을 해제할 수 없습니다.");const body=await readJson(request),actorId=String(body.actorId??"").trim(),reason=String(body.reason??"").trim();if(!actorId||reason.length<1||reason.length>500)throw new DomainError("INVALID_INPUT","actorId와 1~500자의 해제 사유가 필요합니다.");const item=await integrationConnections.disconnect({workspaceId,provider,actorId,reason});if(!item)throw new DomainError("NOT_FOUND","저장된 연결을 찾을 수 없습니다.");sendJson(response,200,{data:{provider:item.provider,status:item.status,accountLabel:item.accountLabel,updatedAt:item.updatedAt}});return;}}
      const webhookReadinessMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/integrations\/webhook-readiness$/);
      if(method==="GET"&&webhookReadinessMatch?.[1]){requireAdmin(request,adminToken);const workspaceId=decodeURIComponent(webhookReadinessMatch[1]);await service.getWorkspace(workspaceId);const stored=integrationConnections?await integrationConnections.list(workspaceId):[],hasStoredShopify=stored.some(item=>item.provider==="SHOPIFY"&&item.status==="CONNECTED"),hasStoredPrintful=stored.some(item=>item.provider==="PRINTFUL"&&item.status==="CONNECTED");sendJson(response,200,{data:webhookReadinessFromEnv(process.env,workspaceId,hasStoredShopify,hasStoredPrintful)});return;}
      const pilotReadinessMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/integrations\/pilot-readiness$/);
      if(method==="GET"&&pilotReadinessMatch?.[1]){requireAdmin(request,adminToken);if(!adminOverview)throw new DomainError("SERVICE_UNAVAILABLE","Pilot readiness is not configured");const workspaceId=decodeURIComponent(pilotReadinessMatch[1]),workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","Only active workspaces can inspect pilot readiness");const stored=integrationConnections?await integrationConnections.list(workspaceId):[],integrations=mergeStoredIntegrationStatus(integrationStatusFromEnv(process.env),stored),hasStoredShopify=stored.some(item=>item.provider==="SHOPIFY"&&item.status==="CONNECTED"),hasStoredPrintful=stored.some(item=>item.provider==="PRINTFUL"&&item.status==="CONNECTED"),webhooks=webhookReadinessFromEnv(process.env,workspaceId,hasStoredShopify,hasStoredPrintful),overview=await adminOverview.get(workspaceId);if(!overview)throw new DomainError("NOT_FOUND","Workspace was not found");const automationEnabled=orderAutomation?await orderAutomation.isEnabled(workspaceId):false;sendJson(response,200,{data:buildPilotReadiness({integrations,webhooks,counts:overview.counts,automationEnabled})});return;}
      const webhookHealthMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/integrations\/webhook-health$/);
      if(method==="GET"&&webhookHealthMatch?.[1]&&webhookHealth){requireAdmin(request,adminToken);const workspaceId=decodeURIComponent(webhookHealthMatch[1]);await service.getWorkspace(workspaceId);sendJson(response,200,{data:await webhookHealth.get(workspaceId)});return;}
      const shopifyWebhookSyncMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/integrations\/shopify\/webhooks\/sync$/);
      if(method==="POST"&&shopifyWebhookSyncMatch?.[1]){requireAdmin(request,adminToken);if(!shopifyAccess)throw new DomainError("SERVICE_UNAVAILABLE","Shopify access provider is not configured");const workspaceId=decodeURIComponent(shopifyWebhookSyncMatch[1]),workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","Only active workspaces can sync webhooks");const access=await shopifyAccess.resolve(workspaceId);if(!access)throw new DomainError("SHOPIFY_REAUTH_REQUIRED","Shopify 스토어를 다시 연결해야 합니다.");sendJson(response,200,{data:await syncShopifyOrderWebhooks({...access,apiVersion:process.env.SHOPIFY_API_VERSION?.trim()||"2026-07",publicAppUrl:process.env.PUBLIC_APP_URL?.trim()||""})});return;}
      const printfulWebhookSyncMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/integrations\/printful\/webhooks\/sync$/);
      if(method==="POST"&&printfulWebhookSyncMatch?.[1]){requireAdmin(request,adminToken);if(!integrationConnections)throw new DomainError("SERVICE_UNAVAILABLE","Encrypted integration storage is not configured");const workspaceId=decodeURIComponent(printfulWebhookSyncMatch[1]),workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","Only active workspaces can sync webhooks");const credentials=await integrationConnections.credentials(workspaceId,"PRINTFUL");if(!credentials?.token||!credentials.storeId)throw new DomainError("NOT_FOUND","연결된 Printful 스토어가 없습니다.");sendJson(response,200,{data:await syncPrintfulWebhooks({token:credentials.token,storeId:credentials.storeId,publicAppUrl:process.env.PUBLIC_APP_URL?.trim()||"",baseUrl:process.env.PRINTFUL_API_BASE_URL?.trim()||"https://api.printful.com"})});return;}
      if(method==="GET"&&pathname==="/api/admin/privacy-alerts"&&privacyAlerts){requireAdmin(request,adminToken);const params=new URL(request.url??"/","http://localhost").searchParams,workspaceId=params.get("workspaceId")?.trim()||undefined,statusValue=params.get("status")?.trim(),status=statusValue==="OPEN"||statusValue==="ACKNOWLEDGED"||statusValue==="RESOLVED"?statusValue:undefined,limit=Number(params.get("limit")??50);sendJson(response,200,{data:await privacyAlerts.list({...workspaceId?{workspaceId}:{},...status?{status}:{},limit})});return;}
      const privacyAlertAckMatch=pathname.match(/^\/api\/admin\/privacy-alerts\/([^/]+)\/acknowledge$/);
      if(method==="POST"&&privacyAlertAckMatch?.[1]&&privacyAlerts){requireAdmin(request,adminToken);const body=await readJson(request),actorId=String(body.actorId??"").trim(),workspaceId=typeof body.workspaceId==="string"&&body.workspaceId.trim()?body.workspaceId.trim():undefined;if(!actorId)throw new DomainError("INVALID_INPUT","담당자 ID가 필요합니다.");const item=await privacyAlerts.acknowledge({id:decodeURIComponent(privacyAlertAckMatch[1]),actorId,...workspaceId?{workspaceId}:{}});if(!item)throw new DomainError("NOT_FOUND","열린 개인정보 경보를 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}
      const privacyAlertRetryMatch=pathname.match(/^\/api\/admin\/privacy-alerts\/([^/]+)\/retry-delivery$/);
      if(method==="POST"&&privacyAlertRetryMatch?.[1]&&privacyAlerts){requireAdmin(request,adminToken);const body=await readJson(request),actorId=String(body.actorId??"").trim(),reason=String(body.reason??"").trim(),workspaceId=typeof body.workspaceId==="string"&&body.workspaceId.trim()?body.workspaceId.trim():undefined;const item=await privacyAlerts.requeueDelivery({alertId:decodeURIComponent(privacyAlertRetryMatch[1]),actorId,reason,...workspaceId?{workspaceId}:{}});if(!item)throw new DomainError("NOT_FOUND","재전송할 개인정보 경보를 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}
      if(method==="GET"&&pathname==="/api/admin/privacy-requests/summary"&&privacyRequests){requireAdmin(request,adminToken);const params=new URL(request.url??"/","http://localhost").searchParams,workspaceId=params.get("workspaceId")?.trim()||undefined;sendJson(response,200,{data:await privacyRequests.summary({...workspaceId?{workspaceId}:{}})});return;}
      if(method==="GET"&&pathname==="/api/admin/privacy-webhook-receipts/summary"&&privacyRequests){requireAdmin(request,adminToken);const params=new URL(request.url??"/","http://localhost").searchParams,workspaceId=params.get("workspaceId")?.trim()||undefined;sendJson(response,200,{data:await privacyRequests.webhookReceiptSummary({...workspaceId?{workspaceId}:{}})});return;}
      if(method==="GET"&&pathname==="/api/admin/privacy-webhook-receipts"&&privacyRequests){requireAdmin(request,adminToken);const params=new URL(request.url??"/","http://localhost").searchParams,workspaceId=params.get("workspaceId")?.trim()||undefined,limit=Number(params.get("limit")??20);sendJson(response,200,{data:await privacyRequests.webhookReceipts({...workspaceId?{workspaceId}:{},limit})});return;}
      if(method==="POST"&&pathname==="/api/admin/privacy-webhook-receipts/reconcile"&&privacyRequests){requireAdmin(request,adminToken);if(!integrationConnections)throw new DomainError("SERVICE_UNAVAILABLE","연동 저장소가 구성되지 않았습니다.");const body=await readJson(request),workspaceId=String(body.workspaceId??"").trim(),actorId=String(body.actorId??"").trim();if(!workspaceId||!actorId)throw new DomainError("INVALID_INPUT","workspaceId와 actorId가 필요합니다.");const workspace=await service.getWorkspace(workspaceId);if(workspace.status!=="ACTIVE")throw new DomainError("WORKSPACE_INACTIVE","활성 워크스페이스만 개인정보 요청을 재연결할 수 있습니다.");const connections=await integrationConnections.list(workspaceId),shopify=connections.find(item=>item.provider==="SHOPIFY"&&item.status==="CONNECTED");if(!shopify)throw new DomainError("SHOPIFY_REAUTH_REQUIRED","연결된 Shopify 스토어가 필요합니다.");sendJson(response,200,{data:await privacyRequests.reconcileWebhookWorkspace({workspaceId,shopDomain:shopify.accountLabel,actorId})});return;}
      if(method==="GET"&&pathname==="/api/admin/privacy-requests"&&privacyRequests){requireAdmin(request,adminToken);const params=new URL(request.url??"/","http://localhost").searchParams,workspaceId=params.get("workspaceId")?.trim()||undefined,status=params.get("status")?.trim()||undefined,limit=Number(params.get("limit")??100);sendJson(response,200,{data:await privacyRequests.list({...workspaceId?{workspaceId}:{},...status?{status}:{},limit})});return;}
      const privacyActionMatch=pathname.match(/^\/api\/admin\/privacy-requests\/([^/]+)\/actions$/);
      if(method==="POST"&&privacyActionMatch?.[1]&&privacyRequests){requireAdmin(request,adminToken);const body=await readJson(request),action=String(body.action??"");if(action!=="START_REVIEW"&&action!=="LEGAL_HOLD"&&action!=="EXECUTE_CUSTOMER_REDACTION")throw new DomainError("INVALID_INPUT","지원하지 않는 개인정보 처리 작업입니다.");const item=await privacyRequests.act({id:decodeURIComponent(privacyActionMatch[1]),action,actorId:String(body.actorId??""),...(typeof body.reason==="string"?{reason:body.reason}:{})});if(!item)throw new DomainError("NOT_FOUND","개인정보 요청을 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}
      const privacyExportMatch=pathname.match(/^\/api\/admin\/privacy-requests\/([^/]+)\/export$/);
      if(method==="POST"&&privacyExportMatch?.[1]&&privacyRequests){requireAdmin(request,adminToken);const body=await readJson(request),item=await privacyRequests.exportCustomerData({id:decodeURIComponent(privacyExportMatch[1]),actorId:String(body.actorId??"")});if(!item)throw new DomainError("NOT_FOUND","개인정보 요청을 찾을 수 없습니다.");const bytes=Buffer.from(JSON.stringify(item,null,2));response.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Content-Disposition":`attachment; filename="storzy-customer-data-${privacyExportMatch[1]}.json"`,"Cache-Control":"no-store, private","Pragma":"no-cache","Content-Length":bytes.byteLength});response.end(bytes);return;}
      const shopRedactionImpactMatch=pathname.match(/^\/api\/admin\/privacy-requests\/([^/]+)\/shop-redaction-impact$/);
      const shopRedactionAuditImpactMatch=pathname.match(/^\/api\/admin\/privacy-requests\/([^/]+)\/shop-redaction-audit-impact$/);
      if(method==="GET"&&shopRedactionAuditImpactMatch?.[1]&&privacyRequests){requireAdmin(request,adminToken);const item=await privacyRequests.shopRedactionAuditImpactForRequest(decodeURIComponent(shopRedactionAuditImpactMatch[1]));if(!item)throw new DomainError("NOT_FOUND","개인정보 요청을 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}
      if(method==="GET"&&shopRedactionImpactMatch?.[1]&&privacyRequests){requireAdmin(request,adminToken);const item=await privacyRequests.shopRedactionImpact(decodeURIComponent(shopRedactionImpactMatch[1]));if(!item)throw new DomainError("NOT_FOUND","개인정보 요청을 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}
      const shopRedactionExecuteMatch=pathname.match(/^\/api\/admin\/privacy-requests\/([^/]+)\/shop-redaction$/);
      if(method==="POST"&&shopRedactionExecuteMatch?.[1]&&privacyRequests){requireAdmin(request,adminToken);const body=await readJson(request),item=await privacyRequests.executeShopRedaction({id:decodeURIComponent(shopRedactionExecuteMatch[1]),actorId:String(body.actorId??""),confirmation:String(body.confirmation??"")});if(!item)throw new DomainError("NOT_FOUND","개인정보 요청을 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}

      const onboardingMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/brand-profile-revisions$/);
      if (method === "GET" && onboardingMatch?.[1]) {
        const revisions = await service.listRevisions(decodeURIComponent(onboardingMatch[1]));
        sendJson(response, 200, { data: revisions });
        return;
      }
      if (method === "POST" && onboardingMatch?.[1]) {
        const body = await readJson(request);
        const idempotencyValue=request.headers["idempotency-key"],idempotencyKey=Array.isArray(idempotencyValue)?idempotencyValue[0]:idempotencyValue;
        if(!idempotencyKey||!/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey))throw new DomainError("INVALID_INPUT","valid Idempotency-Key header is required");
        const result = await service.submitOnboarding({
          workspaceId: decodeURIComponent(onboardingMatch[1]),
          answers: body.answers,
          actorId: body.actorId,
          correlationId: idempotencyKey,
        });
        sendJson(response, 202, { data: result });
        return;
      }

      const storeDraftMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/store-drafts$/);
      if (storeDraftMatch?.[1] && storeConfig) {
        requireAdmin(request, adminToken);
        const workspaceId = decodeURIComponent(storeDraftMatch[1]);
        if (method === "GET") {
          sendJson(response, 200, { data: await storeConfig.list(workspaceId) });
          return;
        }
        if (method === "POST") {
          const body = await readJson(request);
          if (typeof body.actorId !== "string") throw new DomainError("INVALID_INPUT", "actorId is required");
          sendJson(response, 201, { data: await storeConfig.generate({ workspaceId, actorId: body.actorId }) });
          return;
        }
      }

      const storeRevisionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/store-drafts\/([^/]+)\/(revisions|approve)$/);
      if (method === "POST" && storeRevisionMatch?.[1] && storeRevisionMatch[2] && storeRevisionMatch[3] && storeConfig) {
        requireAdmin(request, adminToken);const body=await readJson(request);
        if(typeof body.actorId!=="string")throw new DomainError("INVALID_INPUT","actorId is required");
        const workspaceId=decodeURIComponent(storeRevisionMatch[1]),draftId=decodeURIComponent(storeRevisionMatch[2]);
        const item=storeRevisionMatch[3]==="approve"
          ?await storeConfig.approve({workspaceId,draftId,actorId:body.actorId})
          :await storeConfig.createRevision({workspaceId,baseDraftId:draftId,configData:body.configData,actorId:body.actorId});
        sendJson(response,storeRevisionMatch[3]==="approve"?200:201,{data:item});return;
      }

      const storeRequeueMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/store-drafts\/([^/]+)\/publication\/requeue$/);
      if(method==="POST"&&storeRequeueMatch?.[1]&&storeRequeueMatch[2]&&storeConfig){requireAdmin(request,adminToken);const body=await readJson(request);if(typeof body.actorId!=="string"||typeof body.reason!=="string")throw new DomainError("INVALID_INPUT","actorId and reason are required");sendJson(response,200,{data:await storeConfig.requeuePublication({workspaceId:decodeURIComponent(storeRequeueMatch[1]),draftId:decodeURIComponent(storeRequeueMatch[2]),actorId:body.actorId,reason:body.reason})});return;}

      const revisionMatch = pathname.match(/^\/api\/brand-profile-revisions\/([^/]+)$/);
      if (method === "GET" && revisionMatch?.[1]) {
        const revision = await service.getRevision(decodeURIComponent(revisionMatch[1]));
        sendJson(response, 200, { data: revision });
        return;
      }

      const approvalMatch = pathname.match(/^\/api\/brand-profile-revisions\/([^/]+)\/approve$/);
      if (method === "POST" && approvalMatch?.[1]) {
        const body = await readJson(request);
        const revision = await service.approveRevision({
          revisionId: decodeURIComponent(approvalMatch[1]),
          actorId: body.actorId,
        });
        sendJson(response, 200, { data: revision });
        return;
      }

      const editorRevisionMatch = pathname.match(/^\/api\/brand-profile-revisions\/([^/]+)\/editor-revisions$/);
      if (method === "POST" && editorRevisionMatch?.[1]) {
        const body = await readJson(request);
        const revision = await service.createEditedRevision({
          baseRevisionId: decodeURIComponent(editorRevisionMatch[1]),
          profileData: body.profileData,
          actorId: body.actorId,
        });
        sendJson(response, 201, { data: revision });
        return;
      }

      const notificationListMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/notifications$/);
      if (method === "GET" && notificationListMatch?.[1] && notifications) {
        const url = new URL(request.url ?? "/", "http://localhost");
        const statusValue = url.searchParams.get("status");
        if (statusValue && statusValue !== "UNREAD" && statusValue !== "READ") {
          throw new DomainError("INVALID_INPUT", "notification status must be UNREAD or READ");
        }
        const notificationStatus = statusValue as "UNREAD" | "READ" | null;
        const limitValue = url.searchParams.get("limit");
        const limit = limitValue ? Number(limitValue) : undefined;
        if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
          throw new DomainError("INVALID_INPUT", "notification limit must be between 1 and 100");
        }
        const items = await notifications.list({
          workspaceId: decodeURIComponent(notificationListMatch[1]),
          ...(notificationStatus ? { status: notificationStatus } : {}),
          ...(limit !== undefined ? { limit } : {}),
        });
        sendJson(response, 200, { data: items });
        return;
      }

      const notificationReadMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/notifications\/([^/]+)\/read$/);
      if (method === "POST" && notificationReadMatch?.[1] && notificationReadMatch[2] && notifications) {
        const body = await readJson(request);
        if (typeof body.actorId !== "string" || !body.actorId.trim()) throw new DomainError("INVALID_INPUT", "actorId is required");
        const item = await notifications.markRead({
          workspaceId: decodeURIComponent(notificationReadMatch[1]),
          notificationId: decodeURIComponent(notificationReadMatch[2]),
          actorId: body.actorId.trim(),
        });
        if (!item) throw new DomainError("NOT_FOUND", "Notification was not found");
        sendJson(response, 200, { data: item });
        return;
      }

      const candidateListMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/product-candidates$/);
      const protectedCatalogPath=/^\/api\/workspaces\/[^/]+\/(?:product-candidates(?:\/[^/]+\/(?:decision|design-asset|mockup\/requeue|design-resolution\/override))?|product-contents(?:\/[^/]+\/revisions)?|product-content-revisions\/[^/]+\/approve)$/.test(pathname);
      if(protectedCatalogPath)requireAdmin(request,adminToken);
      if (method === "GET" && candidateListMatch?.[1] && candidates) {
        const url = new URL(request.url ?? "/", "http://localhost");
        const eligibility = url.searchParams.get("eligibility");
        const decisionStatus = url.searchParams.get("decisionStatus");
        const sort = url.searchParams.get("sort") ?? "score_desc";
        const limit = Number(url.searchParams.get("limit") ?? 50);
        const offset = Number(url.searchParams.get("offset") ?? 0);
        if (eligibility && eligibility !== "ELIGIBLE" && eligibility !== "EXCLUDED") throw new DomainError("INVALID_INPUT", "eligibility must be ELIGIBLE or EXCLUDED");
        if (decisionStatus && !["UNREVIEWED", "APPROVED", "REJECTED"].includes(decisionStatus)) throw new DomainError("INVALID_INPUT", "decisionStatus is invalid");
        if (sort !== "score_desc" && sort !== "created_asc") throw new DomainError("INVALID_INPUT", "sort must be score_desc or created_asc");
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new DomainError("INVALID_INPUT", "limit must be between 1 and 100");
        if (!Number.isInteger(offset) || offset < 0 || offset > 10_000) throw new DomainError("INVALID_INPUT", "offset must be between 0 and 10000");
        const page = await candidates.list({
          workspaceId: decodeURIComponent(candidateListMatch[1]),
          ...(eligibility ? { eligibility: eligibility as "ELIGIBLE" | "EXCLUDED" } : {}),
          ...(decisionStatus ? { decisionStatus: decisionStatus as "UNREVIEWED" | "APPROVED" | "REJECTED" } : {}),
          sort, limit, offset,
        });
        sendJson(response, 200, { data: page });
        return;
      }

      const candidateDecisionMatch = pathname.match(/^\/api\/workspaces\/([^/]+)\/product-candidates\/([^/]+)\/decision$/);
      if (method === "POST" && candidateDecisionMatch?.[1] && candidateDecisionMatch[2] && candidates) {
        const body = await readJson(request);
        const idempotencyValue = request.headers["idempotency-key"];
        const idempotencyKey = Array.isArray(idempotencyValue) ? idempotencyValue[0] : idempotencyValue;
        if (!idempotencyKey || !/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)) throw new DomainError("INVALID_INPUT", "valid Idempotency-Key header is required");
        if (body.decision !== "APPROVED" && body.decision !== "REJECTED") throw new DomainError("INVALID_INPUT", "decision must be APPROVED or REJECTED");
        if (typeof body.actorId !== "string" || !body.actorId.trim()) throw new DomainError("INVALID_INPUT", "actorId is required");
        if (body.reason !== undefined && (typeof body.reason !== "string" || body.reason.length > 500)) throw new DomainError("INVALID_INPUT", "reason must be at most 500 characters");
        const item = await candidates.decide({
          workspaceId: decodeURIComponent(candidateDecisionMatch[1]), candidateId: decodeURIComponent(candidateDecisionMatch[2]),
          decision: body.decision, actorId: body.actorId.trim(), idempotencyKey,
          ...(typeof body.reason === "string" && body.reason.trim() ? { reason: body.reason.trim() } : {}),
        });
        if (!item) throw new DomainError("NOT_FOUND", "Product candidate was not found");
        sendJson(response, 200, { data: item });
        return;
      }

      const contentListMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/product-contents$/);
      const previewOrderMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/preview\/orders$/);
      if(method==="POST"&&previewOrderMatch?.[1]&&previewOrders){requireAdmin(request,adminToken);const body=await readJson(request),quantity=body.quantity===undefined?1:Number(body.quantity);sendJson(response,201,{data:await previewOrders.create(decodeURIComponent(previewOrderMatch[1]),quantity)});return;}
      const previewShipmentMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/preview\/shipments$/);
      if(method==="POST"&&previewShipmentMatch?.[1]&&previewFulfillment){requireAdmin(request,adminToken);sendJson(response,201,{data:await previewFulfillment.create(decodeURIComponent(previewShipmentMatch[1]))});return;}
      if(/^\/api\/workspaces\/[^/]+\/order-exceptions(?:\/[^/]+(?:\/actions)?)?$/.test(pathname))requireAdmin(request,adminToken);
      const adminOverviewMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/admin-overview$/);
      if(method==="GET"&&adminOverviewMatch?.[1]&&adminOverview){requireAdmin(request,adminToken);const item=await adminOverview.get(decodeURIComponent(adminOverviewMatch[1]));if(!item)throw new DomainError("NOT_FOUND","Workspace was not found");sendJson(response,200,{data:item});return;}
      const orderExceptionsMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-exceptions$/);
      if(method==="GET"&&orderExceptionsMatch?.[1]&&orderExceptions){const url=new URL(request.url??"/","http://localhost"),status=url.searchParams.get("status"),limit=Number(url.searchParams.get("limit")??50),offset=Number(url.searchParams.get("offset")??0);if(status&&!['HELD','WAITING','RETURNED','SUBMITTED','FULFILLMENT_FAILED'].includes(status))throw new DomainError("INVALID_INPUT","status must be HELD, WAITING, RETURNED, SUBMITTED or FULFILLMENT_FAILED");if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0)throw new DomainError("INVALID_INPUT","invalid pagination");sendJson(response,200,{data:await orderExceptions.list({workspaceId:decodeURIComponent(orderExceptionsMatch[1]),...(status?{status:status as 'HELD'|'WAITING'|'RETURNED'|'SUBMITTED'|'FULFILLMENT_FAILED'}:{}),limit,offset})});return;}
      const orderExceptionDetailMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-exceptions\/([^/]+)$/);
      if(method==="GET"&&orderExceptionDetailMatch?.[1]&&orderExceptionDetailMatch[2]&&orderExceptions){const item=await orderExceptions.detail(decodeURIComponent(orderExceptionDetailMatch[1]),decodeURIComponent(orderExceptionDetailMatch[2]));if(!item)throw new DomainError("NOT_FOUND","Order exception was not found");sendJson(response,200,{data:item});return;}
      const fulfillmentRequeueMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-exceptions\/([^/]+)\/fulfillment\/requeue$/);
      if(method==="POST"&&fulfillmentRequeueMatch?.[1]&&fulfillmentRequeueMatch[2]&&orderExceptions){requireAdmin(request,adminToken);const body=await readJson(request),keyValue=request.headers['idempotency-key'],key=Array.isArray(keyValue)?keyValue[0]:keyValue;if(!key||!/^[A-Za-z0-9._:-]{1,128}$/.test(key))throw new DomainError("INVALID_INPUT","유효한 Idempotency-Key가 필요합니다.");const item=await orderExceptions.requeueFulfillment({workspaceId:decodeURIComponent(fulfillmentRequeueMatch[1]),orderId:decodeURIComponent(fulfillmentRequeueMatch[2]),actorId:String(body.actorId??""),reason:String(body.reason??""),idempotencyKey:key});if(!item)throw new DomainError("NOT_FOUND","주문을 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}
      const orderExceptionActionMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-exceptions\/([^/]+)\/actions$/);
      if(method==="POST"&&orderExceptionActionMatch?.[1]&&orderExceptionActionMatch[2]&&orderExceptions){const body=await readJson(request),keyValue=request.headers['idempotency-key'],key=Array.isArray(keyValue)?keyValue[0]:keyValue;if(!key||!/^[A-Za-z0-9._:-]{1,128}$/.test(key)||!['REVALIDATE','MANUAL_APPROVE','REJECT'].includes(String(body.action))||typeof body.actorId!=="string"||!body.actorId.trim())throw new DomainError("INVALID_INPUT","valid action, actorId and Idempotency-Key are required");const item=await orderExceptions.act({workspaceId:decodeURIComponent(orderExceptionActionMatch[1]),orderId:decodeURIComponent(orderExceptionActionMatch[2]),action:body.action as 'REVALIDATE'|'MANUAL_APPROVE'|'REJECT',actorId:body.actorId.trim(),idempotencyKey:key,...(typeof body.reason==='string'?{reason:body.reason}:{})});if(!item)throw new DomainError("NOT_FOUND","Order exception was not found");sendJson(response,200,{data:item});return;}
      const returnCaseMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/returns\/([^/]+)$/);
      if(method==="GET"&&returnCaseMatch?.[1]&&returnCaseMatch[2]&&returnCases){requireAdmin(request,adminToken);const item=await returnCases.get(decodeURIComponent(returnCaseMatch[1]),decodeURIComponent(returnCaseMatch[2]));if(!item)throw new DomainError("NOT_FOUND","반송 케이스를 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}
      const returnCaseActionMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/returns\/([^/]+)\/actions$/);
      if(method==="POST"&&returnCaseActionMatch?.[1]&&returnCaseActionMatch[2]&&returnCases){requireAdmin(request,adminToken);const body=await readJson(request),keyValue=request.headers['idempotency-key'],key=Array.isArray(keyValue)?keyValue[0]:keyValue;if(!key||!/^[A-Za-z0-9._:-]{1,128}$/.test(key)||!["REQUIRE_REFUND","REVIEW_RESHIPMENT","RESOLVE"].includes(String(body.action)))throw new DomainError("INVALID_INPUT","유효한 반송 작업과 Idempotency-Key가 필요합니다.");const item=await returnCases.act({workspaceId:decodeURIComponent(returnCaseActionMatch[1]),orderId:decodeURIComponent(returnCaseActionMatch[2]),action:body.action as "REQUIRE_REFUND"|"REVIEW_RESHIPMENT"|"RESOLVE",actorId:String(body.actorId??""),reason:String(body.reason??""),idempotencyKey:key});if(!item)throw new DomainError("NOT_FOUND","반송 케이스를 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}
      const reconciliationMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation$/);
      const reconciliationScheduleStatusMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation\/schedule-status$/);
      if(method==="GET"&&reconciliationScheduleStatusMatch?.[1]&&orderReconciliation){requireAdmin(request,adminToken);sendJson(response,200,{data:await orderReconciliation.latestScheduledRun(decodeURIComponent(reconciliationScheduleStatusMatch[1]))});return;}
      const reconciliationScheduleHistoryMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation\/schedule-history$/);
      if(method==="GET"&&reconciliationScheduleHistoryMatch?.[1]&&orderReconciliation){requireAdmin(request,adminToken);const limit=Number(new URL(request.url??"/","http://localhost").searchParams.get("limit")??20);if(!Number.isInteger(limit)||limit<1||limit>50)throw new DomainError("INVALID_INPUT","limit은 1~50 사이의 정수여야 합니다.");sendJson(response,200,{data:await orderReconciliation.listScheduledRuns(decodeURIComponent(reconciliationScheduleHistoryMatch[1]),limit)});return;}
      if(method==="GET"&&reconciliationMatch?.[1]&&orderReconciliation){requireAdmin(request,adminToken);const limit=Number(new URL(request.url??"/","http://localhost").searchParams.get("limit")??50);sendJson(response,200,{data:await orderReconciliation.listIssues(decodeURIComponent(reconciliationMatch[1]),limit)});return;}
      const reconciliationHistoryMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation\/history$/);
      if(method==="GET"&&reconciliationHistoryMatch?.[1]&&orderReconciliation){requireAdmin(request,adminToken);const limit=Number(new URL(request.url??"/","http://localhost").searchParams.get("limit")??50);if(!Number.isInteger(limit)||limit<1||limit>100)throw new DomainError("INVALID_INPUT","limit은 1~100 사이의 정수여야 합니다.");sendJson(response,200,{data:await orderReconciliation.listHistory(decodeURIComponent(reconciliationHistoryMatch[1]),limit)});return;}
      const reconciliationScansMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation\/scans$/);
      if(method==="GET"&&reconciliationScansMatch?.[1]&&orderReconciliation){requireAdmin(request,adminToken);const params=new URL(request.url??"/","http://localhost").searchParams,limit=Number(params.get("limit")??50),orderQuery=params.get("orderQuery")?.trim()||undefined;if(!Number.isInteger(limit)||limit<1||limit>100||orderQuery&&orderQuery.length>100)throw new DomainError("INVALID_INPUT","limit은 1~100, 주문 검색어는 100자 이하여야 합니다.");sendJson(response,200,{data:await orderReconciliation.listScans(decodeURIComponent(reconciliationScansMatch[1]),limit,orderQuery)});return;}
      const reconciliationScanIssuesMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation\/scans\/([^/]+)\/issues$/);
      if(method==="GET"&&reconciliationScanIssuesMatch?.[1]&&reconciliationScanIssuesMatch[2]&&orderReconciliation){requireAdmin(request,adminToken);const params=new URL(request.url??"/","http://localhost").searchParams,limit=Number(params.get("limit")??100),offset=Number(params.get("offset")??0),issueType=params.get("issueType")?.trim()||undefined,orderQuery=params.get("orderQuery")?.trim()||undefined,allowed=['MISSING_LOCAL_ORDER','CANCELLATION_MISMATCH','FINANCIAL_STATUS_MISMATCH'];if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||issueType&&!allowed.includes(issueType)||orderQuery&&orderQuery.length>100)throw new DomainError("INVALID_INPUT","유효한 페이지 범위, 불일치 유형과 100자 이하 주문 검색어가 필요합니다.");sendJson(response,200,{data:await orderReconciliation.listScanIssues(decodeURIComponent(reconciliationScanIssuesMatch[1]),decodeURIComponent(reconciliationScanIssuesMatch[2]),limit,offset,issueType,orderQuery)});return;}
      const reconciliationScanExportsMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation\/scans\/([^/]+)\/exports$/);
      if(method==="GET"&&reconciliationScanExportsMatch?.[1]&&reconciliationScanExportsMatch[2]&&orderReconciliation){requireAdmin(request,adminToken);const limit=Number(new URL(request.url??"/","http://localhost").searchParams.get("limit")??50);if(!Number.isInteger(limit)||limit<1||limit>100)throw new DomainError("INVALID_INPUT","limit은 1~100 사이의 정수여야 합니다.");sendJson(response,200,{data:await orderReconciliation.listScanExports(decodeURIComponent(reconciliationScanExportsMatch[1]),decodeURIComponent(reconciliationScanExportsMatch[2]),limit)});return;}
      const reconciliationScanExportMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation\/scans\/([^/]+)\/export\.csv$/);
      if(method==="POST"&&reconciliationScanExportMatch?.[1]&&reconciliationScanExportMatch[2]&&orderReconciliation){requireAdmin(request,adminToken);const scanId=decodeURIComponent(reconciliationScanExportMatch[2]),body=await readJson(request),item=await orderReconciliation.scanExportWithReason(decodeURIComponent(reconciliationScanExportMatch[1]),scanId,String(body.actorId??""),String(body.reason??""));if(!item)throw new DomainError("NOT_FOUND","대조 스캔을 찾을 수 없습니다.");const bytes=Buffer.from(reconciliationScanCsv(item.issues),"utf8");response.writeHead(200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="storzy-reconciliation-${scanId}.csv"`,"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff","Content-Length":bytes.byteLength});response.end(bytes);return;}
      if(method==="POST"&&reconciliationMatch?.[1]&&orderReconciliation){requireAdmin(request,adminToken);if(!shopifyAccess)throw new DomainError("SERVICE_UNAVAILABLE","Shopify access provider is not configured");const workspaceId=decodeURIComponent(reconciliationMatch[1]),body=await readJson(request),hours=Number(body.hours??24),actorId=String(body.actorId??"").trim();if(!Number.isInteger(hours)||hours<1||hours>168||!actorId)throw new DomainError("INVALID_INPUT","actorId와 1~168시간의 조회 범위가 필요합니다.");const access=await shopifyAccess.resolve(workspaceId);if(!access)throw new DomainError("SHOPIFY_REAUTH_REQUIRED","Shopify 스토어를 다시 연결해야 합니다.");const since=new Date(Date.now()-hours*60*60*1000),orders=await fetchRecentShopifyOrders({...access,apiVersion:process.env.SHOPIFY_API_VERSION?.trim()||"2026-07",since});sendJson(response,200,{data:await orderReconciliation.record({workspaceId,actorId,windowStartedAt:since,orders})});return;}
      const reconciliationIssueActionMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation\/issues\/([^/]+)\/actions$/);
      if(method==="POST"&&reconciliationIssueActionMatch?.[1]&&reconciliationIssueActionMatch[2]&&orderReconciliation){requireAdmin(request,adminToken);const body=await readJson(request),keyValue=request.headers['idempotency-key'],key=Array.isArray(keyValue)?keyValue[0]:keyValue,action=String(body.action??"");if(!key||!/^[A-Za-z0-9._:-]{1,128}$/.test(key)||(action!=="ACKNOWLEDGE"&&action!=="RESOLVE"))throw new DomainError("INVALID_INPUT","유효한 작업과 Idempotency-Key가 필요합니다.");const item=await orderReconciliation.actIssue({workspaceId:decodeURIComponent(reconciliationIssueActionMatch[1]),issueId:decodeURIComponent(reconciliationIssueActionMatch[2]),action,actorId:String(body.actorId??""),reason:String(body.reason??""),idempotencyKey:key});if(!item)throw new DomainError("NOT_FOUND","주문 대조 이슈를 찾을 수 없습니다.");sendJson(response,200,{data:item});return;}
      const reconciliationReplayMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation\/issues\/([^/]+)\/replay$/);
      if(method==="POST"&&reconciliationReplayMatch?.[1]&&reconciliationReplayMatch[2]&&orderReconciliation){requireAdmin(request,adminToken);if(!shopifyAccess||!shopifyOrders)throw new DomainError("SERVICE_UNAVAILABLE","Shopify 안전 재수신 서비스가 설정되지 않았습니다.");const workspaceId=decodeURIComponent(reconciliationReplayMatch[1]),issueId=decodeURIComponent(reconciliationReplayMatch[2]),body=await readJson(request),keyValue=request.headers['idempotency-key'],key=Array.isArray(keyValue)?keyValue[0]:keyValue,actorId=String(body.actorId??""),reason=String(body.reason??""),secret=process.env.SHOPIFY_WEBHOOK_SECRET?.trim()||process.env.SHOPIFY_API_SECRET?.trim();if(!key||!/^[A-Za-z0-9._:-]{1,128}$/.test(key)||!actorId.trim()||!reason.trim()||!secret)throw new DomainError("INVALID_INPUT","처리자, 재수신 사유, Idempotency-Key 및 Shopify 비밀키가 필요합니다.");const target=await orderReconciliation.replayTarget(workspaceId,issueId);if(!target)throw new DomainError("NOT_FOUND","주문 대조 이슈를 찾을 수 없습니다.");const access=await shopifyAccess.resolve(workspaceId);if(!access)throw new DomainError("SHOPIFY_REAUTH_REQUIRED","Shopify 스토어를 다시 연결해야 합니다.");const payload=await fetchShopifyOrderForReplay({...access,apiVersion:process.env.SHOPIFY_API_VERSION?.trim()||"2026-07",orderId:target.shopifyOrderId}),raw=Buffer.from(JSON.stringify(payload)),ingress=await shopifyOrders.receive(raw,{hmac:createHmac("sha256",secret).update(raw).digest("base64"),webhookId:`reconcile:${issueId}:${key}`,topic:"orders/replay",shopDomain:access.shopDomain,apiVersion:process.env.SHOPIFY_API_VERSION?.trim()||"2026-07"});if(!(ingress&&typeof ingress==="object"&&"accepted" in ingress&&ingress.accepted))throw new DomainError("RECONCILIATION_REPLAY_FAILED","Shopify 주문을 안전 재수신하지 못했습니다.");const completed=await orderReconciliation.completeReplay({workspaceId,issueId,actorId,reason,idempotencyKey:key});sendJson(response,200,{data:{...completed,ingress}});return;}
      const reconciliationCancellationMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation\/issues\/([^/]+)\/sync-cancellation$/);
      if(method==="POST"&&reconciliationCancellationMatch?.[1]&&reconciliationCancellationMatch[2]&&orderReconciliation){requireAdmin(request,adminToken);if(!shopifyAccess||!shopifyOrders)throw new DomainError("SERVICE_UNAVAILABLE","Shopify 취소 동기화 서비스가 설정되지 않았습니다.");const workspaceId=decodeURIComponent(reconciliationCancellationMatch[1]),issueId=decodeURIComponent(reconciliationCancellationMatch[2]),body=await readJson(request),keyValue=request.headers['idempotency-key'],key=Array.isArray(keyValue)?keyValue[0]:keyValue,actorId=String(body.actorId??""),reason=String(body.reason??""),secret=process.env.SHOPIFY_WEBHOOK_SECRET?.trim()||process.env.SHOPIFY_API_SECRET?.trim();if(!key||!/^[A-Za-z0-9._:-]{1,128}$/.test(key)||!actorId.trim()||!reason.trim()||!secret)throw new DomainError("INVALID_INPUT","처리자, 취소 동기화 사유, Idempotency-Key 및 Shopify 비밀키가 필요합니다.");const target=await orderReconciliation.cancellationTarget(workspaceId,issueId);if(!target)throw new DomainError("NOT_FOUND","주문 대조 이슈를 찾을 수 없습니다.");const access=await shopifyAccess.resolve(workspaceId);if(!access)throw new DomainError("SHOPIFY_REAUTH_REQUIRED","Shopify 스토어를 다시 연결해야 합니다.");const remote=await fetchShopifyOrderForReplay({...access,apiVersion:process.env.SHOPIFY_API_VERSION?.trim()||"2026-07",orderId:target.shopifyOrderId});if(!remote.cancelled_at)throw new DomainError("RECONCILIATION_REMOTE_STATE_CHANGED","Shopify 주문이 더 이상 취소 상태가 아닙니다. 대조를 다시 실행해 주세요.");const raw=Buffer.from(JSON.stringify({admin_graphql_api_id:remote.admin_graphql_api_id,cancelled_at:remote.cancelled_at})),ingress=await shopifyOrders.receive(raw,{hmac:createHmac("sha256",secret).update(raw).digest("base64"),webhookId:`reconcile-cancel:${issueId}:${key}`,topic:"orders/cancelled",shopDomain:access.shopDomain,apiVersion:process.env.SHOPIFY_API_VERSION?.trim()||"2026-07"});if(!(ingress&&typeof ingress==="object"&&"accepted" in ingress&&ingress.accepted))throw new DomainError("RECONCILIATION_CANCELLATION_SYNC_FAILED","Shopify 주문 취소 상태를 동기화하지 못했습니다.");const completed=await orderReconciliation.completeCancellationSync({workspaceId,issueId,actorId,reason,idempotencyKey:key});sendJson(response,200,{data:{...completed,ingress}});return;}
      const reconciliationFinancialMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/order-reconciliation\/issues\/([^/]+)\/sync-financial-status$/);
      if(method==="POST"&&reconciliationFinancialMatch?.[1]&&reconciliationFinancialMatch[2]&&orderReconciliation){requireAdmin(request,adminToken);if(!shopifyAccess||!shopifyOrders)throw new DomainError("SERVICE_UNAVAILABLE","Shopify 결제 상태 동기화 서비스가 설정되지 않았습니다.");const workspaceId=decodeURIComponent(reconciliationFinancialMatch[1]),issueId=decodeURIComponent(reconciliationFinancialMatch[2]),body=await readJson(request),keyValue=request.headers['idempotency-key'],key=Array.isArray(keyValue)?keyValue[0]:keyValue,actorId=String(body.actorId??""),reason=String(body.reason??""),secret=process.env.SHOPIFY_WEBHOOK_SECRET?.trim()||process.env.SHOPIFY_API_SECRET?.trim();if(!key||!/^[A-Za-z0-9._:-]{1,128}$/.test(key)||!actorId.trim()||!reason.trim()||!secret)throw new DomainError("INVALID_INPUT","처리자, 결제 상태 동기화 사유, Idempotency-Key 및 Shopify 비밀키가 필요합니다.");const target=await orderReconciliation.financialTarget(workspaceId,issueId);if(!target)throw new DomainError("NOT_FOUND","주문 대조 이슈를 찾을 수 없습니다.");const access=await shopifyAccess.resolve(workspaceId);if(!access)throw new DomainError("SHOPIFY_REAUTH_REQUIRED","Shopify 스토어를 다시 연결해야 합니다.");const payload=await fetchShopifyOrderForReplay({...access,apiVersion:process.env.SHOPIFY_API_VERSION?.trim()||"2026-07",orderId:target.shopifyOrderId}),raw=Buffer.from(JSON.stringify(payload)),ingress=await shopifyOrders.receive(raw,{hmac:createHmac("sha256",secret).update(raw).digest("base64"),webhookId:`reconcile-financial:${issueId}:${key}`,topic:"orders/financial-sync",shopDomain:access.shopDomain,apiVersion:process.env.SHOPIFY_API_VERSION?.trim()||"2026-07"});if(!(ingress&&typeof ingress==="object"&&"accepted" in ingress&&ingress.accepted))throw new DomainError("RECONCILIATION_FINANCIAL_SYNC_FAILED","Shopify 주문 결제 상태를 동기화하지 못했습니다.");const completed=await orderReconciliation.completeFinancialSync({workspaceId,issueId,actorId,reason,idempotencyKey:key});sendJson(response,200,{data:{...completed,ingress}});return;}
      const designMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/product-candidates\/([^/]+)\/design-asset$/);
      if(method==="POST"&&designMatch?.[1]&&designMatch[2]&&designs){const body=await readJson(request);if(typeof body.fileUrl!=="string"||typeof body.placement!=="string"||typeof body.technique!=="string"||typeof body.actorId!=="string"||!Array.isArray(body.mockupStyleIds))throw new DomainError("INVALID_INPUT","fileUrl, placement, technique, mockupStyleIds and actorId are required");const item=await designs.register({workspaceId:decodeURIComponent(designMatch[1]),candidateId:decodeURIComponent(designMatch[2]),fileUrl:body.fileUrl,placement:body.placement,technique:body.technique,mockupStyleIds:body.mockupStyleIds as number[],actorId:body.actorId});if(!item)throw new DomainError("NOT_FOUND","Approved product candidate was not found");sendJson(response,201,{data:item});return;}
      const mockupRequeueMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/product-candidates\/([^/]+)\/mockup\/requeue$/);
      if(method==="POST"&&mockupRequeueMatch?.[1]&&mockupRequeueMatch[2]&&designs){const body=await readJson(request);if(typeof body.actorId!=="string"||typeof body.reason!=="string")throw new DomainError("INVALID_INPUT","actorId and reason are required");sendJson(response,200,{data:await designs.requeue({workspaceId:decodeURIComponent(mockupRequeueMatch[1]),candidateId:decodeURIComponent(mockupRequeueMatch[2]),actorId:body.actorId,reason:body.reason})});return;}
      const resolutionOverrideMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/product-candidates\/([^/]+)\/design-resolution\/override$/);
      if(method==="POST"&&resolutionOverrideMatch?.[1]&&resolutionOverrideMatch[2]&&designs){const body=await readJson(request),keyValue=request.headers["idempotency-key"],key=Array.isArray(keyValue)?keyValue[0]:keyValue;if(!key||typeof body.actorId!=="string"||typeof body.reason!=="string"||typeof body.printAreaWidthIn!=="number"||typeof body.printAreaHeightIn!=="number"||typeof body.targetDpi!=="number"||(body.allowedMockupStyleIds!==undefined&&!Array.isArray(body.allowedMockupStyleIds)))throw new DomainError("INVALID_INPUT","print area, targetDpi, actorId, reason and Idempotency-Key are required");const item=await designs.overrideResolution({workspaceId:decodeURIComponent(resolutionOverrideMatch[1]),candidateId:decodeURIComponent(resolutionOverrideMatch[2]),printAreaWidthIn:body.printAreaWidthIn,printAreaHeightIn:body.printAreaHeightIn,targetDpi:body.targetDpi,...(Array.isArray(body.allowedMockupStyleIds)?{allowedMockupStyleIds:body.allowedMockupStyleIds as number[]}:{}),actorId:body.actorId,reason:body.reason,idempotencyKey:key});if(!item)throw new DomainError("NOT_FOUND","Design asset awaiting review was not found");sendJson(response,200,{data:item});return;}
      if(method==="GET"&&contentListMatch?.[1]&&contentReviews){sendJson(response,200,{data:await contentReviews.list(decodeURIComponent(contentListMatch[1]))});return;}
      const contentRevisionMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/product-contents\/([^/]+)\/revisions$/);
      if(method==="POST"&&contentRevisionMatch?.[1]&&contentRevisionMatch[2]&&contentReviews){const body=await readJson(request);if(typeof body.actorId!=="string"||!body.actorId.trim()||!body.contentData||typeof body.contentData!=="object"||Array.isArray(body.contentData))throw new DomainError("INVALID_INPUT","actorId and contentData are required");const item=await contentReviews.createRevision({workspaceId:decodeURIComponent(contentRevisionMatch[1]),productContentId:decodeURIComponent(contentRevisionMatch[2]),contentData:body.contentData as Record<string,unknown>,actorId:body.actorId.trim()});if(!item)throw new DomainError("NOT_FOUND","Product content was not found");sendJson(response,201,{data:item});return;}
      const contentApproveMatch=pathname.match(/^\/api\/workspaces\/([^/]+)\/product-content-revisions\/([^/]+)\/approve$/);
      if(method==="POST"&&contentApproveMatch?.[1]&&contentApproveMatch[2]&&contentReviews){const body=await readJson(request);const keyValue=request.headers["idempotency-key"];const key=Array.isArray(keyValue)?keyValue[0]:keyValue;if(!key||!/^[A-Za-z0-9._:-]{1,128}$/.test(key)||typeof body.actorId!=="string"||!body.actorId.trim())throw new DomainError("INVALID_INPUT","actorId and valid Idempotency-Key are required");const item=await contentReviews.approve({workspaceId:decodeURIComponent(contentApproveMatch[1]),revisionId:decodeURIComponent(contentApproveMatch[2]),actorId:body.actorId.trim(),idempotencyKey:key});if(!item)throw new DomainError("NOT_FOUND","Content revision was not found");sendJson(response,200,{data:item});return;}

      sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Route was not found" } });
    } catch (error) {
      if (error instanceof DomainError) {
        const status = error.code === "NOT_FOUND" ? 404
          : error.code === "INVALID_REVISION_STATE" || error.code === "CANDIDATE_INELIGIBLE" || error.code === "CANDIDATE_ALREADY_DECIDED" || error.code === "IDEMPOTENCY_CONFLICT" || error.code === "AUTHORITATIVE_PRICE_MISMATCH" || error.code === "CONTENT_REVISION_SUPERSEDED" || error.code === "ORDER_NOT_ACTIONABLE" || error.code === "PUBLICATION_NOT_FAILED" || error.code === "MOCKUP_NOT_FAILED" || error.code === "DESIGN_ASSET_LOCKED" || error.code === "DESIGN_GUIDELINE_MISSING" || error.code === "DESIGN_RESOLUTION_TOO_LOW" || error.code === "DESIGN_OVERRIDE_NOT_ALLOWED" || error.code === "DESIGN_DIMENSIONS_MISSING" || error.code === "DESIGN_MOCKUP_STYLES_MISSING" || error.code === "DESIGN_MOCKUP_STYLE_MISMATCH" || error.code === "INTEGRATION_HAS_ACTIVE_WORK" || error.code === "WEBHOOK_PUBLIC_HTTPS_REQUIRED" || error.code === "PRIVACY_REQUEST_NOT_ACTIONABLE" || error.code === "ALERT_DELIVERY_NOT_FAILED" || error.code === "SHOPIFY_REAUTH_REQUIRED" || error.code === "SHOPIFY_ACCOUNT_ALREADY_CONNECTED" ? 409
          : error.code === "PAYLOAD_TOO_LARGE" ? 413 : error.code === "DESIGN_UPLOAD_QUOTA_EXCEEDED" ? 409 : error.code === "SERVICE_UNAVAILABLE" ? 503 : error.code === "PROVIDER_VALIDATION_FAILED" ? 422 : 400;
        sendJson(response, status, { error: { code: error.code, message: error.message } });
        return;
      }
      if(error&&typeof error==='object'&&'authKind'in error&&error.authKind==='ADMIN'){
        response.setHeader('WWW-Authenticate','Bearer realm="storzy-admin"');
        sendJson(response,401,{error:{code:'ADMIN_AUTH_REQUIRED',message:error instanceof Error?error.message:'관리자 인증이 필요합니다.'}});return;
      }
      if(error&&typeof error==='object'&&'authKind'in error&&error.authKind==='ADMIN_CSRF'){sendJson(response,403,{error:{code:'ADMIN_CSRF_REJECTED',message:error instanceof Error?error.message:'관리자 요청 출처가 일치하지 않습니다.'}});return;}
      if(error&&typeof error==='object'&&'status'in error&&(error.status===400||error.status===401)){sendJson(response,error.status,{error:{code:error.status===401?'INVALID_WEBHOOK_SIGNATURE':'INVALID_WEBHOOK',message:error instanceof Error?error.message:'Invalid webhook request'}});return;}
      requestLogger.error("http.request.failed", { error });
      sendJson(response, 500, { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
    }
  };
}
