import{describe,expect,it,vi}from"vitest";
import{PrivacyMaintenanceRunner}from"../src/privacy/maintenance-runner.js";

const logger=()=>({debug:vi.fn(),info:vi.fn(),warn:vi.fn(),error:vi.fn(),child:vi.fn()});

describe("privacy maintenance runner",()=>{
  it("runs and reports both independent maintenance stages",async()=>{
    const log=logger(),sla={scan:vi.fn().mockResolvedValue({created:2})},retention={anonymizeExpired:vi.fn().mockResolvedValue({anonymized:3})};
    await expect(new PrivacyMaintenanceRunner(sla,retention,log).run()).resolves.toEqual({ok:true,slaCompleted:true,retentionCompleted:true,incidentSyncCompleted:true});
    expect(log.info).toHaveBeenCalledWith("privacy-sla.scan.completed",{created:2});
    expect(log.info).toHaveBeenCalledWith("shopify-uninstall-retention.completed",{anonymized:3});
  });

  it("continues retention when the SLA scan fails",async()=>{
    const failure=new Error("sla unavailable"),log=logger(),sla={scan:vi.fn().mockRejectedValue(failure)},retention={anonymizeExpired:vi.fn().mockResolvedValue({anonymized:1})};
    await expect(new PrivacyMaintenanceRunner(sla,retention,log).run()).resolves.toEqual({ok:false,slaCompleted:false,retentionCompleted:true,incidentSyncCompleted:true});
    expect(retention.anonymizeExpired).toHaveBeenCalledOnce();
    expect(log.error).toHaveBeenCalledWith("privacy-sla.scan.failed",{error:failure});
  });

  it("preserves the SLA result and exposes a distinct retention failure",async()=>{
    const failure=new Error("retention unavailable"),log=logger(),sla={scan:vi.fn().mockResolvedValue({created:0})},retention={anonymizeExpired:vi.fn().mockRejectedValue(failure)};
    await expect(new PrivacyMaintenanceRunner(sla,retention,log).run()).resolves.toEqual({ok:false,slaCompleted:true,retentionCompleted:false,incidentSyncCompleted:true});
    expect(log.error).toHaveBeenCalledWith("shopify-uninstall-retention.failed",{error:failure});
    expect(log.error).not.toHaveBeenCalledWith("privacy-sla.scan.failed",expect.anything());
  });

  it("opens failed stage incidents and resolves recovered stages",async()=>{
    const failure=new Error("sla unavailable"),log=logger(),sla={scan:vi.fn().mockRejectedValue(failure)},retention={anonymizeExpired:vi.fn().mockResolvedValue({anonymized:0})},incidents={synchronize:vi.fn().mockResolvedValue(null)};
    await new PrivacyMaintenanceRunner(sla,retention,log,incidents as never).run();
    expect(incidents.synchronize).toHaveBeenNthCalledWith(1,"SLA_SCAN_FAILED",failure);
    expect(incidents.synchronize).toHaveBeenNthCalledWith(2,"UNINSTALL_RETENTION_FAILED",null);
  });

  it("fails the scheduler result when incident persistence fails",async()=>{
    const log=logger(),incidents={synchronize:vi.fn().mockRejectedValue(new Error("ledger unavailable"))},runner=new PrivacyMaintenanceRunner({scan:vi.fn().mockResolvedValue({})},{anonymizeExpired:vi.fn().mockResolvedValue({})},log,incidents as never);
    await expect(runner.run()).resolves.toMatchObject({ok:false,slaCompleted:true,retentionCompleted:true,incidentSyncCompleted:false});
    expect(log.error).toHaveBeenCalledWith("privacy-maintenance-incident.sync.failed",expect.objectContaining({incidentType:"SLA_SCAN_FAILED"}));
  });
});
