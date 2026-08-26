import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const sql=readFileSync(new URL("../migrations/074_privacy_alert_expired_leases.sql",import.meta.url),"utf8");
describe("privacy alert expired lease indexes",()=>{it("indexes running request and maintenance deliveries by lease expiry",()=>{expect(sql).toContain("privacy_alert_deliveries(lease_expires_at)");expect(sql).toContain("privacy_maintenance_alert_deliveries(lease_expires_at)");expect(sql.match(/WHERE status='RUNNING'/g)).toHaveLength(2);});});
