import { assertSchema, SchemaValidationError } from "../ai/schema-registry.js";
import { generationBackoffMs } from "../jobs/retry-policy.js";
import type { Logger } from "../observability/logger.js";
import type { ContentJobStore, ProductContentGenerator } from "./types.js";

export class ProductContentWorker {
  constructor(private readonly store:ContentJobStore,private readonly generator:ProductContentGenerator,private readonly logger:Logger,
    private readonly options:Readonly<{workerId:string;leaseSeconds:number;maxAttempts:number;pollMs:number;random?:()=>number}> ){}
  async processOne():Promise<boolean>{
    const job=await this.store.claim({workerId:this.options.workerId,leaseSeconds:this.options.leaseSeconds,maxAttempts:this.options.maxAttempts}); if(!job)return false;
    const log=this.logger.child({jobId:job.id,candidateId:job.candidateId,correlationId:job.correlationId,attempt:job.attempt});
    if(job.attempt>this.options.maxAttempts){await this.store.fail({jobId:job.id,workerId:this.options.workerId,errorCode:"LEASE_EXHAUSTED"});return true;}
    const heartbeat=setInterval(()=>void this.store.extendLease({jobId:job.id,workerId:this.options.workerId,leaseSeconds:this.options.leaseSeconds}).catch(error=>log.error("content-job.heartbeat-failed",{error})),Math.max(1000,Math.floor(this.options.leaseSeconds*1000/3)));heartbeat.unref();
    try{
      try{
        const context=await this.store.loadContext(job.candidateId); const generation=await this.generator.generate(context);
        assertSchema("productContent",generation.data);
        const pricing=generation.data.pricing_hint as Record<string,unknown>;
        if(pricing.currency!==context.currency||pricing.suggested_retail_minor!==context.recommendedRetailMinor) throw new Error("AUTHORITATIVE_PRICE_MISMATCH");
        if(!await this.store.complete({job,workerId:this.options.workerId,generation}))throw new Error(`Lost content job lease: ${job.id}`);
        log.info("content-job.succeeded",{model:generation.model});
      }catch(error){
        const status=error&&typeof error==="object"&&"status" in error?Number((error as {status:unknown}).status):null;
        const permanent=error instanceof SchemaValidationError||(error instanceof Error&&error.message==="AUTHORITATIVE_PRICE_MISMATCH")||(status!==null&&status>=400&&status<500&&status!==408&&status!==429);
        const code=error instanceof SchemaValidationError?"SCHEMA_VALIDATION_FAILED":error instanceof Error&&error.message==="AUTHORITATIVE_PRICE_MISMATCH"?"AUTHORITATIVE_PRICE_MISMATCH":status?`OPENAI_HTTP_${status}`:error instanceof Error?error.name:"CONTENT_ERROR";
        if(!permanent&&job.attempt<this.options.maxAttempts){await this.store.retry({jobId:job.id,workerId:this.options.workerId,errorCode:code,delayMs:generationBackoffMs(job.attempt,this.options.random)});}
        else await this.store.fail({jobId:job.id,workerId:this.options.workerId,errorCode:code});
      }
    }finally{clearInterval(heartbeat);} return true;
  }
  async run(signal:AbortSignal):Promise<void>{while(!signal.aborted){const done=await this.processOne().catch(error=>{this.logger.error("content-worker.error",{error});return false;});if(!done)await new Promise(resolve=>setTimeout(resolve,this.options.pollMs));}}
}
