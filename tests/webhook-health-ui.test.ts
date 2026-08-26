import {describe,expect,it} from "vitest";
import {webhookHealthCss,webhookHealthJs} from "../src/admin/webhook-health-ui.js";

describe("webhook health UI",()=>{
  it("shows receipt counts without secret fields",()=>{
    expect(webhookHealthJs).toContain("/integrations/webhook-health");
    expect(webhookHealthJs).toContain("최근 24시간");
    expect(webhookHealthJs).toContain("공급사 재전송");
    expect(webhookHealthJs).not.toContain("secret");
    expect(webhookHealthCss).toContain(".webhook-health.STALE");
    expect(()=>new Function(webhookHealthJs)).not.toThrow();
  });
});
