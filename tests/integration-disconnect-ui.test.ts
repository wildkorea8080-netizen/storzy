import { describe, expect, it } from "vitest";
import { integrationDisconnectCss, integrationDisconnectJs } from "../src/admin/integration-disconnect-ui.js";

describe("integration disconnect UI",()=>{
  it("only offers destruction for workspace-stored credentials",()=>{
    expect(integrationDisconnectJs).toContain("item.source!=='WORKSPACE'");
    expect(integrationDisconnectJs).toContain("/disconnect");
    expect(integrationDisconnectJs).toContain("prompt(");
    expect(integrationDisconnectJs).toContain("confirm(");
    expect(integrationDisconnectJs).toContain("readiness.blockingCount");
    expect(integrationDisconnectJs).toContain("연결 해제 잠김");
    expect(integrationDisconnectJs).toContain("method:'POST'");
    expect(integrationDisconnectJs).not.toContain("accessToken");
    expect(integrationDisconnectCss).toContain(".disconnect-control");
    expect(()=>new Function(integrationDisconnectJs)).not.toThrow();
  });
});
