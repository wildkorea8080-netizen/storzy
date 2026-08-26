import{readFileSync}from"node:fs";
import{describe,expect,it}from"vitest";
const script=readFileSync(new URL("../scripts/start-preview.ps1",import.meta.url),"utf8");
describe("preview app uninstall readiness",()=>{it("configures encrypted integration storage for the uninstall webhook",()=>{expect(script).toContain("INTEGRATION_CREDENTIAL_KEY_BASE64=");expect(script).toContain("SHOPIFY_WEBHOOK_SECRET=");expect(script).toContain("INTEGRATION_CREDENTIAL_KEY_VERSION=preview-v1")})});
