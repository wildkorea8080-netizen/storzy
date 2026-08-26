import{readFileSync}from"node:fs";
import{describe,expect,it}from"vitest";

const sql=readFileSync(new URL("../migrations/068_unique_connected_shopify_owner.sql",import.meta.url),"utf8");
describe("unique connected Shopify owner migration",()=>{it("enforces one active workspace owner per normalized Shopify domain",()=>{expect(sql).toContain("CREATE UNIQUE INDEX");expect(sql).toContain("lower(account_label)");expect(sql).toContain("provider='SHOPIFY'");expect(sql).toContain("status='CONNECTED'")})});
