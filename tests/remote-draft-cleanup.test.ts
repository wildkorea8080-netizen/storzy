import {describe,expect,it,vi} from "vitest";
import {RemoteDraftCleanupService} from "../src/orders/remote-draft-cleanup.js";

const draft=(status:string)=>({data:{id:99,status,costs:{calculation_status:"done",currency:"USD",total:"10.00"}}});
function fixture(status="draft",duplicate=false){
  const calls:string[]=[];
  const query=vi.fn(async(sql:string)=>{
    calls.push(sql);
    if(sql.includes("cleanup_actions")&&sql.startsWith("SELECT"))return{rows:duplicate?[{id:"action-1"}]:[]};
    if(sql.includes("FROM printful_order_jobs j"))return{rows:[{job_id:"job-1",remote_order_id:"99"}]};
    if(sql.includes("FROM printful_order_jobs WHERE id="))return{rows:[{id:"job-1"}]};
    return{rows:[]};
  });
  const client={query,release:vi.fn()},pool={query,connect:vi.fn().mockResolvedValue(client)},remote={getOrder:vi.fn().mockResolvedValue(draft(status)),deleteDraftOrder:vi.fn().mockResolvedValue(undefined)};
  return{service:new RemoteDraftCleanupService(pool as never,{forWorkspace:vi.fn().mockResolvedValue(remote)}),query,calls,client,remote};
}
const input={workspaceId:"workspace-1",orderId:"order-1",actorId:"operator",reason:"automation stopped",idempotencyKey:"cleanup-1"};

describe("Printful remote draft cleanup",()=>{
  it("lists a bounded order audit history newest first",async()=>{
    const{service,query}=fixture();query.mockResolvedValueOnce({rows:[{id:"action-1",remote_order_id:"99"}]} as never);
    await expect(service.list("workspace-1","order-1",10)).resolves.toEqual([{id:"action-1",remote_order_id:"99"}]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("ORDER BY created_at DESC LIMIT $3"),["workspace-1","order-1",10]);
  });
  it("rejects oversized audit fields before acquiring a database connection",async()=>{
    const{service}=fixture();
    await expect(service.cleanup({...input,actorId:"a".repeat(121)})).rejects.toMatchObject({code:"INVALID_INPUT"});
    await expect(service.cleanup({...input,reason:"r".repeat(501)})).rejects.toMatchObject({code:"INVALID_INPUT"});
  });
  it("serializes the remote deletion and audits local cleanup",async()=>{
    const{service,query,calls,client,remote}=fixture();
    await expect(service.cleanup(input)).resolves.toMatchObject({cleaned:true,duplicate:false});
    expect(remote.deleteDraftOrder).toHaveBeenCalledWith("99");
    expect(calls.indexOf("SELECT pg_advisory_lock(hashtext($1))")).toBeLessThan(calls.findIndex(sql=>sql.includes("FROM printful_order_jobs j")));
    expect(query.mock.calls.some(call=>String(call[0]).includes("REMOTE_DRAFT_CLEANED"))).toBe(true);
    expect(calls.at(-1)).toBe("SELECT pg_advisory_unlock(hashtext($1))");
    expect(client.release).toHaveBeenCalledOnce();
  });
  it("returns an idempotent result inside the lock without calling Printful",async()=>{
    const{service,remote,calls,client}=fixture("draft",true);
    await expect(service.cleanup(input)).resolves.toEqual({cleaned:true,duplicate:true});
    expect(remote.getOrder).not.toHaveBeenCalled();expect(remote.deleteDraftOrder).not.toHaveBeenCalled();
    expect(calls.at(-1)).toBe("SELECT pg_advisory_unlock(hashtext($1))");expect(client.release).toHaveBeenCalledOnce();
  });
  it("refuses to delete an order already in review and still releases the lock",async()=>{
    const{service,remote,calls,client}=fixture("inreview");
    await expect(service.cleanup({...input,idempotencyKey:"cleanup-2"})).rejects.toMatchObject({code:"REMOTE_ORDER_NOT_DELETABLE"});
    expect(remote.deleteDraftOrder).not.toHaveBeenCalled();expect(calls.at(-1)).toBe("SELECT pg_advisory_unlock(hashtext($1))");expect(client.release).toHaveBeenCalledOnce();
  });
});
