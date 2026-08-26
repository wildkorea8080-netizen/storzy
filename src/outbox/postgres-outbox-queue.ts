import type pg from "pg";
import type { OutboxEvent, OutboxQueue } from "./types.js";

type EventRow = {
  id: string;
  topic: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  correlation_id: string;
  attempts: number;
};

export class PostgresOutboxQueue implements OutboxQueue {
  constructor(private readonly pool: pg.Pool) {}

  async claim(input: Readonly<{ workerId: string; leaseSeconds: number; maxAttempts: number }>): Promise<OutboxEvent | null> {
    const result = await this.pool.query<EventRow>(
      `WITH candidate AS (
         SELECT id
         FROM outbox_events
         WHERE status = 'PENDING'
           AND (
             (locked_by IS NULL AND attempts < $3 AND available_at <= now())
             OR (locked_by IS NOT NULL AND attempts <= $3 AND lease_expires_at <= now())
           )
         ORDER BY available_at, created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE outbox_events AS event
       SET attempts = attempts + 1,
           locked_by = $1,
           lease_expires_at = now() + make_interval(secs => $2),
           last_error = CASE WHEN event.locked_by IS NOT NULL THEN 'LEASE_EXPIRED' ELSE event.last_error END
       FROM candidate
       WHERE event.id = candidate.id
       RETURNING event.id, event.topic, event.aggregate_type, event.aggregate_id,
                 event.payload, event.correlation_id, event.attempts`,
      [input.workerId, input.leaseSeconds, input.maxAttempts],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          topic: row.topic,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          payload: row.payload,
          correlationId: row.correlation_id,
          attempt: row.attempts,
        }
      : null;
  }

  async markPublished(input: Readonly<{ eventId: string; workerId: string }>): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE outbox_events
       SET status = 'PUBLISHED', published_at = now(), locked_by = NULL, lease_expires_at = NULL
       WHERE id = $1 AND status = 'PENDING' AND locked_by = $2`,
      [input.eventId, input.workerId],
    );
    return result.rowCount === 1;
  }

  async retry(input: Readonly<{ eventId: string; workerId: string; errorCode: string; delayMs: number }>): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE outbox_events
       SET available_at = now() + make_interval(secs => $4 / 1000.0),
           last_error = $3, locked_by = NULL, lease_expires_at = NULL
       WHERE id = $1 AND status = 'PENDING' AND locked_by = $2`,
      [input.eventId, input.workerId, input.errorCode, input.delayMs],
    );
    return result.rowCount === 1;
  }

  async deadLetter(input: Readonly<{ eventId: string; workerId: string; errorCode: string }>): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE outbox_events
       SET status = 'DEAD_LETTER', last_error = $3, locked_by = NULL, lease_expires_at = NULL
       WHERE id = $1 AND status = 'PENDING' AND locked_by = $2`,
      [input.eventId, input.workerId, input.errorCode],
    );
    return result.rowCount === 1;
  }
}

