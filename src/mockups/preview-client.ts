import { randomUUID } from "node:crypto";
import type { MockupClient } from "./worker.js";

type Task = Readonly<{variantIds:string[];placement:string;styleId:number}>;
export class PreviewMockupClient implements MockupClient {
  private readonly tasks=new Map<string,Task>();
  async createMockupTask(payload:unknown):Promise<unknown>{
    const root=payload as {products?:Array<{catalog_variant_ids?:unknown[];mockup_style_ids?:unknown[];placements?:Array<{placement?:unknown}>}>};
    const product=root.products?.[0],id=`preview-${randomUUID()}`;
    this.tasks.set(id,{variantIds:(product?.catalog_variant_ids??[]).map(String),placement:String(product?.placements?.[0]?.placement??"front"),styleId:Number(product?.mockup_style_ids?.[0]??1)});
    return{data:[{id}]};
  }
  async getMockupTasks(ids:readonly string[]):Promise<unknown>{
    return{data:ids.map(id=>{const task=this.tasks.get(id)??{variantIds:["preview-variant"],placement:"front",styleId:1};return{id,status:"completed",failure_reasons:[],catalog_variant_mockups:task.variantIds.map(catalog_variant_id=>({catalog_variant_id,mockups:[{placement:task.placement,style_id:task.styleId,mockup_url:`https://preview-assets.storzy.local/mockups/${encodeURIComponent(catalog_variant_id)}.jpg`}]}))}})};
  }
}
