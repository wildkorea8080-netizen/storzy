import {afterEach,describe,expect,it,vi} from "vitest";
import {WorkspacePrintfulCatalogProviders,PrintfulCatalogConnectionUnavailableError} from "../src/candidates/workspace-printful-catalog.js";
import {CandidateWorker} from "../src/candidates/worker.js";
import {MemoryCandidateJobStore} from "../src/candidates/memory-job-store.js";
import {NoopLogger} from "../src/observability/logger.js";

afterEach(()=>vi.unstubAllGlobals());
const seed={productId:"71",productType:"t-shirt",baseCostMinor:1500,shippingReserveMinor:500,returnRisk:"LOW" as const,technique:"dtg"};
describe("workspace Printful catalog",()=>{
  it("워크스페이스 저장 연결로 catalog provider를 만든다",async()=>{const connections={list:vi.fn().mockResolvedValue([{provider:"PRINTFUL",status:"CONNECTED",accountLabel:"42"}]),credentials:vi.fn().mockResolvedValue({token:"workspace-token",storeId:"42"})},resolver=new WorkspacePrintfulCatalogProviders(connections as never,"https://api.printful.com",[seed]);await expect(resolver.forWorkspace("workspace-1")).resolves.toBeDefined();expect(connections.credentials).toHaveBeenCalledWith("workspace-1","PRINTFUL")});
  it("연결이 없으면 catalog 연결 대기 오류를 반환한다",async()=>{const resolver=new WorkspacePrintfulCatalogProviders({list:vi.fn().mockResolvedValue([]),credentials:vi.fn().mockResolvedValue(null)} as never,"https://api.printful.com",[seed]);await expect(resolver.forWorkspace("workspace-1")).rejects.toBeInstanceOf(PrintfulCatalogConnectionUnavailableError)});
  it("Printful 연결 전 후보 job을 실패시키지 않고 defer한다",async()=>{const store=new MemoryCandidateJobStore();store.profiles.set("revision-1",{pricing:{currency:"USD"}});store.enqueue({id:"job-1",revisionId:"revision-1",workspaceId:"workspace-7",correlationId:"corr-1"});const resolver={forWorkspace:vi.fn().mockRejectedValue(new PrintfulCatalogConnectionUnavailableError())},worker=new CandidateWorker(store,resolver,new NoopLogger(),{workerId:"worker",leaseSeconds:30,maxAttempts:4,pollMs:10,currency:"USD"});await expect(worker.processOne()).resolves.toBe(true);expect(resolver.forWorkspace).toHaveBeenCalledWith("workspace-7");expect(store.jobs[0]).toMatchObject({status:"PENDING",attempts:0,lastError:"WAITING_FOR_PRINTFUL_CONNECTION"})});
});
