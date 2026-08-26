import { describe, expect, it, vi } from "vitest";
import { ShopifyFulfillmentPublisher } from "../src/fulfillment/shopify-publisher.js";
const context = { shopifyOrderId: "gid://shopify/Order/1", carrier: "USPS", trackingNumber: "TRACK", trackingUrl: "https://tracking.example/TRACK", items: [{ shopifyLineItemId: "10", quantity: 1 }] };
const lookup = (remainingQuantity: number,fulfillments:unknown[]=[] ) => ({ order: { fulfillments:{nodes:fulfillments},fulfillmentOrders: { nodes: [{ id: "gid://shopify/FulfillmentOrder/2", status: "OPEN", lineItems: { nodes: [{ id: "gid://shopify/FulfillmentOrderLineItem/3", remainingQuantity, lineItem: { id: "gid://shopify/LineItem/10" } }] } }] } } });
describe("Shopify fulfillment publisher", () => {
  it("maps a partial shipment to fulfillment order line items", async () => {
    const graphql = vi.fn().mockResolvedValueOnce(lookup(2)).mockResolvedValueOnce({ fulfillmentCreate: { fulfillment: { id: "gid://shopify/Fulfillment/4" }, userErrors: [] } });
    const result = await new ShopifyFulfillmentPublisher({ graphql } as never).publish(context);
    expect(result.fulfillmentId).toBe("gid://shopify/Fulfillment/4");
    expect(graphql.mock.calls[1]?.[1]).toMatchObject({ fulfillment: { lineItemsByFulfillmentOrder: [{ fulfillmentOrderLineItems: [{ id: "gid://shopify/FulfillmentOrderLineItem/3", quantity: 1 }] }], trackingInfo: { number: "TRACK" }, notifyCustomer: true } });
  });
  it("rejects an over-fulfillment before mutation", async () => {
    const graphql = vi.fn().mockResolvedValueOnce(lookup(0));
    await expect(new ShopifyFulfillmentPublisher({ graphql } as never).publish(context)).rejects.toMatchObject({ status: 422 });
    expect(graphql).toHaveBeenCalledTimes(1);
  });
  it("recovers an existing fulfillment with the same tracking and exact items",async()=>{const existing={id:"gid://shopify/Fulfillment/old",status:"SUCCESS",trackingInfo:[{number:"TRACK",url:context.trackingUrl,company:"USPS"}],fulfillmentLineItems:{nodes:[{quantity:1,lineItem:{id:"gid://shopify/LineItem/10"}}]}},graphql=vi.fn().mockResolvedValue(lookup(0,[existing])),result=await new ShopifyFulfillmentPublisher({graphql}as never).publish(context);expect(result).toMatchObject({fulfillmentId:existing.id,payload:{recovered:true,trackingNumber:"TRACK"}});expect(graphql).toHaveBeenCalledTimes(1)});
  it("stops when a reused tracking number belongs to different items",async()=>{const existing={id:"gid://shopify/Fulfillment/old",status:"SUCCESS",trackingInfo:[{number:"TRACK",url:null,company:null}],fulfillmentLineItems:{nodes:[{quantity:1,lineItem:{id:"gid://shopify/LineItem/other"}}]}},graphql=vi.fn().mockResolvedValue(lookup(1,[existing]));await expect(new ShopifyFulfillmentPublisher({graphql}as never).publish(context)).rejects.toMatchObject({status:422});expect(graphql).toHaveBeenCalledTimes(1)});
});
