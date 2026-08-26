import { readFileSync } from "node:fs"; import { describe,expect,it } from "vitest";
import { ProductContentWorker } from "../src/content/worker.js"; import type { ContentGeneration,ContentJob,ContentJobStore } from "../src/content/types.js"; import { NoopLogger } from "../src/observability/logger.js";
const valid=JSON.parse(readFileSync(new URL("./fixtures/product-content.valid.json",import.meta.url),"utf8")) as Record<string,unknown>;
class Store implements ContentJobStore{
  job:ContentJob|null={id:"job-1",candidateId:"candidate-1",correlationId:"corr",attempt:1};status="PENDING";error:string|null=null;generation:ContentGeneration|null=null;
  async claim(){const j=this.job;this.job=null;if(j)this.status="RUNNING";return j;}
  async loadContext(){return {profile:{brand_name:"Seoul Side"},candidate:{product_type:"t-shirt"},recommendedRetailMinor:3900,currency:"USD"};}
  async extendLease(){return true;} async complete(input:{generation:ContentGeneration}){this.status="SUCCEEDED";this.generation=input.generation;return true;}
  async retry(input:{errorCode:string}){this.status="PENDING";this.error=input.errorCode;return true;} async fail(input:{errorCode:string}){this.status="FAILED";this.error=input.errorCode;return true;}
}
describe("product content worker",()=>{
  it("validates and persists structured product content",async()=>{const store=new Store();const data=structuredClone(valid);(data.pricing_hint as Record<string,unknown>).suggested_retail_minor=3900;
    const worker=new ProductContentWorker(store,{async generate(){return{data,promptVersion:"product-content.v1",model:"fixture"};}},new NoopLogger(),{workerId:"w",leaseSeconds:30,maxAttempts:4,pollMs:100});
    await worker.processOne();expect(store.status).toBe("SUCCEEDED");expect(store.generation?.data).toEqual(data);
  });
  it("fails content that changes authoritative pricing",async()=>{const store=new Store();const data=structuredClone(valid);(data.pricing_hint as Record<string,unknown>).suggested_retail_minor=9999;
    const worker=new ProductContentWorker(store,{async generate(){return{data,promptVersion:"v1",model:"fixture"};}},new NoopLogger(),{workerId:"w",leaseSeconds:30,maxAttempts:4,pollMs:100});
    await worker.processOne();expect(store).toMatchObject({status:"FAILED",error:"AUTHORITATIVE_PRICE_MISMATCH"});
  });
});
