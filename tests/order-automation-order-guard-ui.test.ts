import {describe,expect,it} from "vitest";
import {orderAutomationOrderGuardCss,orderAutomationOrderGuardJs} from "../src/admin/order-automation-order-guard-ui.js";

describe("order exception automation guard UI",()=>{
  it("blocks manual approval while workspace automation is stopped",()=>{
    for(const value of ["/order-automation","MANUAL_APPROVE","approve.disabled","주문 자동화가 중지되어 있습니다.","/admin/integrations"]){
      expect(orderAutomationOrderGuardJs).toContain(value);
    }
    expect(orderAutomationOrderGuardCss).toContain(":disabled");
    expect(()=>new Function(orderAutomationOrderGuardJs)).not.toThrow();
  });
});
