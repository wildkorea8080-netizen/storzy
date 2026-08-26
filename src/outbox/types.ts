export type OutboxEvent = Readonly<{
  id: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId: string;
  attempt: number;
}>;

export interface OutboxQueue {
  claim(input: Readonly<{ workerId: string; leaseSeconds: number; maxAttempts: number }>): Promise<OutboxEvent | null>;
  markPublished(input: Readonly<{ eventId: string; workerId: string }>): Promise<boolean>;
  retry(input: Readonly<{ eventId: string; workerId: string; errorCode: string; delayMs: number }>): Promise<boolean>;
  deadLetter(input: Readonly<{ eventId: string; workerId: string; errorCode: string }>): Promise<boolean>;
}

export interface EventSink {
  publish(event: OutboxEvent): Promise<void>;
}

