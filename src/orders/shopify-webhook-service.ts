import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import { money } from "../domain/money.js";
import { evaluateOrder, type OrderPolicy } from "../domain/order-policy.js";
import { verifyShopifyWebhook } from "../integrations/shopify.js";
import type {OrderAutomationGate} from "./automation-control.js";

export type ShopifyWebhookHeaders = Readonly<{ hmac?: string; webhookId?: string; topic?: string; shopDomain?: string; apiVersion?: string }>;
type Obj = Record<string, unknown>;
const objects = (value: unknown): Obj[] => Array.isArray(value) ? value.filter((item): item is Obj => !!item && typeof item === "object" && !Array.isArray(item)) : [];
export function parseShopifyMoneyMinor(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) throw Object.assign(new Error("Invalid Shopify money value"), { status: 400 });
  const [major, fraction = ""] = value.split(".");
  return BigInt(major!) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export class ShopifyOrderWebhookService {
  constructor(private readonly pool: pg.Pool, private readonly secret: string, private readonly workspaceId: string, private readonly allowedCountries: ReadonlySet<string>, private readonly policy: OrderPolicy,private readonly automationGate?:OrderAutomationGate) {}

  private async applyCancellation(client:pg.PoolClient,commerceOrderId:string,shopifyOrderId:string){
    const pending=await client.query<{id:string}>("SELECT id FROM shopify_order_cancellations WHERE workspace_id=$1 AND shopify_order_id=$2 FOR UPDATE",[this.workspaceId,shopifyOrderId]);
    if(!pending.rows[0])return null;
    const order=await client.query<{status:string;decision_reasons:unknown}>("SELECT status,decision_reasons FROM commerce_orders WHERE id=$1 FOR UPDATE",[commerceOrderId]),current=order.rows[0];
    if(!current)return null;
    const job=await client.query<{status:string;remote_order_id:string|null}>("SELECT status,remote_order_id FROM printful_order_jobs WHERE commerce_order_id=$1 FOR UPDATE",[commerceOrderId]),submitted=!!job.rows[0]?.remote_order_id||["RUNNING","SUCCEEDED"].includes(job.rows[0]?.status??""),after=submitted?"HELD":"REJECTED",reason=submitted?"SHOPIFY_CANCELLED_AFTER_PRINTFUL_SUBMISSION":"SHOPIFY_CANCELLED_BEFORE_PRINTFUL_SUBMISSION",beforeReasons=Array.isArray(current.decision_reasons)?current.decision_reasons:[];
    await client.query("UPDATE commerce_orders SET status=$2,decision_reasons=decision_reasons||$3::jsonb,updated_at=now() WHERE id=$1",[commerceOrderId,after,JSON.stringify([reason])]);
    if(!submitted)await client.query("UPDATE printful_order_jobs SET status='HELD',last_error=$2,finished_at=now(),locked_by=NULL,lease_expires_at=NULL WHERE commerce_order_id=$1 AND status IN('PENDING_DRAFT','WAITING_COST','READY_CONFIRM','FAILED')",[commerceOrderId,reason]);
    await client.query("INSERT INTO order_exception_actions(id,commerce_order_id,action,actor_id,reason,before_status,after_status,before_reasons,after_reasons,idempotency_key) VALUES($1,$2,'SHOPIFY_CANCELLED','shopify-webhook',$3,$4,$5,$6::jsonb,$7::jsonb,$8) ON CONFLICT(commerce_order_id,idempotency_key) DO NOTHING",[randomUUID(),commerceOrderId,reason,current.status,after,JSON.stringify(beforeReasons),JSON.stringify([...beforeReasons,reason]),`shopify-cancel:${pending.rows[0].id}`]);
    await client.query("UPDATE shopify_order_cancellations SET status='APPLIED',applied_at=now() WHERE id=$1",[pending.rows[0].id]);
    return{status:after,reason,submitted};
  }

  private async receiveCancellation(raw:Buffer,headers:ShopifyWebhookHeaders,body:Obj,orderId:string){const client=await this.pool.connect();try{await client.query("BEGIN");const receiptId=randomUUID(),receipt=await client.query(`INSERT INTO shopify_order_webhook_receipts(id,webhook_id,workspace_id,topic,shop_domain,api_version,payload_digest,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(webhook_id) DO NOTHING RETURNING id`,[receiptId,headers.webhookId,this.workspaceId,headers.topic,headers.shopDomain,headers.apiVersion??null,createHash("sha256").update(raw).digest("hex"),JSON.stringify(body)]);if(!receipt.rowCount){await client.query("COMMIT");return{accepted:true,duplicate:true};}await client.query("INSERT INTO shopify_order_cancellations(id,workspace_id,shopify_order_id,webhook_receipt_id) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,shopify_order_id) DO UPDATE SET webhook_receipt_id=EXCLUDED.webhook_receipt_id,status='PENDING',applied_at=NULL,received_at=now()",[randomUUID(),this.workspaceId,orderId,receiptId]);const found=await client.query<{id:string}>("SELECT id FROM commerce_orders WHERE workspace_id=$1 AND shopify_order_id=$2",[this.workspaceId,orderId]),applied=found.rows[0]?await this.applyCancellation(client,found.rows[0].id,orderId):null;await client.query("COMMIT");return{accepted:true,duplicate:false,orderId,cancellation:applied??{status:"PENDING",reason:"ORDER_NOT_INGESTED"}};}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}

  async receive(raw: Buffer, headers: ShopifyWebhookHeaders) {
    if (!headers.hmac || !verifyShopifyWebhook(raw, headers.hmac, this.secret)) throw Object.assign(new Error("Invalid Shopify webhook signature"), { status: 401 });
    if (!headers.webhookId || !headers.topic || !headers.shopDomain) throw Object.assign(new Error("Missing Shopify webhook headers"), { status: 400 });
    if (!["orders/paid", "orders/create", "orders/updated", "orders/cancelled", "orders/replay", "orders/financial-sync"].includes(headers.topic)) return { accepted: false, duplicate: false };
    let body: Obj;
    try { body = JSON.parse(raw.toString("utf8")) as Obj; } catch { throw Object.assign(new Error("Invalid webhook JSON"), { status: 400 }); }
    const orderId = String(body.admin_graphql_api_id ?? body.id ?? "");
    if(!orderId)throw Object.assign(new Error("Invalid Shopify order payload"),{status:400});
    if(headers.topic==="orders/cancelled")return this.receiveCancellation(raw,headers,body,orderId);
    const currency = String(body.currency ?? "").toUpperCase();
    const shipping = (body.shipping_address ?? {}) as Obj;
    const sourceLines = objects(body.line_items);
    if (!orderId || !/^[A-Z]{3}$/.test(currency) || !sourceLines.length) throw Object.assign(new Error("Invalid Shopify order payload"), { status: 400 });

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const receiptId = randomUUID();
      const receipt = await client.query(`INSERT INTO shopify_order_webhook_receipts(id,webhook_id,workspace_id,topic,shop_domain,api_version,payload_digest,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(webhook_id) DO NOTHING RETURNING id`, [receiptId, headers.webhookId, this.workspaceId, headers.topic, headers.shopDomain, headers.apiVersion ?? null, createHash("sha256").update(raw).digest("hex"), raw.toString("utf8")]);
      if (!receipt.rowCount) { await client.query("COMMIT"); return { accepted: true, duplicate: true }; }

      let totalCost = 0n, itemCount = 0, mappingTotal = 0, allDesigns = true, allAvailable = true;
      const lines: Array<{ source: Obj; quantity: number; sku: string; productId: string; variantId: string | null; candidateId: string | null; unitCost: bigint; design: boolean; mappingCount: number }> = [];
      for (const source of sourceLines) {
        const quantity = Number(source.current_quantity ?? source.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) continue;
        const sku = String(source.sku ?? ""), rawProductId = String(source.product_id ?? "");
        const productId = rawProductId.startsWith("gid://") ? rawProductId : `gid://shopify/Product/${rawProductId}`;
        const variantId = /^STORZY-PF-(.+)$/.exec(sku)?.[1] ?? null;
        const mappings = variantId ? await client.query<{ candidate_id: string; variable_cost_minor: string; design_id: string | null }>(`SELECT c.id candidate_id,c.variable_cost_minor,da.id design_id FROM shopify_publication_jobs spj JOIN product_content_revisions r ON r.id=spj.content_revision_id JOIN product_contents pc ON pc.id=r.product_content_id JOIN product_candidates c ON c.id=pc.candidate_id LEFT JOIN design_assets da ON da.candidate_id=c.id WHERE spj.workspace_id=$1 AND spj.shopify_product_id=$2 AND spj.status='SUCCEEDED' AND EXISTS(SELECT 1 FROM jsonb_array_elements((SELECT p->'catalogVariants' FROM jsonb_array_elements((SELECT data->'products' FROM catalog_snapshots WHERE id=c.catalog_snapshot_id)) p WHERE p->>'externalProductId'=c.external_product_id)) v WHERE v->>'externalVariantId'=$3)`, [this.workspaceId, productId, variantId]) : { rows: [], rowCount: 0 };
        const mapping = mappings.rows[0], mappingCount = mappings.rowCount ?? 0, design = !!mapping?.design_id, unitCost = BigInt(mapping?.variable_cost_minor ?? 0);
        mappingTotal += mappingCount; allDesigns &&= design; allAvailable &&= mappingCount === 1; totalCost += unitCost * BigInt(quantity); itemCount += quantity;
        lines.push({ source, quantity, sku, productId, variantId, candidateId: mapping?.candidate_id ?? null, unitCost, design, mappingCount });
      }
      const revenue = parseShopifyMoneyMinor(body.current_subtotal_price ?? body.subtotal_price);
      const country = String(shipping.country_code ?? shipping.country_code_v2 ?? "").toUpperCase();
      const addressValid = !!String(shipping.name ?? "").trim() && !!String(shipping.address1 ?? "").trim() && !!String(shipping.city ?? "").trim() && !!String(shipping.zip ?? "").trim() && country.length === 2;
      const paymentReady = ["paid", "partially_refunded"].includes(String(body.financial_status ?? ""));
      const decision = evaluateOrder({ revenue: money(revenue, currency), currentVariableCost: money(totalCost, currency), approvedVariableCost: money(totalCost, currency), shippingCountry: country, allowedCountries: this.allowedCountries, addressValid, variantAvailable: allAvailable, designPresent: allDesigns, mappingCount: mappingTotal === lines.length ? 1 : 0, paymentReady, alreadySubmitted: false, itemCount }, this.policy);
      const replay=headers.topic==="orders/replay",financialSync=headers.topic==="orders/financial-sync",reviewOnly=replay||financialSync;
      const automationEnabled=this.automationGate?await this.automationGate.isEnabled(this.workspaceId,client):true;
      const status = reviewOnly||(!automationEnabled&&decision.status==="READY") ? "HELD" : decision.status === "READY" ? "READY" : decision.status === "WAITING" ? "WAITING" : decision.status === "ALREADY_PROCESSED" ? "ALREADY_PROCESSED" : "HELD";
      const baseReasons=replay?[...decision.reasons,"RECONCILIATION_REPLAY_REVIEW"]:financialSync?[...decision.reasons,"FINANCIAL_STATUS_SYNC_REVIEW"]:decision.reasons;
      const reasons=!automationEnabled&&decision.status==="READY"?[...baseReasons,"ORDER_AUTOMATION_NOT_APPROVED"]:baseReasons;
      const existing = await client.query<{ id: string }>("SELECT id FROM commerce_orders WHERE workspace_id=$1 AND shopify_order_id=$2", [this.workspaceId, orderId]);
      const commerceId = existing.rows[0]?.id ?? randomUUID();
      await client.query(`INSERT INTO commerce_orders(id,workspace_id,shopify_order_id,order_name,currency,revenue_minor,approved_variable_cost_minor,current_variable_cost_minor,shipping_country,item_count,financial_status,status,decision_reasons,margin_basis_points,rule_version,source_webhook_id) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15) ON CONFLICT(workspace_id,shopify_order_id) DO UPDATE SET revenue_minor=EXCLUDED.revenue_minor,financial_status=EXCLUDED.financial_status,status=EXCLUDED.status,decision_reasons=EXCLUDED.decision_reasons,margin_basis_points=EXCLUDED.margin_basis_points,source_webhook_id=EXCLUDED.source_webhook_id,updated_at=now()`, [commerceId, this.workspaceId, orderId, String(body.name ?? orderId), currency, revenue.toString(), totalCost.toString(), country, itemCount, String(body.financial_status ?? ""), status, JSON.stringify(reasons), decision.marginBasisPoints, decision.ruleVersion, receiptId]);
      await client.query("DELETE FROM commerce_order_lines WHERE commerce_order_id=$1", [commerceId]);
      for (const line of lines) await client.query(`INSERT INTO commerce_order_lines(id,commerce_order_id,shopify_line_item_id,shopify_product_id,sku,printful_variant_id,candidate_id,quantity,unit_revenue_minor,mapping_count,design_present) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [randomUUID(), commerceId, String(line.source.id ?? randomUUID()), line.productId, line.sku, line.variantId, line.candidateId, line.quantity, parseShopifyMoneyMinor(line.source.price).toString(), line.mappingCount, line.design]);
      const cancellation=await this.applyCancellation(client,commerceId,orderId);
      if(status==='READY'&&!cancellation)await client.query(`INSERT INTO printful_order_jobs(id,commerce_order_id,workspace_id,external_id) VALUES($1,$2,$3,$4) ON CONFLICT(commerce_order_id) DO NOTHING`,[randomUUID(),commerceId,this.workspaceId,`storzy:${this.workspaceId}:${orderId}`]);
      await client.query("COMMIT");
      return { accepted: true, duplicate: false, orderId, status:cancellation?.status??status, reasons:cancellation?[...reasons,cancellation.reason]:reasons };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}
