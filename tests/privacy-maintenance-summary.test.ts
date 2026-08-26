import{describe,expect,it,vi}from"vitest";
import{PrivacyRequestService}from"../src/privacy/request-service.js";

describe("privacy maintenance summary",()=>{
  it("reports anonymization counts and a healthy recent scheduler run",async()=>{
    const opened=new Date("2026-08-20T09:00:00.000Z"),now=new Date("2026-08-20T12:00:00.000Z"),query=vi.fn().mockResolvedValueOnce({rows:[{anonymized_24h:"3",total_anonymized:"8",pending_expired:"0",last_anonymized_at:new Date("2026-08-20T10:00:00.000Z"),scheduler_status:"SUCCEEDED",scheduler_heartbeat_at:new Date("2026-08-20T11:00:00.000Z"),scheduler_error:null}]}).mockResolvedValueOnce({rows:[{id:"incident-1",incident_type:"SLA_SCAN_FAILED",status:"OPEN",last_error:"database unavailable",opened_at:opened,updated_at:opened,delivery_status:"FAILED",delivery_attempts:2,delivery_response_status:503,delivery_last_error:"webhook unavailable",delivery_sent_at:null}]});
    await expect(new PrivacyRequestService({query}as never).maintenanceSummary(now)).resolves.toEqual({anonymized24h:3,totalAnonymized:8,pendingExpired:0,lastAnonymizedAt:"2026-08-20T10:00:00.000Z",scheduler:{state:"HEALTHY",status:"SUCCEEDED",lastRunAt:"2026-08-20T11:00:00.000Z",lastError:null},incidents:[{id:"incident-1",type:"SLA_SCAN_FAILED",status:"OPEN",lastError:"database unavailable",openedAt:opened.toISOString(),updatedAt:opened.toISOString(),delivery:{status:"FAILED",attempts:2,responseStatus:503,lastError:"webhook unavailable",sentAt:null}}]});
    expect(String(query.mock.calls[0]?.[0])).toContain("anonymized_at");expect(String(query.mock.calls[0]?.[0])).toContain("role='privacy-sla-scan'");expect(query.mock.calls[0]?.[1]).toEqual([now]);
  });

  it("marks failed, stale, and unseen scheduler states",async()=>{
    const now=new Date("2026-08-20T12:00:00.000Z"),rows=[
      {scheduler_status:"FAILED",scheduler_heartbeat_at:new Date("2026-08-20T11:59:00.000Z"),scheduler_error:"database unavailable"},
      {scheduler_status:"SUCCEEDED",scheduler_heartbeat_at:new Date("2026-08-20T08:00:00.000Z"),scheduler_error:null},
      {scheduler_status:null,scheduler_heartbeat_at:null,scheduler_error:null},
    ];
    for(const [index,state]of["FAILED","STALE","NEVER_SEEN"].entries()){const query=vi.fn().mockResolvedValueOnce({rows:[rows[index]]}).mockResolvedValue({rows:[]});await expect(new PrivacyRequestService({query}as never).maintenanceSummary(now)).resolves.toMatchObject({scheduler:{state},incidents:[]});}
  });
});
