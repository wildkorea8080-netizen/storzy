import { randomUUID } from "node:crypto";
import type pg from "pg";
import { PermanentDeliveryError } from "../outbox/event-sinks.js";
import type { EventSink, OutboxEvent } from "../outbox/types.js";

const CONSUMER_NAME = "storzy-domain-events.v1";
const SUPPORTED_TOPICS = new Set([
  "brand-profile.generation-requested",
  "brand-profile.review-required",
  "brand-profile.approved",
]);

export class PostgresDomainEventSink implements EventSink {
  constructor(private readonly pool: pg.Pool) {}

  async publish(event: OutboxEvent): Promise<void> {
    if (!SUPPORTED_TOPICS.has(event.topic)) {
      throw new PermanentDeliveryError("UNSUPPORTED_TOPIC", `Unsupported domain event topic: ${event.topic}`);
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const consumed = await client.query(
        `INSERT INTO event_consumptions (event_id, consumer_name)
         VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING event_id`,
        [event.id, CONSUMER_NAME],
      );
      if (!consumed.rowCount) {
        await client.query("COMMIT");
        return;
      }

      if (event.topic === "brand-profile.review-required") {
        const revision = await this.loadRevision(client, event.aggregateId);
        await client.query(
          `INSERT INTO operator_notifications
            (id, source_event_id, workspace_id, revision_id, kind, title, message, correlation_id)
           VALUES ($1, $2, $3, $4, 'BRAND_PROFILE_REVIEW_REQUIRED', $5, $6, $7)
           ON CONFLICT (source_event_id) DO NOTHING`,
          [
            randomUUID(),
            event.id,
            revision.workspaceId,
            event.aggregateId,
            "Brand Profile 검수가 필요합니다",
            `Brand Profile revision ${revision.revision}의 생성이 완료되었습니다.`,
            event.correlationId,
          ],
        );
      }

      if (event.topic === "brand-profile.approved") {
        const revision = await this.loadRevision(client, event.aggregateId);
        await client.query(
          `INSERT INTO product_candidate_jobs
            (id, source_event_id, workspace_id, revision_id, correlation_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (source_event_id) DO NOTHING`,
          [randomUUID(), event.id, revision.workspaceId, event.aggregateId, event.correlationId],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async loadRevision(client: pg.PoolClient, revisionId: string): Promise<{ workspaceId: string; revision: number }> {
    const result = await client.query<{ workspace_id: string; revision: number }>(
      `SELECT p.workspace_id, r.revision
       FROM brand_profile_revisions r
       JOIN brand_profiles p ON p.id = r.brand_profile_id
       WHERE r.id = $1`,
      [revisionId],
    );
    const row = result.rows[0];
    if (!row) throw new PermanentDeliveryError("REVISION_NOT_FOUND", `Revision not found for event: ${revisionId}`);
    return { workspaceId: row.workspace_id, revision: row.revision };
  }
}

