import type { OutboxEvent, OutboxQueue } from "./types.js";

type MemoryEvent = Omit<OutboxEvent, "attempt"> & {
  attempt: number;
  status: "PENDING" | "PUBLISHED" | "DEAD_LETTER";
  availableAt: Date;
  lockedBy: string | null;
  leaseExpiresAt: Date | null;
  lastError: string | null;
};

export class MemoryOutboxQueue implements OutboxQueue {
  readonly events = new Map<string, MemoryEvent>();
  constructor(private readonly now: () => Date = () => new Date()) {}

  add(event: Omit<OutboxEvent, "attempt">): void {
    this.events.set(event.id, {
      ...event,
      attempt: 0,
      status: "PENDING",
      availableAt: this.now(),
      lockedBy: null,
      leaseExpiresAt: null,
      lastError: null,
    });
  }

  async claim(input: Readonly<{ workerId: string; leaseSeconds: number; maxAttempts: number }>): Promise<OutboxEvent | null> {
    const now = this.now();
    const event = [...this.events.values()]
      .filter(
        (candidate) =>
          candidate.status === "PENDING" &&
          ((candidate.lockedBy === null && candidate.attempt < input.maxAttempts && candidate.availableAt <= now) ||
            (candidate.lockedBy !== null &&
              candidate.attempt <= input.maxAttempts &&
              candidate.leaseExpiresAt !== null &&
              candidate.leaseExpiresAt <= now)),
      )
      .sort((left, right) => left.availableAt.getTime() - right.availableAt.getTime())[0];
    if (!event) return null;
    event.attempt += 1;
    event.lockedBy = input.workerId;
    event.leaseExpiresAt = new Date(now.getTime() + input.leaseSeconds * 1_000);
    return {
      id: event.id,
      topic: event.topic,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      correlationId: event.correlationId,
      attempt: event.attempt,
    };
  }

  async markPublished(input: Readonly<{ eventId: string; workerId: string }>): Promise<boolean> {
    const event = this.owned(input.eventId, input.workerId);
    if (!event) return false;
    event.status = "PUBLISHED";
    event.lockedBy = null;
    event.leaseExpiresAt = null;
    return true;
  }

  async retry(input: Readonly<{ eventId: string; workerId: string; errorCode: string; delayMs: number }>): Promise<boolean> {
    const event = this.owned(input.eventId, input.workerId);
    if (!event) return false;
    event.availableAt = new Date(this.now().getTime() + input.delayMs);
    event.lastError = input.errorCode;
    event.lockedBy = null;
    event.leaseExpiresAt = null;
    return true;
  }

  async deadLetter(input: Readonly<{ eventId: string; workerId: string; errorCode: string }>): Promise<boolean> {
    const event = this.owned(input.eventId, input.workerId);
    if (!event) return false;
    event.status = "DEAD_LETTER";
    event.lastError = input.errorCode;
    event.lockedBy = null;
    event.leaseExpiresAt = null;
    return true;
  }

  private owned(eventId: string, workerId: string): MemoryEvent | null {
    const event = this.events.get(eventId);
    return event?.status === "PENDING" && event.lockedBy === workerId ? event : null;
  }
}
