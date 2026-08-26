import{describe,expect,it,vi}from"vitest";
import{ProviderHttpError}from"../src/integrations/http.js";
import{MockupWorker}from"../src/mockups/worker.js";

const job=(remoteTaskIds:readonly string[]|null=null)=>({id:"job-1",revisionId:"revision-1",assetId:"asset-1",workspaceId:"workspace-1",remoteTaskIds:remoteTaskIds?[...remoteTaskIds]:null,attempt:2});
describe("Printful mockup throttle recovery",()=>{
  it.each([[null,"createMockupTask"],[ ["task-1"],"getMockupTasks"]] as const)("defers %s phase using Retry-After",async(ids,method)=>{const selected=job(ids),store={claim:vi.fn().mockResolvedValue(selected),createPayload:vi.fn().mockResolvedValue({}),deferRateLimit:vi.fn(),retry:vi.fn(),fail:vi.fn()},client={createMockupTask:vi.fn(),getMockupTasks:vi.fn()};client[method].mockRejectedValue(new ProviderHttpError("printful",429,"limited",19000));await new MockupWorker(store as never,client as never,"worker").tick();expect(store.deferRateLimit).toHaveBeenCalledWith("job-1","worker",19000);expect(store.retry).not.toHaveBeenCalled();expect(store.fail).not.toHaveBeenCalled()});
  it("retries a transient provider failure before the attempt limit",async()=>{const selected=job(),store={claim:vi.fn().mockResolvedValue(selected),createPayload:vi.fn().mockResolvedValue({}),deferRateLimit:vi.fn(),retry:vi.fn(),fail:vi.fn()},client={createMockupTask:vi.fn().mockRejectedValue(new ProviderHttpError("printful",503,"unavailable"))};await new MockupWorker(store as never,client as never,"worker").tick();expect(store.retry).toHaveBeenCalledWith(selected,"worker",expect.any(Number),"PRINTFUL_503");expect(store.fail).not.toHaveBeenCalled()});
});
