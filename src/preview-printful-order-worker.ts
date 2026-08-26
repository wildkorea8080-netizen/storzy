import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { PrintfulOrderJobStore } from "./orders/printful-job-store.js";
import { PreviewPrintfulOrderClient } from "./orders/preview-printful-client.js";
import { PrintfulOrderWorker } from "./orders/printful-worker.js";

const config=loadConfig(),pool=createPool(config.databaseUrl),worker=new PrintfulOrderWorker(new PrintfulOrderJobStore(pool),new PreviewPrintfulOrderClient(),`${hostname()}:${process.pid}:${randomUUID()}`,8,1000),controller=new AbortController();
for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>controller.abort());
try{while(!controller.signal.aborted){if(!await worker.tick())await new Promise(resolve=>setTimeout(resolve,config.workerPollMs));}}finally{await pool.end();}
