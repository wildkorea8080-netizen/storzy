import {randomUUID} from "node:crypto";
import {afterAll,describe,expect,it} from "vitest";
import {createPool} from "../src/db/pool.js";

const databaseUrl=process.env.TEST_DATABASE_URL;
const pool=databaseUrl?createPool(databaseUrl):null;
const suite=databaseUrl?describe:describe.skip;
afterAll(async()=>pool?.end());

suite("integration loss automation safety on PostgreSQL",()=>{
  it("disables an approved workspace and records the responsible actor",async()=>{
    if(!pool)throw new Error("TEST_DATABASE_URL is required");
    const client=await pool.connect(),workspaceId=randomUUID(),connectionId=randomUUID();
    try{
      await client.query("BEGIN");
      await client.query("INSERT INTO workspaces(id,name) VALUES($1,$2)",[workspaceId,"Automation trigger test"]);
      await client.query(`INSERT INTO integration_connections(id,workspace_id,provider,account_label,encrypted_payload,encryption_iv,encryption_auth_tag,encryption_key_version,created_by,updated_by) VALUES($1,$2,'SHOPIFY','test.myshopify.com',decode(repeat('00',32),'hex'),decode(repeat('00',12),'hex'),decode(repeat('00',16),'hex'),'test','test','test')`,[connectionId,workspaceId]);
      await client.query("INSERT INTO workspace_order_automation_controls(workspace_id,enabled,approved_by,approved_at,reason) VALUES($1,true,'operator',now(),'pilot approved')",[workspaceId]);
      await client.query("UPDATE integration_connections SET status='REAUTH_REQUIRED',updated_by='token-refresh' WHERE id=$1",[connectionId]);
      const result=await client.query<{enabled:boolean;reason:string;actor_id:string}>(`SELECT c.enabled,c.reason,a.actor_id FROM workspace_order_automation_controls c JOIN workspace_order_automation_actions a ON a.workspace_id=c.workspace_id AND a.action='DISABLE' WHERE c.workspace_id=$1`,[workspaceId]);
      expect(result.rows[0]).toMatchObject({enabled:false,reason:"SHOPIFY 재인증 필요로 자동 중지",actor_id:"token-refresh"});
    }finally{await client.query("ROLLBACK");client.release()}
  });
});
