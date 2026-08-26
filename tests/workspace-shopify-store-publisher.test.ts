import {afterEach,describe,expect,it,vi} from "vitest";
import {buildStoreConfig} from "../src/storefront/config-builder.js";
import {mapStoreConfigToShopifyPlan} from "../src/storefront/shopify-plan.js";
import {WorkspaceShopifyStorePublisher} from "../src/storefront/workspace-shopify-publisher.js";
import {ShopifyConnectionUnavailableError} from "../src/shopify/workspace-publisher.js";
import {StorePublicationWorker} from "../src/storefront/publication-worker.js";

afterEach(()=>vi.unstubAllGlobals());
const plan=mapStoreConfigToShopifyPlan(buildStoreConfig({brand_name:"Seoul Side"}));
const graphqlResponse=(query:string)=>query.includes("FindPage")?{data:{pages:{nodes:[]}}}:query.includes("CreatePage")?{data:{pageCreate:{page:{id:"page-1",handle:"home"},userErrors:[]}}}:query.includes("FindMenu")?{data:{menus:{nodes:[]}}}:{data:{menuCreate:{menu:{id:"menu-1",handle:"main-menu"},userErrors:[]}}};

describe("workspace Shopify store publisher",()=>{
  it("워크스페이스 저장 연결로 페이지와 메뉴를 게시한다",async()=>{const fetch=vi.fn(async(_input:string|URL|Request,init?:RequestInit)=>{const query=JSON.parse(String(init?.body)).query as string;return new Response(JSON.stringify(graphqlResponse(query)),{status:200,headers:{"Content-Type":"application/json"}})});vi.stubGlobal("fetch",fetch);const connections={list:vi.fn().mockResolvedValue([{provider:"SHOPIFY",status:"CONNECTED",accountLabel:"seoul.myshopify.com"}]),credentials:vi.fn().mockResolvedValue({accessToken:"workspace-token"})},publisher=new WorkspaceShopifyStorePublisher(connections as never,"2026-07");await expect(publisher.publish(plan,"workspace-1")).resolves.toMatchObject({menu:{id:"menu-1"}});expect(String(fetch.mock.calls[0]?.[0])).toContain("seoul.myshopify.com");expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({"X-Shopify-Access-Token":"workspace-token"})});
  it("연결 없는 스토어 게시 작업을 실패시키지 않고 defer한다",async()=>{const job={id:"job-1",storeDraftId:"draft-1",workspaceId:"workspace-1",attempt:1,plan},store={claim:vi.fn().mockResolvedValue(job),deferConnection:vi.fn().mockResolvedValue(true),success:vi.fn(),retry:vi.fn(),fail:vi.fn()},publisher={publish:vi.fn().mockRejectedValue(new ShopifyConnectionUnavailableError())},logger={info:vi.fn(),error:vi.fn()},worker=new StorePublicationWorker(store as never,publisher,logger as never,{workerId:"worker",leaseSeconds:30,maxAttempts:4,pollMs:10});await expect(worker.processOne()).resolves.toBe(true);expect(store.deferConnection).toHaveBeenCalledWith("job-1","worker");expect(store.retry).not.toHaveBeenCalled();expect(store.fail).not.toHaveBeenCalled()});
});
