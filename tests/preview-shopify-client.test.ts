import { describe,expect,it } from "vitest";
import { ShopifyProductPublisher } from "../src/shopify/publisher.js";
import { createPreviewShopifyClient } from "../src/shopify/preview-client.js";

describe("preview Shopify client",()=>{it("returns a stable draft product id for productSet",async()=>{const publisher=new ShopifyProductPublisher(createPreviewShopifyClient()),payload={identifier:{handle:"storzy-revision-1"},input:{title:"Seoul Tee"}};const first=await publisher.publish(payload),second=await publisher.publish(payload);expect(first.productId).toMatch(/^gid:\/\/shopify\/Product\/[a-f0-9]{12}$/);expect(second.productId).toBe(first.productId);expect(first.raw).toMatchObject({productSet:{product:{title:"Seoul Tee",status:"DRAFT"}}})})});
