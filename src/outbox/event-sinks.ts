import type { Logger } from "../observability/logger.js";
import type { EventSink, OutboxEvent } from "./types.js";

export class PermanentDeliveryError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export class LogEventSink implements EventSink {
  constructor(private readonly logger: Logger) {}
  async publish(event: OutboxEvent): Promise<void> {
    this.logger.info("outbox.event", {
      eventId: event.id,
      topic: event.topic,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      correlationId: event.correlationId,
    });
  }
}

export class CompositeEventSink implements EventSink {
  constructor(private readonly sinks: readonly EventSink[]) {}
  async publish(event: OutboxEvent): Promise<void> {
    for (const sink of this.sinks) await sink.publish(event);
  }
}
