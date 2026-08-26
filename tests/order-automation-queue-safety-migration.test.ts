import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
describe("order automation queue safety migration",()=>{
  const sql=readFileSync(new URL("../migrations/058_hold_queued_orders_when_automation_stops.sql",import.meta.url),"utf8");
  it("holds every not-yet-confirmed queue phase when automation stops",()=>{for(const phase of ["PENDING_DRAFT","WAITING_COST","READY_CONFIRM"]){expect(sql).toContain(phase)}expect(sql).toContain("ORDER_AUTOMATION_SUSPENDED")});
  it("guards future inserts and retries while stopped",()=>{expect(sql).toContain("BEFORE INSERT OR UPDATE OF status");expect(sql).toContain("c.enabled = true");expect(sql).toContain("NEW.status := 'HELD'")});
});
