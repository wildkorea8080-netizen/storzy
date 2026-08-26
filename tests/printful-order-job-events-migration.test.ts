import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const sql=readFileSync(new URL("../migrations/061_printful_order_job_events.sql",import.meta.url),"utf8");
describe("Printful order job event migration",()=>{it("stores workspace-scoped confirmation and hold history",()=>{for(const value of ["printful_order_job_events","workspace_id","commerce_order_id","CONFIRMATION_RECOVERED","CONFIRMED","HELD","printful_order_job_event_history"]){expect(sql).toContain(value)}})});
