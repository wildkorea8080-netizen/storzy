import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { MockupJobStore } from "./mockups/job-store.js";
import { PreviewMockupClient } from "./mockups/preview-client.js";
import { MockupWorker } from "./mockups/worker.js";

const config=loadConfig(),pool=createPool(config.databaseUrl),worker=new MockupWorker(new MockupJobStore(pool),new PreviewMockupClient(),`${hostname()}:${process.pid}:${randomUUID()}`),controller=new AbortController();
for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>controller.abort());
try{while(!controller.signal.aborted){const worked=await worker.tick();if(!worked)await new Promise(resolve=>setTimeout(resolve,config.workerPollMs));}}finally{await pool.end();}
