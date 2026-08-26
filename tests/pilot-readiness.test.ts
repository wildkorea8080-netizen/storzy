import {describe,expect,it} from "vitest";
import {buildPilotReadiness,orderAutomationApproval} from "../src/integrations/pilot-readiness.js";
import type {IntegrationStatus} from "../src/integrations/status.js";
import type {WebhookReadiness} from "../src/integrations/webhook-readiness.js";

const integrations=(connected:boolean):IntegrationStatus=>({
  shopify:{provider:"SHOPIFY",status:connected?"CONNECTED":"NOT_CONFIGURED",accountLabel:null,capabilities:{},missing:[],source:"NONE"},
  printful:{provider:"PRINTFUL",status:connected?"CONNECTED":"NOT_CONFIGURED",accountLabel:null,capabilities:{},missing:[],source:"NONE"},
  tokenMetrics:{reauthRequired:0,expiringSoon:0,expired:0},
});
const webhooks=(ready:boolean):WebhookReadiness=>({
  shopify:{provider:"SHOPIFY",ready,endpoint:null,checks:{publicUrl:ready,signatureVerification:ready,workspaceTarget:ready},missing:[]},
  printful:{provider:"PRINTFUL",ready,endpoint:null,checks:{publicUrl:ready,signatureVerification:ready,workspaceTarget:ready},missing:[]},
});

describe("E2E 파일럿 준비 판정",()=>{
  it("완료 수와 가장 먼저 남은 작업을 반환한다",()=>{
    const result=buildPilotReadiness({integrations:integrations(false),webhooks:webhooks(false),counts:{brand:{APPROVED:1},publication:{SUCCEEDED:1},orders:{SUBMITTED:1}}});
    expect(result.completed).toBe(3);
    expect(result.total).toBe(7);
    expect(result.ready).toBe(false);
    expect(result.nextStep?.key).toBe("SHOPIFY_CONNECTED");
  });

  it("모든 필수 조건을 충족하면 실행 준비 완료로 판정한다",()=>{
    const result=buildPilotReadiness({integrations:integrations(true),webhooks:webhooks(true),counts:{brand:{APPROVED:1},publication:{SUCCEEDED:1},orders:{SUBMITTED:1}},automationEnabled:true});
    expect(result.ready).toBe(true);
    expect(result.completed).toBe(7);
    expect(result.nextStep).toBeNull();
  });
  it("모든 연동 검증 후에도 운영 승인 전에는 준비 완료로 보지 않는다",()=>{
    const result=buildPilotReadiness({integrations:integrations(true),webhooks:webhooks(true),counts:{brand:{APPROVED:1},publication:{SUCCEEDED:1},orders:{SUBMITTED:1}}});
    expect(result.ready).toBe(false);
    expect(result.completed).toBe(6);
    expect(result.nextStep?.key).toBe("ORDER_AUTOMATION_APPROVED");
    expect(orderAutomationApproval(result)).toEqual({canEnable:true,blockers:[]});
  });
  it("자동화 승인 전에 해결해야 할 조건을 순서대로 반환한다",()=>{
    const readiness=buildPilotReadiness({integrations:integrations(false),webhooks:webhooks(false),counts:{brand:{APPROVED:1},publication:{SUCCEEDED:1},orders:{SUBMITTED:1}}});
    expect(orderAutomationApproval(readiness)).toMatchObject({canEnable:false,blockers:[{key:"SHOPIFY_CONNECTED"},{key:"PRINTFUL_CONNECTED"},{key:"WEBHOOKS_READY"}]});
  });
});
