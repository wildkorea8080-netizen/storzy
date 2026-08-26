import{describe,expect,it}from"vitest";
import{readFileSync}from"node:fs";

describe("automatic privacy reconciliation on Shopify connect",()=>{
  it("keeps connection and privacy assignment in the same transaction",()=>{const source=readFileSync(new URL("../src/integrations/connection-repository.ts",import.meta.url),"utf8"),begin=source.indexOf('await client.query("BEGIN")'),requests=source.indexOf("Automatically matched during Shopify connection"),receipts=source.indexOf("UPDATE shopify_privacy_webhook_receipts SET workspace_id"),commit=source.indexOf('await client.query("COMMIT")',begin);expect(begin).toBeGreaterThan(-1);expect(requests).toBeGreaterThan(begin);expect(receipts).toBeGreaterThan(requests);expect(commit).toBeGreaterThan(receipts);expect(source.slice(begin,commit)).toContain('input.provider==="SHOPIFY"');expect(source.slice(begin,commit)).toContain("workspace_id IS NULL");expect(source.slice(begin,commit)).toContain("lower(shop_domain)=$2")});
});
