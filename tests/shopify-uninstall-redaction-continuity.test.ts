import{readFileSync}from"node:fs";
import{describe,expect,it}from"vitest";
const sql=readFileSync(new URL("../migrations/070_redact_shopify_uninstall_receipts.sql",import.meta.url),"utf8");
describe("Shopify uninstall redaction continuity",()=>{it("anonymizes the uninstall routing receipt when shop redaction completes",()=>{expect(sql).toContain("UPDATE shopify_app_uninstall_receipts");expect(sql).toContain("workspace_id=NULL");expect(sql).toContain("connection_id=NULL");expect(sql).toContain("webhook_id='redacted:'");expect(sql).toContain("shop_domain='redacted.invalid'")})});
