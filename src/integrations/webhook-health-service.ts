import type pg from "pg";

export type WebhookHealthItem=Readonly<{provider:"SHOPIFY"|"PRINTFUL";status:"RECENT"|"NEVER_RECEIVED"|"STALE";lastReceivedAt:Date|null;received24h:number;totalReceived:number;retriedDeliveries:number|null}>;
export type WebhookHealth=Readonly<{shopify:WebhookHealthItem;printful:WebhookHealthItem;checkedAt:Date}>;

type Row={last_received_at:Date|null;received_24h:string;total_received:string;retried_deliveries?:string};
const item=(provider:WebhookHealthItem["provider"],row:Row|undefined,now:Date):WebhookHealthItem=>{const last=row?.last_received_at??null,status=!last?"NEVER_RECEIVED":now.getTime()-last.getTime()<=86_400_000?"RECENT":"STALE";return{provider,status,lastReceivedAt:last,received24h:Number(row?.received_24h??0),totalReceived:Number(row?.total_received??0),retriedDeliveries:provider==="PRINTFUL"?Number(row?.retried_deliveries??0):null};};

export class WebhookHealthService{
  constructor(private readonly pool:pg.Pool,private readonly now:()=>Date=()=>new Date()){}
  async get(workspaceId:string):Promise<WebhookHealth>{
    const [shopify,printful]=await Promise.all([
      this.pool.query<Row>(`SELECT max(received_at) last_received_at,count(*) FILTER(WHERE received_at>=now()-interval '24 hours')::text received_24h,count(*)::text total_received FROM shopify_order_webhook_receipts WHERE workspace_id=$1`,[workspaceId]),
      this.pool.query<Row>(`WITH stores AS(SELECT metadata->>'storeId' store_id FROM integration_connections WHERE workspace_id=$1 AND provider='PRINTFUL'),events AS(SELECT received_at,0 retries FROM printful_fulfillment_events WHERE store_id IN(SELECT store_id FROM stores) UNION ALL SELECT received_at,retries FROM printful_webhook_receipts WHERE store_id IN(SELECT store_id FROM stores)) SELECT max(received_at) last_received_at,count(*) FILTER(WHERE received_at>=now()-interval '24 hours')::text received_24h,count(*)::text total_received,count(*) FILTER(WHERE retries>0)::text retried_deliveries FROM events`,[workspaceId]),
    ]),checkedAt=this.now();
    return{shopify:item("SHOPIFY",shopify.rows[0],checkedAt),printful:item("PRINTFUL",printful.rows[0],checkedAt),checkedAt};
  }
}
