import {describe,expect,it,vi} from "vitest";
import {WebhookHealthService} from "../src/integrations/webhook-health-service.js";

describe("webhook delivery health",()=>{
  it("summarizes recent Shopify and stale Printful deliveries",async()=>{
    const pool={query:vi.fn().mockResolvedValueOnce({rows:[{last_received_at:new Date("2026-08-10T11:00:00Z"),received_24h:"3",total_received:"8"}]}).mockResolvedValueOnce({rows:[{last_received_at:new Date("2026-08-08T10:00:00Z"),received_24h:"0",total_received:"5",retried_deliveries:"2"}]})};
    const result=await new WebhookHealthService(pool as never,()=>new Date("2026-08-10T12:00:00Z")).get("workspace-1");
    expect(result.shopify).toMatchObject({status:"RECENT",received24h:3,totalReceived:8,retriedDeliveries:null});
    expect(result.printful).toMatchObject({status:"STALE",received24h:0,totalReceived:5,retriedDeliveries:2});
    expect(pool.query.mock.calls[1]?.[0]).toContain("integration_connections");
  });
  it("reports never received without inventing a timestamp",async()=>{
    const pool={query:vi.fn().mockResolvedValue({rows:[{last_received_at:null,received_24h:"0",total_received:"0",retried_deliveries:"0"}]})};
    const result=await new WebhookHealthService(pool as never).get("workspace-1");
    expect(result.shopify).toMatchObject({status:"NEVER_RECEIVED",lastReceivedAt:null,totalReceived:0});
    expect(result.printful).toMatchObject({status:"NEVER_RECEIVED",lastReceivedAt:null,totalReceived:0});
  });
});
