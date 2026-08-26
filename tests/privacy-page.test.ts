import {describe,expect,it} from "vitest";
import {privacyCss,privacyHtml,privacyJs} from "../src/admin/privacy-page.js";
describe("privacy operations page",()=>{it("renders a Korean deadline queue without a false completion action",()=>{expect(privacyHtml).toContain("개인정보 요청 처리");expect(privacyJs).toContain("START_REVIEW");expect(privacyJs).toContain("LEGAL_HOLD");expect(privacyJs).not.toContain("COMPLETE_WITHOUT");expect(privacyCss).toContain(".overdue");expect(()=>new Function(privacyJs)).not.toThrow();});});
