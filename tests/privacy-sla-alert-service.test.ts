import {describe,expect,it,vi} from "vitest";
import {PrivacySlaAlertService} from "../src/privacy/sla-alert-service.js";

describe("privacy SLA alert scan",()=>{
  it("lists active alerts within the requested workspace",async()=>{const query=vi.fn().mockResolvedValue({rows:[{id:"alert-1",level:"OVERDUE",status:"OPEN"}]});const service=new PrivacySlaAlertService({query} as never);await expect(service.list({workspaceId:"workspace-1",limit:25})).resolves.toHaveLength(1);expect(String(query.mock.calls[0]?.[0])).toContain("a.workspace_id=$1");expect(String(query.mock.calls[0]?.[0])).toContain("a.status IN('OPEN','ACKNOWLEDGED')");expect(query.mock.calls[0]?.[1]).toEqual(["workspace-1",25]);});

  it("acknowledges only an open alert inside the workspace boundary",async()=>{const query=vi.fn().mockResolvedValue({rows:[{id:"alert-1",status:"ACKNOWLEDGED",acknowledged_by:"operator"}]});const service=new PrivacySlaAlertService({query} as never);await expect(service.acknowledge({id:"alert-1",actorId:" operator ",workspaceId:"workspace-1"})).resolves.toMatchObject({status:"ACKNOWLEDGED"});expect(String(query.mock.calls[0]?.[0])).toContain("workspace_id=$3");expect(String(query.mock.calls[0]?.[0])).toContain("status='OPEN'");expect(query.mock.calls[0]?.[1]).toEqual(["alert-1","operator","workspace-1"]);});

  it("requeues only a failed delivery, resets its retry budget, and writes an audit action",async()=>{const calls:string[]=[],query=vi.fn(async(sql:string)=>{calls.push(sql);if(sql.startsWith("SELECT d.id"))return{rows:[{id:"delivery-1",status:"FAILED",attempts:6}]};if(sql.startsWith("UPDATE privacy_alert_deliveries"))return{rows:[{id:"delivery-1",alert_id:"alert-1",status:"PENDING",attempts:0}]};return{rows:[]};}),client={query,release:vi.fn()},service=new PrivacySlaAlertService({connect:vi.fn(async()=>client)} as never);await expect(service.requeueDelivery({alertId:"alert-1",actorId:"operator",reason:"운영 채널 복구 후 재시도",workspaceId:"workspace-1"})).resolves.toMatchObject({status:"PENDING",attempts:0});expect(calls.some(sql=>sql.includes("status='PENDING',attempts=0"))).toBe(true);expect(calls.some(sql=>sql.includes("before_attempts"))).toBe(true);expect(query).toHaveBeenCalledWith("COMMIT");});

  it("rolls back when a non-failed delivery is requeued",async()=>{const query=vi.fn(async(sql:string)=>sql.startsWith("SELECT d.id")?{rows:[{id:"delivery-1",status:"SENT"}]}:{rows:[]}),client={query,release:vi.fn()},service=new PrivacySlaAlertService({connect:vi.fn(async()=>client)} as never);await expect(service.requeueDelivery({alertId:"alert-1",actorId:"operator",reason:"retry"})).rejects.toMatchObject({code:"ALERT_DELIVERY_NOT_FAILED"});expect(query).toHaveBeenCalledWith("ROLLBACK");});

  it("creates idempotent alert levels and resolves stale alerts in one transaction",async()=>{
    const calls:Array<[string,unknown[]|undefined]>=[],query=vi.fn(async(sql:string,params?:unknown[])=>{calls.push([sql,params]);if(sql.startsWith("INSERT INTO privacy_sla_alerts")){const level=params?.[1];return{rows:level==="DUE_SOON"?[{id:"alert-1"}]:[],rowCount:level==="DUE_SOON"?1:0};}if(sql.startsWith("UPDATE privacy_sla_alerts"))return{rows:[],rowCount:2};return{rows:[],rowCount:null};}),client={query,release:vi.fn()},service=new PrivacySlaAlertService({connect:vi.fn(async()=>client)} as never),now=new Date("2026-08-10T00:00:00.000Z");
    await expect(service.scan(now)).resolves.toEqual({created:{DUE_SOON:1,OVERDUE:0,FAILED:0},totalCreated:1,resolved:2,scannedAt:now.toISOString()});
    expect(calls.filter(([sql])=>sql.startsWith("INSERT INTO privacy_sla_alerts"))).toHaveLength(3);
    expect(calls.some(([sql])=>sql.includes("ON CONFLICT(request_id,level) DO NOTHING"))).toBe(true);
    expect(query).toHaveBeenCalledWith("COMMIT");
  });

  it("rolls back when alert persistence fails",async()=>{const query=vi.fn(async(sql:string)=>{if(sql.startsWith("INSERT INTO privacy_sla_alerts"))throw new Error("database unavailable");return{rows:[],rowCount:null};}),client={query,release:vi.fn()},service=new PrivacySlaAlertService({connect:vi.fn(async()=>client)} as never);await expect(service.scan()).rejects.toThrow("database unavailable");expect(query).toHaveBeenCalledWith("ROLLBACK");expect(client.release).toHaveBeenCalled();});
});
