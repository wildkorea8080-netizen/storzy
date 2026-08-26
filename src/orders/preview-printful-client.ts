import { createHash } from "node:crypto";
import { ProviderHttpError } from "../integrations/http.js";
import type { PrintfulOrderClient } from "./printful-worker.js";

type Saved=Readonly<{id:string;externalId:string;cost:string;currency:string}>;
export class PreviewPrintfulOrderClient implements PrintfulOrderClient{
  private readonly byId=new Map<string,Saved>();private readonly byExternal=new Map<string,Saved>();
  async createDraftOrder(payload:unknown):Promise<unknown>{const body=payload as {external_id?:unknown;order_items?:Array<{quantity?:unknown}>;retail_costs?:{currency?:unknown}},externalId=String(body.external_id??""),id=createHash("sha256").update(externalId).digest("hex").slice(0,12),quantity=(body.order_items??[]).reduce((sum,item)=>sum+Number(item.quantity??0),0),saved={id,externalId,cost:(16*quantity).toFixed(2),currency:String(body.retail_costs?.currency??"USD")};this.byId.set(id,saved);this.byExternal.set(externalId,saved);return this.response(saved,"draft","calculating")}
  async getOrder(orderId:string):Promise<unknown>{const saved=orderId.startsWith("@")?this.byExternal.get(orderId.slice(1)):this.byId.get(orderId);if(!saved)throw new ProviderHttpError("printful",404,"preview order not found");return this.response(saved,"draft","done")}
  async confirmOrder(orderId:string):Promise<unknown>{const saved=this.byId.get(orderId);if(!saved)throw new ProviderHttpError("printful",404,"preview order not found");return this.response(saved,"pending","done")}
  async deleteDraftOrder(orderId:string):Promise<void>{const saved=this.byId.get(orderId);if(!saved)throw new ProviderHttpError("printful",404,"preview order not found");this.byId.delete(orderId);this.byExternal.delete(saved.externalId)}
  private response(saved:Saved,status:string,calculationStatus:string){return{data:{id:saved.id,external_id:saved.externalId,status,costs:{calculation_status:calculationStatus,currency:saved.currency,total:calculationStatus==="done"?saved.cost:null}}}}
}
