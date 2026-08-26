import{describe,expect,it,vi}from"vitest";
import{SHOPIFY_UNINSTALL_RECEIPT_RETENTION_DAYS,ShopifyUninstallReceiptRetentionService}from"../src/privacy/uninstall-receipt-retention.js";

describe("Shopify uninstall receipt retention",()=>{
  it("irreversibly anonymizes identifiers after the routing window",async()=>{
    const query=vi.fn().mockResolvedValue({rows:[{id:"receipt-1"}],rowCount:1}),service=new ShopifyUninstallReceiptRetentionService({query}as never),now=new Date("2026-08-20T00:00:00.000Z");
    await expect(service.anonymizeExpired(now)).resolves.toEqual({anonymized:1,retentionDays:7});
    const [sql,params]=query.mock.calls[0]!;
    expect(sql).toContain("webhook_id='expired:'||id::text");
    expect(sql).toContain("connection_id=NULL");
    expect(sql).toContain("workspace_id=NULL");
    expect(sql).toContain("shop_domain='expired.invalid'");
    expect(sql).toContain("make_interval(days=>$2)");
    expect(sql).toContain("NOT IN('expired.invalid','redacted.invalid')");
    expect(params).toEqual([now,SHOPIFY_UNINSTALL_RECEIPT_RETENTION_DAYS]);
  });

  it("reports zero without relying on returned rows",async()=>{
    const service=new ShopifyUninstallReceiptRetentionService({query:vi.fn().mockResolvedValue({rows:[],rowCount:0})}as never);
    await expect(service.anonymizeExpired()).resolves.toEqual({anonymized:0,retentionDays:7});
  });
});
