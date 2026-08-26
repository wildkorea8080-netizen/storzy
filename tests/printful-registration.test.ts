import { describe, expect, it, vi } from "vitest";
import { registerPrintfulConnection } from "../src/integrations/printful-registration.js";

describe("Printful connection registration",()=>{
  it("validates the store before passing credentials to encrypted storage",async()=>{
    const fetch=vi.fn(async()=>new Response(JSON.stringify({code:200,result:{id:42,name:"Seoul Fulfillment",type:"native"}}),{status:200,headers:{"Content-Type":"application/json"}})),upsert=vi.fn(async()=>({status:"CONNECTED",accountLabel:"Seoul Fulfillment · 42",updatedAt:new Date("2026-08-10T00:00:00Z")}));
    const result=await registerPrintfulConnection({workspaceId:"workspace-1",token:"printful-secret-token",storeId:"42",actorId:"admin"},{upsert} as never,"https://api.printful.com",fetch as typeof globalThis.fetch);
    expect(result).toMatchObject({provider:"PRINTFUL",status:"CONNECTED",accountLabel:"Seoul Fulfillment · 42",storeId:"42"});
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({workspaceId:"workspace-1",provider:"PRINTFUL",credentials:{token:"printful-secret-token",storeId:"42"},metadata:{storeId:"42",storeType:"native"}}));
  });

  it("does not store invalid or unverified credentials",async()=>{
    const upsert=vi.fn(),repository={upsert};
    await expect(registerPrintfulConnection({workspaceId:"w",token:"short",storeId:"42",actorId:"admin"},repository as never)).rejects.toMatchObject({code:"INVALID_INPUT"});
    const failed=vi.fn(async()=>new Response("secret provider error",{status:401}));
    await expect(registerPrintfulConnection({workspaceId:"w",token:"long-enough-secret-token",storeId:"42",actorId:"admin"},repository as never,"https://api.printful.com",failed as typeof globalThis.fetch)).rejects.toMatchObject({code:"PROVIDER_VALIDATION_FAILED"});
    expect(upsert).not.toHaveBeenCalled();
  });
});
