import type pg from "pg";
import type { IntegrationConnectionRepository } from "../integrations/connection-repository.js";
import { verifyPrintfulWebhook } from "../integrations/printful.js";
import { PrintfulFulfillmentHandler } from "../fulfillment/printful-handler.js";
import { PrintfulMockupWebhookService } from "./webhook-service.js";

export class PrintfulWebhookRouter{
  constructor(private readonly pool:pg.Pool,private readonly secretHex:string,private readonly publicKey:string|undefined,private readonly connections:IntegrationConnectionRepository){}
  async receive(raw:Buffer,headers:Readonly<{signature?:string;publicKey?:string}>){
    if(!headers.signature||!verifyPrintfulWebhook(raw,headers.signature,this.secretHex))throw Object.assign(new Error("Invalid Printful webhook signature"),{status:401});
    if(this.publicKey&&headers.publicKey!==this.publicKey)throw Object.assign(new Error("Unknown Printful webhook public key"),{status:401});
    let body:Record<string,unknown>;
    try{body=JSON.parse(raw.toString("utf8")) as Record<string,unknown>;}catch{throw Object.assign(new Error("Invalid webhook JSON"),{status:400});}
    const storeId=String(body.store_id??"").trim();
    if(!/^[0-9]{1,20}$/.test(storeId))throw Object.assign(new Error("Invalid Printful store id"),{status:400});
    const workspaceId=await this.connections.connectedWorkspaceForPrintfulStore(storeId);
    if(!workspaceId)throw Object.assign(new Error("Printful store is not connected to an active workspace"),{status:400});
    return new PrintfulMockupWebhookService(this.pool,this.secretHex,this.publicKey,new PrintfulFulfillmentHandler(this.pool),workspaceId).receive(raw,headers);
  }
}
