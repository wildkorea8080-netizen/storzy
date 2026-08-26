import{readFileSync}from"node:fs";
import{describe,expect,it}from"vitest";

describe("reconciliation scan breakdown migration",()=>{
  it("stores immutable counts when issues enter a scan",()=>{
    const sql=readFileSync(new URL("../migrations/047_reconciliation_scan_breakdown.sql",import.meta.url),"utf8");
    expect(sql).toContain("missing_local_order_count");
    expect(sql).toContain("AFTER INSERT OR UPDATE OF scan_id");
    expect(sql).toContain("OLD.scan_id IS DISTINCT FROM NEW.scan_id");
    expect(sql).not.toContain("missing_local_order_count=missing_local_order_count-");
  });
});
