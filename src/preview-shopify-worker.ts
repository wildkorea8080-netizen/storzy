import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { JsonLogger } from "./observability/logger.js";
import { ShopifyJobStore } from "./shopify/job-store.js";
import { ShopifyProductPublisher } from "./shopify/publisher.js";
import { createPreviewShopifyClient } from "./shopify/preview-client.js";
import { ShopifyPublicationWorker } from "./shopify/worker.js";

const config=loadConfig(),pool=createPool(config.databaseUrl),logger=new JsonLogger(config.logLevel,{service:"storzy-preview-shopify-worker"}),controller=new AbortController();
for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>controller.abort());
const worker=new ShopifyPublicationWorker(new ShopifyJobStore(pool),new ShopifyProductPublisher(createPreviewShopifyClient()),logger,{workerId:`${hostname()}:${process.pid}:${randomUUID()}`,leaseSeconds:120,maxAttempts:4,pollMs:config.workerPollMs});
try{await worker.run(controller.signal);}finally{await pool.end();}
