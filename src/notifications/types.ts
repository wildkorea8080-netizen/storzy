export type OperatorNotification = Readonly<{
  id: string;
  workspaceId: string;
  revisionId: string;
  kind: "BRAND_PROFILE_REVIEW_REQUIRED";
  title: string;
  message: string;
  status: "UNREAD" | "READ";
  correlationId: string;
  readBy: string | null;
  createdAt: Date;
  readAt: Date | null;
}>;

export interface NotificationService {
  list(input: Readonly<{
    workspaceId: string;
    status?: "UNREAD" | "READ";
    limit?: number;
  }>): Promise<readonly OperatorNotification[]>;
  markRead(input: Readonly<{ workspaceId: string; notificationId: string; actorId: string }>): Promise<OperatorNotification | null>;
}

