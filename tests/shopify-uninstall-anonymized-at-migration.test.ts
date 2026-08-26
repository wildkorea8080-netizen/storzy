import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const sql=readFileSync(new URL("../migrations/071_shopify_uninstall_anonymized_at.sql",import.meta.url),"utf8");
describe("Shopify uninstall anonymization timestamp migration",()=>{it("records and indexes the maintenance timestamp",()=>{expect(sql).toContain("ADD COLUMN anonymized_at timestamptz");expect(sql).toContain("WHERE anonymized_at IS NOT NULL");});});
