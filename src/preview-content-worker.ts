import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { JsonLogger } from "./observability/logger.js";
import { PostgresContentJobStore } from "./content/postgres-job-store.js";
import { PreviewProductContentGenerator } from "./content/preview-generator.js";
import { ProductContentWorker } from "./content/worker.js";

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const logger = new JsonLogger(config.logLevel, { service: "storzy-preview-content-worker" });
const workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => controller.abort());
const worker = new ProductContentWorker(new PostgresContentJobStore(pool), new PreviewProductContentGenerator(), logger, {
  workerId,
  leaseSeconds: config.generationLeaseSeconds,
  maxAttempts: config.generationMaxAttempts,
  pollMs: config.workerPollMs
});
try {
  logger.info("preview-content-worker.started", { workerId });
  await worker.run(controller.signal);
} finally {
  await pool.end();
  logger.info("preview-content-worker.stopped", { workerId });
}
