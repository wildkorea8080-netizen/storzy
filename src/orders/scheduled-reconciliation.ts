import{randomUUID}from"node:crypto";import type pg from"pg";import{fetchRecentShopifyOrders,type RemoteOrderState}from"./shopify-reconciliation.js";
type AccessProvider={resolve(workspaceId:string):Promise<Readonly<{shopDomain:string;accessToken:string}>|null>};
type Recorder={record(input:{workspaceId:string;actorId:string;windowStartedAt:Date;orders:readonly RemoteOrderState[]}):Promise<unknown>};
type FetchOrders=(input:{shopDomain:string;accessToken:string;apiVersion:string;since:Date})=>Promise<RemoteOrderState[]>;
type Result={workspaceId:string;status:"SUCCEEDED"|"FAILED";remoteOrders?:number;error?:string};
const safeError=(error:unknown,secrets:readonly string[]=[])=>{let message=error instanceof Error?error.message:"UNKNOWN_ERROR";for(const secret of secrets)if(secret)message=message.split(secret).join("[REDACTED]");return message.replace(/[\r\n\t]+/g," ").slice(0,500)||"UNKNOWN_ERROR";};
export class ScheduledOrderReconciliation{
  constructor(private readonly pool:pg.Pool,private readonly accessProvider:AccessProvider,private readonly recorder:Recorder,private readonly fetchOrders:FetchOrders=fetchRecentShopifyOrders,private readonly now:()=>Date=()=>new Date()){}
  async run(input:{hours:number;actorId:string;apiVersion:string}){
    if(!Number.isInteger(input.hours)||input.hours<1||input.hours>168||!input.actorId.trim())throw new Error("hours must be 1..168 and actorId is required");
    const client=await this.pool.connect();let locked=false,runId:string|undefined;
    try{
      const lock=await client.query<{locked:boolean}>("SELECT pg_try_advisory_lock(hashtext('storzy:order-reconciliation')) locked");locked=!!lock.rows[0]?.locked;
      if(!locked)return{skipped:true,reason:"ALREADY_RUNNING",workspaces:0,succeeded:0,failed:0,results:[]};
      const recovered=await this.pool.query("UPDATE order_reconciliation_runs SET status='FAILED',error='PROCESS_INTERRUPTED_BEFORE_COMPLETION',finished_at=$1 WHERE status='RUNNING' RETURNING id",[this.now()]),recoveredRuns=recovered.rowCount??recovered.rows.length;
      runId=randomUUID();const startedAt=this.now();
      await this.pool.query("INSERT INTO order_reconciliation_runs(id,status,window_hours,actor_id,started_at) VALUES($1,'RUNNING',$2,$3,$4)",[runId,input.hours,input.actorId.trim(),startedAt]);
      try{
        const connected=await this.pool.query<{workspace_id:string;account_label:string}>("SELECT c.workspace_id,c.account_label FROM integration_connections c JOIN workspaces w ON w.id=c.workspace_id WHERE c.provider='SHOPIFY' AND c.status='CONNECTED' AND w.status='ACTIVE' ORDER BY c.workspace_id"),since=new Date(startedAt.getTime()-input.hours*60*60*1000),results:Result[]=[];
        for(const item of connected.rows){let accessToken="";try{const access=await this.accessProvider.resolve(item.workspace_id);accessToken=access?.accessToken??"";if(!access)throw new Error("SHOPIFY_REAUTH_REQUIRED");const orders=await this.fetchOrders({...access,apiVersion:input.apiVersion,since});await this.recorder.record({workspaceId:item.workspace_id,actorId:input.actorId,windowStartedAt:since,orders});results.push({workspaceId:item.workspace_id,status:"SUCCEEDED",remoteOrders:orders.length});}catch(error){results.push({workspaceId:item.workspace_id,status:"FAILED",error:safeError(error,[accessToken])});}}
        const succeeded=results.filter(item=>item.status==="SUCCEEDED").length,failed=results.length-succeeded,status=failed===0?"SUCCEEDED":succeeded===0?"FAILED":"PARTIAL";
        await this.pool.query("UPDATE order_reconciliation_runs SET status=$2,workspace_count=$3,succeeded_count=$4,failed_count=$5,results=$6::jsonb,finished_at=$7 WHERE id=$1",[runId,status,results.length,succeeded,failed,JSON.stringify(results),this.now()]);
        return{runId,skipped:false,recoveredRuns,workspaces:results.length,succeeded,failed,results};
      }catch(error){await this.pool.query("UPDATE order_reconciliation_runs SET status='FAILED',error=$2,finished_at=$3 WHERE id=$1",[runId,safeError(error),this.now()]);throw error;}
    }finally{if(locked)await client.query("SELECT pg_advisory_unlock(hashtext('storzy:order-reconciliation'))");client.release();}
  }
}
