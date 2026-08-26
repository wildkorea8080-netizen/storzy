import { randomUUID } from "node:crypto";
import type pg from "pg";

export type DeadLetterEvent = Readonly<{
  id: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
}>;

export class OutboxOperations {
  constructor(private readonly pool: pg.Pool) {}

  async listDeadLetters(limit = 50): Promise<readonly DeadLetterEvent[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("limit must be between 1 and 200");
    const result = await this.pool.query<{
      id: string;
      topic: string;
      aggregate_type: string;
      aggregate_id: string;
      correlation_id: string;
      attempts: number;
      last_error: string | null;
      created_at: Date;
    }>(
      `SELECT id, topic, aggregate_type, aggregate_id, correlation_id, attempts, last_error, created_at
       FROM outbox_events WHERE status = 'DEAD_LETTER'
       ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      correlationId: row.correlation_id,
      attempts: row.attempts,
      lastError: row.last_error,
      createdAt: row.created_at,
    }));
  }

  async requeue(input: Readonly<{ eventId: string; actorId: string; reason: string }>): Promise<boolean> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.eventId)) {
      throw new Error("eventId must be a UUID");
    }
    const actorId = input.actorId.trim();
    const reason = input.reason.trim();
    if (!actorId || actorId.length > 200) throw new Error("actorId is required and must be at most 200 characters");
    if (!reason || reason.length > 500) throw new Error("reason is required and must be at most 500 characters");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE outbox_events
         SET status = 'PENDING', attempts = 0, available_at = now(), published_at = NULL,
             last_error = NULL, locked_by = NULL, lease_expires_at = NULL
         WHERE id = $1 AND status = 'DEAD_LETTER'`,
        [input.eventId],
      );
      if (updated.rowCount !== 1) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query(
        `INSERT INTO outbox_event_actions (id, event_id, actor_id, action, reason)
         VALUES ($1, $2, $3, 'REQUEUED', $4)`,
        [randomUUID(), input.eventId, actorId, reason],
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

