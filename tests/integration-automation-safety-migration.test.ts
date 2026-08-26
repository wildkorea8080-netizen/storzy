import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

describe("integration loss order automation safety",()=>{
  const sql=readFileSync(new URL("../migrations/057_suspend_order_automation_on_integration_loss.sql",import.meta.url),"utf8");
  it("suspends automation for disconnect and reauthentication transitions",()=>{
    expect(sql).toContain("OLD.status = 'CONNECTED'");
    expect(sql).toContain("NEW.status IN ('DISCONNECTED', 'REAUTH_REQUIRED')");
    expect(sql).toContain("SET enabled = false");
  });
  it("records a disable audit only when an enabled control changed",()=>{
    expect(sql).toContain("AND enabled = true");
    expect(sql).toContain("IF FOUND THEN");
    expect(sql).toContain("workspace_order_automation_actions");
  });
});
