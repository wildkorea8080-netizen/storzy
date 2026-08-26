import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { JsonLogger } from "./observability/logger.js";
import { OutboxOperations } from "./outbox/operations.js";

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const logger = new JsonLogger(config.logLevel, { service: "storzy-outbox-admin" });
const operations = new OutboxOperations(pool);
const [command, ...args] = process.argv.slice(2);

try {
  if (command === "list") {
    const limit = args[0] ? Number(args[0]) : 50;
    const events = await operations.listDeadLetters(limit);
    process.stdout.write(`${JSON.stringify(events, null, 2)}\n`);
  } else if (command === "requeue") {
    const [eventId, actorId, ...reasonParts] = args;
    const reason = reasonParts.join(" ");
    if (!eventId || !actorId || !reason) {
      throw new Error("Usage: npm run outbox:requeue -- <event-id> <actor-id> <reason>");
    }
    const requeued = await operations.requeue({ eventId, actorId, reason });
    if (!requeued) throw new Error("Dead-letter event was not found or is no longer dead-lettered");
    logger.info("outbox.requeued", { eventId, actorId, reason });
  } else {
    throw new Error("Usage: outbox-admin <list [limit] | requeue event-id actor-id reason>");
  }
} finally {
  await pool.end();
}

