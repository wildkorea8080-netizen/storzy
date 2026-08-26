import type{PrintfulClient}from"../integrations/printful.js";
import{ProviderHttpError}from"../integrations/http.js";
import{generationBackoffMs}from"../jobs/retry-policy.js";
import{parseCreatedTaskIds,parseMockupTasks}from"./response.js";
import type{MockupJobStore}from"./job-store.js";

export type MockupClient=Pick<PrintfulClient,"createMockupTask"|"getMockupTasks">;
export class PrintfulConnectionUnavailableError extends Error{constructor(){super("Workspace Printful connection is unavailable");this.name="PrintfulConnectionUnavailableError"}}
export type MockupClientResolver=MockupClient|Readonly<{forWorkspace(workspaceId:string):Promise<MockupClient>}>;
const resolves=(value:MockupClientResolver):value is Readonly<{forWorkspace(workspaceId:string):Promise<MockupClient>}>=>("forWorkspace" in value);

export class MockupWorker{
  constructor(private readonly store:MockupJobStore,private readonly clients:MockupClientResolver,private readonly workerId:string,private readonly maxAttempts=8){}
  async tick(){
    const job=await this.store.claim(this.workerId,60,this.maxAttempts);if(!job)return false;
    try{
      const client=resolves(this.clients)?await this.clients.forWorkspace(job.workspaceId):this.clients;
      if(!job.remoteTaskIds){const ids=parseCreatedTaskIds(await client.createMockupTask(await this.store.createPayload(job)));if(!ids.length)throw new Error("Printful returned no mockup task ids");await this.store.waiting(job.id,this.workerId,ids);return true}
      const tasks=parseMockupTasks(await client.getMockupTasks(job.remoteTaskIds));
      if(tasks.some(t=>t.failureReasons.length||t.status==="failed"))throw new Error("Printful mockup task failed");
      if(!tasks.length||tasks.some(t=>t.status!=="completed")){await this.store.waiting(job.id,this.workerId,job.remoteTaskIds);return true}
      const images=tasks.flatMap(t=>t.images);if(!images.length)throw new Error("Printful completed without mockup images");await this.store.complete(job,this.workerId,images);return true;
    }catch(error){
      if(error instanceof PrintfulConnectionUnavailableError){await this.store.deferConnection(job.id,this.workerId);return true}
      if(error instanceof ProviderHttpError&&error.status===429){await this.store.deferRateLimit(job.id,this.workerId,error.retryAfterMs??generationBackoffMs(job.attempt));return true}
      if(error instanceof ProviderHttpError&&(error.status===408||error.status>=500)&&job.attempt<this.maxAttempts){await this.store.retry(job,this.workerId,generationBackoffMs(job.attempt),`PRINTFUL_${error.status}`);return true}
      await this.store.fail(job.id,this.workerId,error instanceof Error?error.message:"UNKNOWN");return true;
    }
  }
}
