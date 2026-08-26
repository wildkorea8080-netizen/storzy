import type {IntegrationStatus} from "./status.js";
import type {WebhookReadiness} from "./webhook-readiness.js";
export type PilotReadinessStepKey="BRAND_APPROVED"|"SHOPIFY_CONNECTED"|"PRINTFUL_CONNECTED"|"WEBHOOKS_READY"|"SHOPIFY_PRODUCT_PUBLISHED"|"TEST_ORDER_SUBMITTED"|"ORDER_AUTOMATION_APPROVED";
export type PilotReadinessStep=Readonly<{key:PilotReadinessStepKey;label:string;description:string;done:boolean;href:string}>;
type StatusCounts=Readonly<Record<string,number>>;
export type PilotReadinessCounts=Readonly<{brand?:StatusCounts;publication?:StatusCounts;orders?:StatusCounts}>;
export function buildPilotReadiness(input:Readonly<{integrations:IntegrationStatus;webhooks:WebhookReadiness;counts:PilotReadinessCounts;automationEnabled?:boolean}>){
  const steps:readonly PilotReadinessStep[]=[
    {key:"BRAND_APPROVED",label:"브랜드 기준 승인",description:"온보딩 프로필 검수 완료",done:(input.counts.brand?.APPROVED??0)>0,href:"/admin/onboarding"},
    {key:"SHOPIFY_CONNECTED",label:"Shopify 연결",description:"OAuth 및 Admin API 연결",done:input.integrations.shopify.status==="CONNECTED",href:"/admin/integrations"},
    {key:"PRINTFUL_CONNECTED",label:"Printful 연결",description:"토큰 및 Store 범위 확인",done:input.integrations.printful.status==="CONNECTED",href:"/admin/integrations"},
    {key:"WEBHOOKS_READY",label:"Webhook 수신 준비",description:"공개 HTTPS와 서명 검증",done:input.webhooks.shopify.ready&&input.webhooks.printful.ready,href:"/admin/integrations"},
    {key:"SHOPIFY_PRODUCT_PUBLISHED",label:"Shopify 상품 게시",description:"파일럿 상품 1개 이상 게시 성공",done:(input.counts.publication?.SUCCEEDED??0)>0,href:"/admin/store"},
    {key:"TEST_ORDER_SUBMITTED",label:"테스트 주문 제출",description:"정책 검증 후 Printful 전달 확인",done:(input.counts.orders?.SUBMITTED??0)>0,href:"/admin/orders"},
    {key:"ORDER_AUTOMATION_APPROVED",label:"주문 자동화 출시 승인",description:"운영 책임자가 자동 제출 활성화",done:input.automationEnabled===true,href:"/admin/integrations"},
  ];
  const completed=steps.filter(step=>step.done).length;
  return{ready:completed===steps.length,completed,total:steps.length,nextStep:steps.find(step=>!step.done)??null,steps};
}
export function orderAutomationApproval(readiness:ReturnType<typeof buildPilotReadiness>){
  const blockers=readiness.steps.filter(step=>step.key!=="ORDER_AUTOMATION_APPROVED"&&!step.done).map(step=>({key:step.key,label:step.label,href:step.href}));
  return{canEnable:blockers.length===0,blockers};
}
