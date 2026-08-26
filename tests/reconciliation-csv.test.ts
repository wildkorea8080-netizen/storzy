import{describe,expect,it}from"vitest";
import{reconciliationScanCsv}from"../src/orders/reconciliation-csv.js";

describe("reconciliation scan CSV",()=>{
  it("adds a UTF-8 BOM, quotes fields, and blocks spreadsheet formulas",()=>{
    const csv=reconciliationScanCsv([{shopify_order_id:"=IMPORTXML(1)",issue_type:"MISSING_LOCAL_ORDER",local_value:'a"b',remote_value:"PRESENT",remote_updated_at:new Date("2026-08-12T00:00:00Z"),created_at:new Date("2026-08-12T00:01:00Z")}]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\"'=IMPORTXML(1)\"");
    expect(csv).toContain('"a""b"');
    expect(csv).toContain("2026-08-12T00:00:00.000Z");
  });
});
