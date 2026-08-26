import {createHmac} from "node:crypto";
import {describe,expect,it,vi} from "vitest";
import {PrintfulWebhookRouter} from "../src/mockups/printful-webhook-router.js";

describe("Printful webhook workspace router",()=>{
  it("rejects an unknown store after signature verification",async()=>{
    const secret=Buffer.alloc(32,7),raw=Buffer.from(JSON.stringify({store_id:42,type:"shipment_sent"})),connections={connectedWorkspaceForPrintfulStore:vi.fn().mockResolvedValue(null)};
    const router=new PrintfulWebhookRouter({} as never,secret.toString("hex"),"public",connections as never);
    await expect(router.receive(raw,{signature:createHmac("sha256",secret).update(raw).digest("hex"),publicKey:"public"})).rejects.toMatchObject({status:400});
    expect(connections.connectedWorkspaceForPrintfulStore).toHaveBeenCalledWith("42");
  });
  it("rejects a forged signature before store lookup",async()=>{
    const connections={connectedWorkspaceForPrintfulStore:vi.fn()},router=new PrintfulWebhookRouter({} as never,"aa",undefined,connections as never);
    await expect(router.receive(Buffer.from("{}"),{signature:"forged"})).rejects.toMatchObject({status:401});
    expect(connections.connectedWorkspaceForPrintfulStore).not.toHaveBeenCalled();
  });
});
