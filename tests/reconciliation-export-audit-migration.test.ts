import{readFileSync}from"node:fs";
import{describe,expect,it}from"vitest";

describe("reconciliation export audit migration",()=>{
  it("stores workspace-scoped export actions",()=>{
    const sql=readFileSync(new URL("../migrations/049_reconciliation_scan_export_audit.sql",import.meta.url),"utf8");
    expect(sql).toContain("CREATE TABLE order_reconciliation_scan_export_actions");
    expect(sql).toContain("workspace_id uuid NOT NULL");
    expect(sql).toContain("actor_id text NOT NULL");
    expect(sql).toContain("issue_count integer NOT NULL");
  });
});
