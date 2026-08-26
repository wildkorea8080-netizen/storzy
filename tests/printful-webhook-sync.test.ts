import {describe,expect,it,vi} from "vitest";
import {syncPrintfulWebhooks} from "../src/integrations/printful-webhook-sync.js";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
describe("Printful v2 webhook sync",()=>{
  it("preserves matching events and creates or updates only STORZY events",async()=>{
    const fetcher=vi.fn()
      .mockResolvedValueOnce(json({result:{type:"mockup_task_finished",url:"https://app.example/webhooks/printful",params:[]}}))
      .mockResolvedValueOnce(json({error:"not found"},404))
      .mockResolvedValueOnce(json({result:{type:"shipment_sent",url:"https://app.example/webhooks/printful",params:[]}}))
      .mockResolvedValueOnce(json({result:{type:"shipment_returned",url:"https://old.example/hook",params:[]}}))
      .mockResolvedValueOnce(json({result:{type:"shipment_returned",url:"https://app.example/webhooks/printful",params:[]}}));
    const result=await syncPrintfulWebhooks({token:"secret",storeId:"42",publicAppUrl:"https://app.example",fetch:fetcher});
    expect(result).toMatchObject({total:3,created:1,updated:1,existing:1});
    expect(fetcher).toHaveBeenCalledTimes(5);
    for(const call of fetcher.mock.calls)expect((call[1]?.headers as Headers).get("X-PF-Store-Id")).toBe("42");
  });
  it("does not convert authentication failures into create requests",async()=>{
    const fetcher=vi.fn().mockResolvedValue(json({error:"unauthorized"},401));
    await expect(syncPrintfulWebhooks({token:"secret",storeId:"42",publicAppUrl:"https://app.example",fetch:fetcher})).rejects.toMatchObject({status:401});
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("requires a public HTTPS callback",async()=>{
    await expect(syncPrintfulWebhooks({token:"secret",storeId:"42",publicAppUrl:"http://localhost:3000"})).rejects.toMatchObject({code:"WEBHOOK_PUBLIC_HTTPS_REQUIRED"});
  });
});
