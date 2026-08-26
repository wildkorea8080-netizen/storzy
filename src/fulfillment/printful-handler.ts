import {createHash,randomUUID} from "node:crypto";
import type pg from "pg";

type Obj=Record<string,unknown>;
const objects=(value:unknown):Obj[]=>Array.isArray(value)?value.filter((item):item is Obj=>!!item&&typeof item==="object"&&!Array.isArray(item)):[];

export class PrintfulFulfillmentHandler{
  constructor(private readonly pool:pg.Pool){}
  async receive(body:Obj,raw:Buffer,workspaceId?:string){
    const type=String(body.type??"");
    if(!["shipment_sent","shipment_returned"].includes(type))return{accepted:false,duplicate:false};
    const data=(body.data??{})as Obj,shipment=(data.shipment??data)as Obj,order=(data.order??{})as Obj;
    const shipmentId=String(shipment.id??""),externalId=String(shipment.order_external_id??order.external_id??""),occurred=String(body.occurred_at??"");
    if(!shipmentId||!externalId||!Number.isFinite(Date.parse(occurred)))throw Object.assign(new Error("Invalid Printful shipment payload"),{status:400});
    const digest=createHash("sha256").update(raw).digest("hex"),client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const event=await client.query(`INSERT INTO printful_fulfillment_events(id,payload_digest,event_type,store_id,occurred_at,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(payload_digest) DO NOTHING RETURNING id`,[randomUUID(),digest,type,String(body.store_id??""),occurred,raw.toString("utf8")]);
      if(!event.rowCount){await client.query("COMMIT");return{accepted:true,duplicate:true};}
      const found=await client.query<{id:string}>(`SELECT o.id FROM printful_order_jobs j JOIN commerce_orders o ON o.id=j.commerce_order_id WHERE j.external_id=$1 AND ($2::uuid IS NULL OR o.workspace_id=$2)`,[externalId,workspaceId??null]);
      if(!found.rows[0])throw Object.assign(new Error("Unknown Printful order external id"),{status:400});
      const saved=await client.query<{id:string}>(`INSERT INTO fulfillment_shipments(id,commerce_order_id,printful_shipment_id,carrier,shipment_status,tracking_number,tracking_url,shipped_at,raw_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT(printful_shipment_id) DO UPDATE SET carrier=EXCLUDED.carrier,shipment_status=EXCLUDED.shipment_status,tracking_number=EXCLUDED.tracking_number,tracking_url=EXCLUDED.tracking_url,shipped_at=EXCLUDED.shipped_at,raw_snapshot=EXCLUDED.raw_snapshot,updated_at=now() RETURNING id`,[randomUUID(),found.rows[0].id,shipmentId,shipment.carrier??null,String(shipment.shipment_status??(type==="shipment_sent"?"shipped":"returned")),shipment.tracking_number??null,shipment.tracking_url??null,shipment.shipped_at??occurred,JSON.stringify(shipment)]),id=saved.rows[0]!.id;
      await client.query("DELETE FROM fulfillment_shipment_items WHERE shipment_id=$1",[id]);
      for(const item of objects(shipment.shipment_items)){const lineId=String(item.order_item_external_id??""),quantity=Number(item.quantity);if(lineId&&Number.isInteger(quantity)&&quantity>0)await client.query(`INSERT INTO fulfillment_shipment_items(id,shipment_id,shopify_line_item_id,quantity) VALUES($1,$2,$3,$4)`,[randomUUID(),id,lineId,quantity]);}
      if(type==="shipment_sent")await client.query(`INSERT INTO shopify_fulfillment_jobs(id,shipment_id) VALUES($1,$2) ON CONFLICT(shipment_id) DO NOTHING`,[randomUUID(),id]);
      if(type==="shipment_returned"){const current=await client.query<{status:string;decision_reasons:unknown}>("SELECT status,decision_reasons FROM commerce_orders WHERE id=$1 FOR UPDATE",[found.rows[0].id]),row=current.rows[0],beforeReasons=Array.isArray(row?.decision_reasons)?row.decision_reasons:[],reason="PRINTFUL_SHIPMENT_RETURNED";if(row){await client.query("UPDATE commerce_orders SET status='RETURNED',decision_reasons=decision_reasons||$2::jsonb,updated_at=now() WHERE id=$1",[found.rows[0].id,JSON.stringify([reason])]);await client.query("INSERT INTO order_exception_actions(id,commerce_order_id,action,actor_id,reason,before_status,after_status,before_reasons,after_reasons,idempotency_key) VALUES($1,$2,'PRINTFUL_RETURNED','printful-webhook',$3,$4,'RETURNED',$5::jsonb,$6::jsonb,$7) ON CONFLICT(commerce_order_id,idempotency_key) DO NOTHING",[randomUUID(),found.rows[0].id,reason,row.status,JSON.stringify(beforeReasons),JSON.stringify([...beforeReasons,reason]),`printful-return:${event.rows[0].id}`]);await client.query("INSERT INTO return_cases(id,workspace_id,commerce_order_id,shipment_id) SELECT $1,o.workspace_id,o.id,$3 FROM commerce_orders o WHERE o.id=$2 ON CONFLICT(commerce_order_id) DO NOTHING",[randomUUID(),found.rows[0].id,id]);}}
      await client.query("COMMIT");return{accepted:true,duplicate:false,shipmentId};
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }
}
