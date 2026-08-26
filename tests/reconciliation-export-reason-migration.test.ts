import{readFileSync}from"node:fs";
import{describe,expect,it}from"vitest";

describe("reconciliation export reason migration",()=>{
  it("requires a bounded audit reason",()=>{
    const sql=readFileSync(new URL("../migrations/050_reconciliation_export_reason.sql",import.meta.url),"utf8");
    expect(sql).toContain("ADD COLUMN reason text NOT NULL");
    expect(sql).toContain("char_length(reason) BETWEEN 1 AND 500");
  });
});
