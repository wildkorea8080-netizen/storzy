import{describe,expect,it,vi}from"vitest";
import{OrderReconciliationService}from"../src/orders/shopify-reconciliation.js";

describe("reconciliation scan history",()=>{
  it("returns bounded scans for only the requested workspace",async()=>{
    const query=vi.fn().mockResolvedValue({rows:[{id:"scan-1",remote_order_count:10,issue_count:2,breakdown:{MISSING_LOCAL_ORDER:1,CANCELLATION_MISMATCH:1,FINANCIAL_STATUS_MISMATCH:0}}]});
    const service=new OrderReconciliationService({query}as never);
    await expect(service.listScans("workspace-1",500,"Order/123")).resolves.toMatchObject([{id:"scan-1",issue_count:2,breakdown:{MISSING_LOCAL_ORDER:1,CANCELLATION_MISMATCH:1}}]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE s.workspace_id=$1"),["workspace-1",100,"Order/123"]);
    expect(String(query.mock.calls[0]?.[0])).toContain("ORDER BY s.created_at DESC");
    expect(String(query.mock.calls[0]?.[0])).toContain("jsonb_build_object('MISSING_LOCAL_ORDER'");
    expect(String(query.mock.calls[0]?.[0])).toContain("'reason',e.reason");
    expect(String(query.mock.calls[0]?.[0])).toContain("EXISTS(SELECT 1 FROM order_reconciliation_scan_issue_snapshots");
  });
  it("returns immutable issue snapshots inside the workspace boundary",async()=>{
    const query=vi.fn().mockResolvedValue({rows:[{id:"snapshot-1",shopify_order_id:"gid://shopify/Order/1",issue_type:"MISSING_LOCAL_ORDER"}]});
    const service=new OrderReconciliationService({query}as never);
    await expect(service.listScanIssues("workspace-1","scan-1",500,-3,"MISSING_LOCAL_ORDER","Order/123")).resolves.toMatchObject([{issue_type:"MISSING_LOCAL_ORDER"}]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("order_reconciliation_scan_issue_snapshots"),["workspace-1","scan-1",100,0,"MISSING_LOCAL_ORDER","Order/123"]);
    expect(String(query.mock.calls[0]?.[0])).toContain("workspace_id=$1 AND scan_id=$2");
    expect(String(query.mock.calls[0]?.[0])).toContain("LIMIT $3 OFFSET $4");
    expect(String(query.mock.calls[0]?.[0])).toContain("issue_type=$5");
    expect(String(query.mock.calls[0]?.[0])).toContain("position(lower($6) in lower(shopify_order_id))>0");
  });
  it("returns bounded export audits inside the workspace and scan boundary",async()=>{
    const query=vi.fn().mockResolvedValue({rows:[{actor_id:"operator",reason:"장애 검토",issue_count:2}]});
    const service=new OrderReconciliationService({query}as never);
    await expect(service.listScanExports("workspace-1","scan-1",500)).resolves.toMatchObject([{actor_id:"operator",reason:"장애 검토"}]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("workspace_id=$1 AND scan_id=$2"),["workspace-1","scan-1",100]);
    expect(String(query.mock.calls[0]?.[0])).toContain("ORDER BY created_at DESC");
  });
  it("exports only an existing scan and records the actor transactionally",async()=>{
    const query=vi.fn(async(sql:string)=>sql==="BEGIN"||sql==="COMMIT"?{rows:[]}:sql.startsWith("SELECT id,created_at")?{rows:[{id:"scan-1",created_at:new Date()}]}:sql.includes("scan_issue_snapshots")?{rows:[{shopify_order_id:"order-1"}]}:{rows:[]}),client={query,release:vi.fn()};
    const service=new OrderReconciliationService({connect:vi.fn(async()=>client)}as never);
    await expect(service.scanExportWithReason("workspace-1","scan-1","operator","장애 검토 자료")).resolves.toMatchObject({scan:{id:"scan-1"},issues:[{shopify_order_id:"order-1"}]});
    expect(query).toHaveBeenCalledWith(expect.stringContaining("order_reconciliation_scan_export_actions"),expect.arrayContaining([expect.any(String),"scan-1","workspace-1","operator","장애 검토 자료",1]));
    expect(query).toHaveBeenCalledWith("COMMIT");
  });
});
