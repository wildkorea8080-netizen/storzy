import { describe,expect,it } from "vitest";
import { parsePrintfulOrder } from "../src/orders/printful-response.js";
import { PreviewPrintfulOrderClient } from "../src/orders/preview-printful-client.js";

describe("preview Printful order client",()=>{it("creates, quotes, and confirms a deterministic draft",async()=>{const client=new PreviewPrintfulOrderClient(),payload={external_id:"storzy:w:o",order_items:[{quantity:2}],retail_costs:{currency:"USD"}},draft=parsePrintfulOrder(await client.createDraftOrder(payload)),quote=parsePrintfulOrder(await client.getOrder(draft.id)),confirmed=parsePrintfulOrder(await client.confirmOrder(draft.id));expect(draft).toMatchObject({status:"draft",calculationStatus:"calculating"});expect(quote).toMatchObject({costMinor:3200n,currency:"USD"});expect(confirmed.status).toBe("pending")})});
