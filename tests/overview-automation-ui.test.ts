import {describe,expect,it} from "vitest";
import {overviewAutomationCss,overviewAutomationJs} from "../src/admin/overview-automation-ui.js";
describe("overview order automation safety",()=>{it("shows state, blockers and latest audit without mutation",()=>{for(const value of ["/order-automation","approval?.blockers","data.history?.[0]","자동 제출 중지","최근 변경"]){expect(overviewAutomationJs).toContain(value)}expect(overviewAutomationJs).not.toContain("method:'POST'");expect(overviewAutomationCss).toContain(".automation-overview");expect(()=>new Function(overviewAutomationJs)).not.toThrow()})});
