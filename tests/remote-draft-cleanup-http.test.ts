import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import {afterEach,describe,expect,it,vi} from "vitest";
import {MemoryBrandProfileStore} from "../src/brand/memory-store.js";
import {BrandProfileService} from "../src/brand/service.js";
import {createApp} from "../src/http/app.js";

const servers:ReturnType<typeof createServer>[]=[];
afterEach(async()=>Promise.all(servers.splice(0).map(server=>new Promise<void>(resolve=>server.close(()=>resolve())))));

async function start(){
  const cleanup={list:vi.fn().mockResolvedValue([{id:"action-1",remote_order_id:"99"}]),cleanup:vi.fn()},args=Array(30).fill(undefined) as unknown as Parameters<typeof createApp>;
  args[0]=new BrandProfileService(new MemoryBrandProfileStore());args[9]="secret";args[29]=cleanup as never;
  const server=createServer(createApp(...args));servers.push(server);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  return{base:`http://127.0.0.1:${(server.address() as AddressInfo).port}`,cleanup};
}

describe("Printful draft cleanup history HTTP API",()=>{
  it("requires admin auth and returns an uncached bounded history",async()=>{
    const{base,cleanup}=await start(),path="/api/workspaces/workspace-1/orders/order-1/printful-draft/cleanup-actions?limit=10";
    expect((await fetch(base+path)).status).toBe(401);
    const response=await fetch(base+path,{headers:{Authorization:"Bearer secret"}});
    expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store, private");
    await expect(response.json()).resolves.toEqual({data:[{id:"action-1",remote_order_id:"99"}]});
    expect(cleanup.list).toHaveBeenCalledWith("workspace-1","order-1",10);
  });
  it("rejects an unbounded history request",async()=>{
    const{base,cleanup}=await start(),response=await fetch(base+"/api/workspaces/w/orders/o/printful-draft/cleanup-actions?limit=101",{headers:{Authorization:"Bearer secret"}});
    expect(response.status).toBe(400);expect(cleanup.list).not.toHaveBeenCalled();
  });
});
