import{readFileSync}from"node:fs";
import{describe,expect,it}from"vitest";
const sql=readFileSync(new URL("../migrations/069_shopify_app_uninstall_receipts.sql",import.meta.url),"utf8");
describe("Shopify uninstall receipt migration",()=>{it("deduplicates Shopify uninstall deliveries",()=>{expect(sql).toContain("webhook_id text NOT NULL UNIQUE");expect(sql).toContain("workspace_matched boolean NOT NULL")})});
