import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { OpenAiBrandProfileGenerator } from "./brand/openai-generator.js";
import { PostgresBrandProfileStore } from "./brand/postgres-store.js";
import { BrandProfileService } from "./brand/service.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { GenerationWorker } from "./jobs/generation-worker.js";
import { PostgresGenerationJobQueue } from "./jobs/postgres-generation-queue.js";
import { OpenAiStructuredOutputClient } from "./integrations/openai.js";
import { JsonLogger } from "./observability/logger.js";

const config = loadConfig();
if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is required to start the generation worker");

const pool = createPool(config.databaseUrl);
const logger = new JsonLogger(config.logLevel, { service: "storzy-generation-worker" });
const service = new BrandProfileService(new PostgresBrandProfileStore(pool));
const generator = new OpenAiBrandProfileGenerator(
  new OpenAiStructuredOutputClient(config.openAiApiKey, config.openAiModel),
  config.openAiModel,
);
const controller = new AbortController();
const workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
const worker = new GenerationWorker(new PostgresGenerationJobQueue(pool), service, generator, {
  workerId,
  leaseSeconds: config.generationLeaseSeconds,
  maxAttempts: config.generationMaxAttempts,
  pollMs: config.workerPollMs,
  onError: (error) => logger.error("generation-worker.error", { workerId, error }),
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => controller.abort());
}

try {
  logger.info("generation-worker.started", { workerId });
  await worker.run(controller.signal);
} finally {
  await pool.end();
  logger.info("generation-worker.stopped", { workerId });
}
