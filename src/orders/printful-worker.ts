import { generationBackoffMs } from "../jobs/retry-policy.js";
import { ProviderHttpError } from "../integrations/http.js";
import type { PrintfulClient } from "../integrations/printful.js";
import { parsePrintfulOrder } from "./printful-response.js";
import type { PrintfulOrderJobStore } from "./printful-job-store.js";
import type {PrintfulOrderRateLimiter} from "./printful-rate-limiter.js";

export type PrintfulOrderClient=Pick<PrintfulClient,"createDraftOrder"|"getOrder"|"confirmOrder"|"deleteDraftOrder">;
export type PrintfulOrderClientResolver=PrintfulOrderClient|Readonly<{forWorkspace(workspaceId:string):Promise<PrintfulOrderClient>}>;
const resolves=(value:PrintfulOrderClientResolver):value is Readonly<{forWorkspace(workspaceId:string):Promise<PrintfulOrderClient>}>=>("forWorkspace" in value);
export class PrintfulOrderConnectionUnavailableError extends Error{constructor(){super("Workspace Printful order connection is unavailable");this.name="PrintfulOrderConnectionUnavailableError"}}
export class PrintfulOrderLeaseLostError extends Error{constructor(){super("Printful order job lease was lost");this.name="PrintfulOrderLeaseLostError"}}
export class PrintfulOrderWorker {
  constructor(private readonly store: PrintfulOrderJobStore, private readonly clients: PrintfulOrderClientResolver, private readonly workerId: string, private readonly maxAttempts = 8, private readonly maxCostIncreaseBps = 1000,private readonly rateLimiter?:Pick<PrintfulOrderRateLimiter,"acquire">) {}

  private async permit(job:Awaited<ReturnType<PrintfulOrderJobStore["claim"]>>){
    if(!job||!this.rateLimiter)return true;const decision=await this.rateLimiter.acquire(job.workspaceId);if(decision.allowed)return true;await this.store.deferRateLimit(job,this.workerId,decision.retryAfterMs);return false;
  }

  async tick() {
    const job = await this.store.claim(this.workerId, 60, this.maxAttempts);
    if (!job) return false;
    let leaseLost=false;
    const extendLease=(this.store as PrintfulOrderJobStore&{extendLease?:(id:string,worker:string,lease?:number)=>Promise<boolean>}).extendLease?.bind(this.store);
    const renew=async()=>{if(leaseLost)throw new PrintfulOrderLeaseLostError();if(extendLease&&!await extendLease(job.id,this.workerId,60)){leaseLost=true;throw new PrintfulOrderLeaseLostError()}};
    const heartbeat=extendLease?setInterval(()=>{void extendLease(job.id,this.workerId,60).then(owned=>{if(!owned)leaseLost=true}).catch(()=>{leaseLost=true})},20_000):undefined;
    heartbeat?.unref();
    try {
      if(!await this.store.automationEnabled(job.workspaceId)){await this.store.hold(job,this.workerId,"ORDER_AUTOMATION_SUSPENDED");return true}
      const client=resolves(this.clients)?await this.clients.forWorkspace(job.workspaceId):this.clients;
      if (job.phase === "PENDING_DRAFT") {
        const context = await this.store.payload(job);
        if(!await this.store.automationEnabled(job.workspaceId)){await this.store.hold(job,this.workerId,"ORDER_AUTOMATION_SUSPENDED");return true}
        let raw: unknown;
        try {
          raw = await client.getOrder(`@${job.externalId}`);
        } catch (error) {
          if (!(error instanceof ProviderHttpError) || error.status !== 404) throw error;
          if(!await this.permit(job))return true;
          await renew();
          raw = await client.createDraftOrder(context.request);
        }
        const order = parsePrintfulOrder(raw);
        if (!order.id) throw new Error("Printful returned no order id");
        await this.store.draftCreated(job, this.workerId, order.id, context.request, raw);
        return true;
      }
      if (job.phase === "WAITING_COST") {
        if (!job.remoteOrderId) throw new Error("Missing Printful order id");
        const context = await this.store.payload(job);
        if(!await this.store.automationEnabled(job.workspaceId)){await this.store.hold(job,this.workerId,"ORDER_AUTOMATION_SUSPENDED");return true}
        const order = parsePrintfulOrder(await client.getOrder(job.remoteOrderId));
        if (order.status === "failed" || order.calculationStatus === "failed") { await this.store.hold(job, this.workerId, "PRINTFUL_DRAFT_FAILED"); return true; }
        if (order.calculationStatus !== "done" || order.costMinor === null || !order.currency) { await this.store.waitCost(job.id, this.workerId); return true; }
        if (order.currency !== context.currency) { await this.store.hold(job, this.workerId, "CURRENCY_MISMATCH", order.costMinor, order.currency); return true; }
        const increase = context.approvedCostMinor > 0n ? Number(((order.costMinor - context.approvedCostMinor) * 10_000n) / context.approvedCostMinor) : 0;
        if (order.costMinor > context.revenueMinor) { await this.store.hold(job, this.workerId, "NEGATIVE_MARGIN", order.costMinor, order.currency); return true; }
        if (increase > this.maxCostIncreaseBps) { await this.store.hold(job, this.workerId, "COST_SPIKE", order.costMinor, order.currency); return true; }
        await this.store.readyConfirm(job.id, this.workerId, order.costMinor, order.currency);
        return true;
      }
      if (!job.remoteOrderId) throw new Error("Missing Printful order id");
      if(!await this.store.automationEnabled(job.workspaceId)){await this.store.hold(job,this.workerId,"ORDER_AUTOMATION_SUSPENDED");return true}
      const existingRaw=await client.getOrder(job.remoteOrderId);
      const existing=parsePrintfulOrder(existingRaw);
      if(["pending","inreview","inprocess"].includes(existing.status)){
        if(await this.store.success(job,this.workerId,existingRaw,"CONFIRMATION_RECOVERED")===false)throw new PrintfulOrderLeaseLostError();
        return true;
      }
      if(existing.status!=="draft"){await this.store.hold(job,this.workerId,`PRINTFUL_ORDER_NOT_CONFIRMABLE:${existing.status}`);return true}
      if(!await this.permit(job))return true;
      await renew();
      const raw = await client.confirmOrder(job.remoteOrderId);
      const confirmed = parsePrintfulOrder(raw);
      if (!["pending", "inreview", "inprocess"].includes(confirmed.status)) throw new Error(`Unexpected confirmed order status: ${confirmed.status}`);
      if(await this.store.success(job, this.workerId, raw)===false)throw new PrintfulOrderLeaseLostError();
      return true;
    } catch (error) {
      if(error instanceof PrintfulOrderLeaseLostError)return true;
      if(error instanceof PrintfulOrderConnectionUnavailableError){await this.store.deferConnection(job,this.workerId);return true}
      if(error instanceof ProviderHttpError&&error.status===429){await this.store.deferRateLimit(job,this.workerId,error.retryAfterMs??generationBackoffMs(job.attempt));return true}
      const transient = error instanceof ProviderHttpError && (error.status === 408 || error.status === 429 || error.status >= 500);
      if (transient && job.attempt < this.maxAttempts) await this.store.retry(job, this.workerId, generationBackoffMs(job.attempt), `PRINTFUL_${error.status}`);
      else await this.store.hold(job, this.workerId, error instanceof Error ? error.message : "PRINTFUL_ORDER_ERROR");
      return true;
    } finally {
      if(heartbeat)clearInterval(heartbeat);
    }
  }
}
