import{describe,expect,it,vi}from"vitest";
import{PrivacyMaintenanceIncidentStore}from"../src/privacy/maintenance-incident-store.js";

describe("privacy maintenance incident store",()=>{
  it("opens or refreshes one incident per failure type with a bounded error",async()=>{
    const query=vi.fn().mockResolvedValue({rows:[{id:"incident-1",status:"OPEN"}]}),store=new PrivacyMaintenanceIncidentStore({query}as never),secret="token-secret";
    await expect(store.synchronize("SLA_SCAN_FAILED",new Error("postgresql://user:pass@db/storzy token="+secret+"\n"+"x".repeat(1200)))).resolves.toMatchObject({status:"OPEN"});
    const[sql,params]=query.mock.calls[0]!;expect(sql).toContain("ON CONFLICT(incident_type) DO UPDATE");expect(sql).toContain("resolved_at=NULL");expect(params[0]).toBe("SLA_SCAN_FAILED");expect(String(params[1])).not.toContain("\n");expect(String(params[1])).not.toContain("user:pass");expect(String(params[1])).not.toContain(secret);expect(String(params[1]).length).toBeLessThanOrEqual(1000);
  });
  it("resolves only an open incident after recovery",async()=>{const query=vi.fn().mockResolvedValue({rows:[{id:"incident-1",status:"RESOLVED"}]}),store=new PrivacyMaintenanceIncidentStore({query}as never);await expect(store.synchronize("UNINSTALL_RETENTION_FAILED",null)).resolves.toMatchObject({status:"RESOLVED"});expect(String(query.mock.calls[0]?.[0])).toContain("status='OPEN'");});
});
