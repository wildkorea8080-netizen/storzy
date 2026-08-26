import type { NotificationService, OperatorNotification } from "./types.js";

export class MemoryNotificationService implements NotificationService {
  readonly notifications = new Map<string, OperatorNotification>();

  async list(input: Readonly<{ workspaceId: string; status?: "UNREAD" | "READ"; limit?: number }>): Promise<readonly OperatorNotification[]> {
    return [...this.notifications.values()]
      .filter((item) => item.workspaceId === input.workspaceId && (!input.status || item.status === input.status))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, input.limit ?? 50);
  }

  async markRead(input: Readonly<{ workspaceId: string; notificationId: string; actorId: string }>): Promise<OperatorNotification | null> {
    const item = this.notifications.get(input.notificationId);
    if (!item || item.workspaceId !== input.workspaceId) return null;
    const updated: OperatorNotification = {
      ...item,
      status: "READ",
      readBy: item.readBy ?? input.actorId,
      readAt: item.readAt ?? new Date(),
    };
    this.notifications.set(updated.id, updated);
    return updated;
  }
}

