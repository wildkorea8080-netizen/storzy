import {describe,expect,it} from "vitest";
import {privacyAlertsCss,privacyAlertsJs} from "../src/admin/privacy-alerts-ui.js";

describe("privacy alerts UI",()=>{
  it("loads active alerts and records operator acknowledgement",()=>{
    expect(privacyAlertsJs).toContain("/api/admin/privacy-alerts?");
    expect(privacyAlertsJs).toContain("/acknowledge");
    expect(privacyAlertsJs).toContain("actorId:'admin-ui'");
    expect(privacyAlertsJs).toContain("workspaceId:workspace()");
    expect(privacyAlertsJs).toContain("/retry-delivery");
    expect(privacyAlertsJs).toContain("delivery_last_error");
    expect(privacyAlertsJs).toContain("prompt(");
    expect(privacyAlertsCss).toContain(".privacy-alert.OVERDUE");
    expect(()=>new Function(privacyAlertsJs)).not.toThrow();
  });
});
