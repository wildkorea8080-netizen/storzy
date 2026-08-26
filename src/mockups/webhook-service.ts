import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import type { PrintfulFulfillmentHandler } from "../fulfillment/printful-handler.js";
import { verifyPrintfulWebhook } from "../integrations/printful.js";
export type WebhookResult=Readonly<{accepted:boolean;duplicate:boolean;matchedJobs:number}>;
export class PrintfulMockupWebhookService {
  constructor(private readonly pool: pg.Pool, private readonly secretHex: string, private readonly publicKey?: string, private readonly fulfillment?: PrintfulFulfillmentHandler,private readonly workspaceId?:string) {}
  async receive(raw: Buffer, headers: Readonly<{ signature?: string; publicKey?: string }>) {
    if (!headers.signature || !verifyPrintfulWebhook(raw, headers.signature, this.secretHex)) throw Object.assign(new Error("Invalid Printful webhook signature"), { status: 401 });
    if (this.publicKey && headers.publicKey !== this.publicKey) throw Object.assign(new Error("Unknown Printful webhook public key"), { status: 401 });
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw.toString("utf8")) as Record<string, unknown>; } catch { throw Object.assign(new Error("Invalid webhook JSON"), { status: 400 }); }
    if (body.type !== "mockup_task_finished") {
      if (this.fulfillment) return this.fulfillment.receive(body, raw,this.workspaceId);
      return { accepted: false, duplicate: false, matchedJobs: 0 };
    }
    const data = body.data as Record<string, unknown> | undefined, taskId = String(data?.id ?? ""), occurred = String(body.occurred_at ?? "");
    if (!taskId || !Number.isFinite(Date.parse(occurred)) || !Number.isInteger(body.retries) || Number(body.retries) < 0) throw Object.assign(new Error("Invalid mockup webhook payload"), { status: 400 });
    const digest = createHash("sha256").update(raw).digest("hex"), client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const receipt = await client.query(`INSERT INTO printful_webhook_receipts(id,payload_digest,event_type,remote_task_id,store_id,occurred_at,retries) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(payload_digest) DO NOTHING RETURNING id`, [randomUUID(), digest, body.type, taskId, String(body.store_id ?? ""), occurred, body.retries]);
      if (!receipt.rowCount) { await client.query("COMMIT"); return { accepted: true, duplicate: true, matchedJobs: 0 }; }
      const wake = await client.query(`UPDATE printful_mockup_jobs SET available_at=now() WHERE status='WAITING_REMOTE' AND remote_task_ids @> $1::jsonb AND ($2::uuid IS NULL OR workspace_id=$2)`, [JSON.stringify([taskId]),this.workspaceId??null]);
      await client.query("COMMIT"); return { accepted: true, duplicate: false, matchedJobs: wake.rowCount ?? 0 };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}
