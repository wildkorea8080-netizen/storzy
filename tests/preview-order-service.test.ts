import { describe,expect,it } from "vitest";
import { buildPreviewShopifyOrder } from "../src/orders/preview-order-service.js";

describe("preview order payload",()=>{it("uses the published product and Printful SKU mapping",()=>{const order=buildPreviewShopifyOrder({productId:"gid://shopify/Product/1",variantId:"101",priceMinor:4500,quantity:2,orderId:"abc"});expect(order).toMatchObject({currency:"USD",current_subtotal_price:"90.00",financial_status:"paid",line_items:[{product_id:"gid://shopify/Product/1",sku:"STORZY-PF-101",quantity:2,price:"45.00"}]});expect(order.shipping_address.country_code).toBe("US")})});
