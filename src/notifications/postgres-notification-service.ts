import type pg from "pg";
import type { NotificationService, OperatorNotification } from "./types.js";

type NotificationRow = {
  id: string;
  workspace_id: string;
  revision_id: string;
  kind: OperatorNotification["kind"];
  title: string;
  message: string;
  status: OperatorNotification["status"];
  correlation_id: string;
  read_by: string | null;
  created_at: Date;
  read_at: Date | null;
};

const SELECT_FIELDS = `id, workspace_id, revision_id, kind, title, message, status,
  correlation_id, read_by, created_at, read_at`;

function map(row: NotificationRow): OperatorNotification {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    revisionId: row.revision_id,
    kind: row.kind,
    title: row.title,
    message: row.message,
    status: row.status,
    correlationId: row.correlation_id,
    readBy: row.read_by,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export class PostgresNotificationService implements NotificationService {
  constructor(private readonly pool: pg.Pool) {}

  async list(input: Readonly<{ workspaceId: string; status?: "UNREAD" | "READ"; limit?: number }>): Promise<readonly OperatorNotification[]> {
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("notification limit must be between 1 and 100");
    const result = await this.pool.query<NotificationRow>(
      `SELECT ${SELECT_FIELDS} FROM operator_notifications
       WHERE workspace_id = $1 AND ($2::text IS NULL OR status = $2)
       ORDER BY created_at DESC LIMIT $3`,
      [input.workspaceId, input.status ?? null, limit],
    );
    return result.rows.map(map);
  }

  async markRead(input: Readonly<{ workspaceId: string; notificationId: string; actorId: string }>): Promise<OperatorNotification | null> {
    const result = await this.pool.query<NotificationRow>(
      `UPDATE operator_notifications
       SET status = 'READ', read_by = COALESCE(read_by, $3), read_at = COALESCE(read_at, now())
       WHERE id = $1 AND workspace_id = $2
       RETURNING ${SELECT_FIELDS}`,
      [input.notificationId, input.workspaceId, input.actorId],
    );
    return result.rows[0] ? map(result.rows[0]) : null;
  }
}

