import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { JsonLogger } from "./observability/logger.js";
import { CompositeEventSink, LogEventSink } from "./outbox/event-sinks.js";
import { PostgresOutboxQueue } from "./outbox/postgres-outbox-queue.js";
import { OutboxPublisher } from "./outbox/publisher.js";
import { PostgresDomainEventSink } from "./events/postgres-domain-event-sink.js";

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
const logger = new JsonLogger(config.logLevel, { service: "storzy-outbox", workerId });
const controller = new AbortController();
const sink = new CompositeEventSink([new PostgresDomainEventSink(pool), new LogEventSink(logger)]);
const publisher = new OutboxPublisher(new PostgresOutboxQueue(pool), sink, logger, {
  workerId,
  leaseSeconds: config.outboxLeaseSeconds,
  maxAttempts: config.outboxMaxAttempts,
  pollMs: config.outboxPollMs,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());

try {
  logger.info("outbox.started");
  await publisher.run(controller.signal);
} finally {
  await pool.end();
  logger.info("outbox.stopped");
}
