import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const sql=readFileSync(new URL("../migrations/075_privacy_maintenance_delivery_actions.sql",import.meta.url),"utf8");
describe("privacy maintenance delivery action audit",()=>{it("records requeue actor, reason, and status transition",()=>{for(const value of["delivery_id uuid NOT NULL","action text NOT NULL CHECK(action='REQUEUE')","actor_id text NOT NULL","reason text NOT NULL","before_status text NOT NULL","after_status text NOT NULL"])expect(sql).toContain(value);});});
