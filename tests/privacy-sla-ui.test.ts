import {describe,expect,it} from "vitest";
import {privacySlaCss,privacySlaJs} from "../src/admin/privacy-sla-ui.js";

describe("privacy SLA UI",()=>{
  it("shows due-soon, overdue, and failed request counts",()=>{
    expect(privacySlaJs).toContain("/api/admin/privacy-requests/summary");
    expect(privacySlaJs).toContain("dueSoon");
    expect(privacySlaJs).toContain("overdue");
    expect(privacySlaJs).toContain("failed");
    expect(privacySlaJs).toContain("Authorization:'Bearer '");
    expect(privacySlaCss).toContain(".sla-card.danger");
    expect(()=>new Function(privacySlaJs)).not.toThrow();
  });
});
