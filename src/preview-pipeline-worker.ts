import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { CandidateWorker } from "./candidates/worker.js";
import { PostgresCandidateJobStore } from "./candidates/postgres-job-store.js";
import type { CatalogProduct, CatalogProvider } from "./candidates/types.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { PostgresDomainEventSink } from "./events/postgres-domain-event-sink.js";
import { JsonLogger } from "./observability/logger.js";
import { CompositeEventSink, LogEventSink } from "./outbox/event-sinks.js";
import { PostgresOutboxQueue } from "./outbox/postgres-outbox-queue.js";
import { OutboxPublisher } from "./outbox/publisher.js";

const config=loadConfig(),pool=createPool(config.databaseUrl),logger=new JsonLogger(config.logLevel,{service:"storzy-preview-pipeline"}),controller=new AbortController(),workerId=`preview-pipeline:${hostname()}:${process.pid}:${randomUUID()}`;
const products:CatalogProduct[]=[
  product("71","t-shirt","프리미엄 반팔 티셔츠",1450,450,["S","M","L","XL"],["Black","White","Gray"]),
  product("146","hoodie","유니섹스 후드티",2850,650,["S","M","L","XL"],["Black","White"]),
  product("205","tote bag","에코 토트백",1200,400,["One size"],["Black","Natural"]),
  product("304","poster","매트 포스터",800,350,["12×16","18×24"],["White"]),
];
function product(externalProductId:string,productType:string,name:string,baseCostMinor:number,shippingReserveMinor:number,sizes:string[],colors:string[]):CatalogProduct{return{externalProductId,productType,name,currency:"USD",baseCostMinor,shippingReserveMinor,shippingCountries:["US","JP","KR"],placements:["front"],placementGuidelines:[{placement:"front",technique:"dtg",printAreaWidthIn:12,printAreaHeightIn:16,targetDpi:150,allowedMockupStyleIds:[1,2]}],sizes,colors,returnRisk:productType==="hoodie"?"MEDIUM":"LOW",costSource:"APPROVED_FALLBACK",selectedTechnique:"dtg",variantCount:sizes.length*colors.length,availableVariantCount:sizes.length*colors.length,stockByMarket:{US:20,JP:20,KR:20},stockRegionByMarket:{US:"north_america",JP:"japan",KR:"republic_of_korea"},catalogVariants:sizes.flatMap((size,sizeIndex)=>colors.map((color,colorIndex)=>({externalVariantId:`${externalProductId}${sizeIndex}${colorIndex}`,size,color,imageUrl:null})))}};
const catalog:CatalogProvider={async fetchSnapshot(currency){return{provider:"FIXTURE",currency,fetchedAt:new Date(),products}}};
const outbox=new OutboxPublisher(new PostgresOutboxQueue(pool),new CompositeEventSink([new PostgresDomainEventSink(pool),new LogEventSink(logger)]),logger,{workerId:`${workerId}:outbox`,leaseSeconds:30,maxAttempts:4,pollMs:500});
const candidates=new CandidateWorker(new PostgresCandidateJobStore(pool),catalog,logger,{workerId:`${workerId}:candidate`,leaseSeconds:30,maxAttempts:4,pollMs:500,currency:"USD"});
for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>controller.abort());
try{await Promise.all([outbox.run(controller.signal),candidates.run(controller.signal)])}finally{await pool.end()}
