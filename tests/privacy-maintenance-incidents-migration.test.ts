import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const sql=readFileSync(new URL("../migrations/072_privacy_maintenance_incidents.sql",import.meta.url),"utf8");
describe("privacy maintenance incidents migration",()=>{it("deduplicates incident types and indexes open incidents",()=>{expect(sql).toContain("incident_type text NOT NULL UNIQUE");expect(sql).toContain("SLA_SCAN_FAILED");expect(sql).toContain("UNINSTALL_RETENTION_FAILED");expect(sql).toContain("WHERE status='OPEN'");});});
