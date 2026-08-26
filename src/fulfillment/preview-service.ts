import { randomUUID } from "node:crypto";
import type pg from "pg";
import { PrintfulFulfillmentHandler } from "./printful-handler.js";

export function buildPreviewShipment(input:Readonly<{externalId:string;lineItemId:string;quantity:number;shipmentId:string}>){return{type:"shipment_sent",store_id:"preview-store",occurred_at:new Date().toISOString(),data:{order:{external_id:input.externalId},shipment:{id:input.shipmentId,order_external_id:input.externalId,carrier:"STORZY Express",shipment_status:"shipped",tracking_number:`STZ-${input.shipmentId.slice(0,8).toUpperCase()}`,tracking_url:`https://preview-assets.storzy.local/tracking/${input.shipmentId}`,shipped_at:new Date().toISOString(),shipment_items:[{order_item_external_id:input.lineItemId,quantity:input.quantity}]}}};}
export class PreviewFulfillmentService{
  constructor(private readonly pool:pg.Pool,private readonly handler=new PrintfulFulfillmentHandler(pool)){}
  async create(workspaceId:string){const result=await this.pool.query<{external_id:string;shopify_line_item_id:string;quantity:number}>(`SELECT j.external_id,l.shopify_line_item_id,l.quantity FROM printful_order_jobs j JOIN commerce_orders o ON o.id=j.commerce_order_id JOIN commerce_order_lines l ON l.commerce_order_id=o.id WHERE j.workspace_id=$1 AND j.status='SUCCEEDED' ORDER BY j.finished_at DESC,l.shopify_line_item_id LIMIT 1`,[workspaceId]),row=result.rows[0];if(!row)throw Object.assign(new Error("No submitted preview order is available"),{status:422});const body=buildPreviewShipment({externalId:row.external_id,lineItemId:row.shopify_line_item_id,quantity:row.quantity,shipmentId:`preview-${randomUUID()}`}),raw=Buffer.from(JSON.stringify(body));return this.handler.receive(body,raw);}
}
