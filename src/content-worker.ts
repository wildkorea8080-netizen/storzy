import { randomUUID } from "node:crypto"; import { hostname } from "node:os";
import { loadConfig } from "./config.js"; import { createPool } from "./db/pool.js";
import { OpenAiStructuredOutputClient } from "./integrations/openai.js"; import { JsonLogger } from "./observability/logger.js";
import { OpenAiProductContentGenerator } from "./content/openai-generator.js"; import { PostgresContentJobStore } from "./content/postgres-job-store.js"; import { ProductContentWorker } from "./content/worker.js";
const config=loadConfig(); if(!config.openAiApiKey)throw new Error("OPENAI_API_KEY is required to start the content worker");
const pool=createPool(config.databaseUrl);const logger=new JsonLogger(config.logLevel,{service:"storzy-content-worker"});const workerId=`${hostname()}:${process.pid}:${randomUUID()}`;
const worker=new ProductContentWorker(new PostgresContentJobStore(pool),new OpenAiProductContentGenerator(new OpenAiStructuredOutputClient(config.openAiApiKey,config.openAiModel),config.openAiModel),logger,{workerId,leaseSeconds:config.generationLeaseSeconds,maxAttempts:config.generationMaxAttempts,pollMs:config.workerPollMs});
const controller=new AbortController();for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>controller.abort());
try{logger.info("content-worker.started",{workerId,model:config.openAiModel});await worker.run(controller.signal);}finally{await pool.end();logger.info("content-worker.stopped",{workerId});}
