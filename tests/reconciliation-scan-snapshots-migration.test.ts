import{readFileSync}from"node:fs";
import{describe,expect,it}from"vitest";

describe("reconciliation scan issue snapshots migration",()=>{
  it("preserves issue evidence whenever an issue enters a scan",()=>{
    const sql=readFileSync(new URL("../migrations/048_reconciliation_scan_issue_snapshots.sql",import.meta.url),"utf8");
    expect(sql).toContain("CREATE TABLE order_reconciliation_scan_issue_snapshots");
    expect(sql).toContain("UNIQUE(scan_id,shopify_order_id,issue_type)");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION increment_reconciliation_scan_breakdown()");
    expect(sql).toContain("ON CONFLICT(scan_id,shopify_order_id,issue_type) DO NOTHING");
  });
});
