import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const sql=readFileSync(new URL("../migrations/073_privacy_maintenance_alert_deliveries.sql",import.meta.url),"utf8");
describe("privacy maintenance alert deliveries migration",()=>{it("deduplicates an incident episode and supports leased retries",()=>{expect(sql).toContain("UNIQUE(incident_id,incident_opened_at)");expect(sql).toContain("lease_expires_at");expect(sql).toContain("WHERE status IN('PENDING','FAILED')");});});
