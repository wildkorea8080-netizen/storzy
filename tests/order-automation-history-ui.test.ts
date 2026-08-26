import {describe,expect,it} from "vitest";
import {orderAutomationHistoryJs} from "../src/admin/order-automation-history-ui.js";
describe("order automation audit history UI",()=>{it("renders workspace-scoped enable and disable actions",()=>{for(const value of ["/order-automation","body.data.history","승인 및 자동중지 이력","actorId","reason","createdAt"]){expect(orderAutomationHistoryJs).toContain(value)}expect(()=>new Function(orderAutomationHistoryJs)).not.toThrow()})});
