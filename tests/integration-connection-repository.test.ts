import { describe, expect, it, vi } from "vitest";
import { CredentialCipher } from "../src/integrations/credential-cipher.js";
import { IntegrationConnectionRepository } from "../src/integrations/connection-repository.js";

describe("integration connection repository",()=>{
  it("stores only encrypted credentials and appends an audit action",async()=>{
    let storedCiphertext=Buffer.alloc(0),audit=false;
    const query=vi.fn(async(sql:string,params?:unknown[])=>{
      if(sql==="BEGIN"||sql==="COMMIT"||sql==="ROLLBACK")return{rows:[]};
      if(sql.startsWith("SELECT pg_advisory_xact_lock")||sql.startsWith("SELECT workspace_id FROM integration_connections"))return{rows:[]};
      if(sql.startsWith("SELECT id,status"))return{rows:[]};
      if(sql.includes("INSERT INTO integration_connections")){storedCiphertext=Buffer.from(params?.[4] as Buffer);return{rows:[{id:"connection-1",workspace_id:"workspace-1",provider:"SHOPIFY",status:"CONNECTED",account_label:"seoul.myshopify.com",metadata:{scopes:["write_products"]},updated_at:new Date("2026-08-10T00:00:00Z")}]};}
      if(sql.startsWith("INSERT INTO integration_connection_actions")){audit=true;return{rows:[]};}
      if(sql.startsWith("WITH updated")||sql.startsWith("UPDATE shopify_privacy_webhook_receipts"))return{rows:[],rowCount:0};
      throw new Error("unexpected query");
    }),client={query,release:vi.fn()},pool={connect:vi.fn(async()=>client)};
    const repository=new IntegrationConnectionRepository(pool as never,new CredentialCipher(Buffer.alloc(32,7)));
    const result=await repository.upsert({workspaceId:"workspace-1",provider:"SHOPIFY",accountLabel:"seoul.myshopify.com",credentials:{accessToken:"plain-secret"},metadata:{scopes:["write_products"]},actorId:"admin"});
    expect(result).toMatchObject({id:"connection-1",provider:"SHOPIFY",status:"CONNECTED"});
    expect(storedCiphertext.toString("utf8")).not.toContain("plain-secret");
    expect(audit).toBe(true);
    expect(query.mock.calls.some(call=>String(call[0]).includes("Automatically matched during Shopify connection"))).toBe(true);
    expect(query.mock.calls.some(call=>String(call[0]).startsWith("UPDATE shopify_privacy_webhook_receipts"))).toBe(true);
    expect(query).toHaveBeenCalledWith("COMMIT");
  });

  it("blocks the same connected Shopify shop from being owned by another workspace",async()=>{const query=vi.fn(async(sql:string)=>{if(sql==="BEGIN"||sql==="ROLLBACK"||sql.startsWith("SELECT pg_advisory_xact_lock"))return{rows:[]};if(sql.startsWith("SELECT workspace_id FROM integration_connections"))return{rows:[{workspace_id:"workspace-2"}]};throw new Error("unexpected query")}),client={query,release:vi.fn()},repository=new IntegrationConnectionRepository({connect:vi.fn(async()=>client)}as never,new CredentialCipher(Buffer.alloc(32,7)));await expect(repository.upsert({workspaceId:"workspace-1",provider:"SHOPIFY",accountLabel:"Store.MyShopify.com",credentials:{accessToken:"secret"},actorId:"admin"})).rejects.toMatchObject({code:"SHOPIFY_ACCOUNT_ALREADY_CONNECTED"});expect(query).toHaveBeenCalledWith("ROLLBACK");expect(query.mock.calls.some(call=>String(call[0]).includes("INSERT INTO integration_connections"))).toBe(false)});

  it("does not run privacy reconciliation for a Printful connection",async()=>{const query=vi.fn(async(sql:string)=>{if(sql==="BEGIN"||sql==="COMMIT")return{rows:[]};if(sql.startsWith("SELECT id,status"))return{rows:[]};if(sql.includes("INSERT INTO integration_connections"))return{rows:[{id:"connection-2",workspace_id:"workspace-1",provider:"PRINTFUL",status:"CONNECTED",account_label:"42",metadata:{},updated_at:new Date()}]};if(sql.startsWith("INSERT INTO integration_connection_actions"))return{rows:[]};throw new Error("unexpected query")}),client={query,release:vi.fn()},repository=new IntegrationConnectionRepository({connect:vi.fn(async()=>client)}as never,new CredentialCipher(Buffer.alloc(32,7)));await repository.upsert({workspaceId:"workspace-1",provider:"PRINTFUL",accountLabel:"42",credentials:{token:"secret",storeId:"42"},actorId:"admin"});expect(query.mock.calls.some(call=>String(call[0]).includes("shopify_privacy_requests"))).toBe(false)});

  it("destroys stored credentials and records the disconnect reason",async()=>{
    let updateParams:unknown[]|undefined,auditParams:unknown[]|undefined;
    const query=vi.fn(async(sql:string,params?:unknown[])=>{
      if(sql==="BEGIN"||sql==="COMMIT"||sql==="ROLLBACK")return{rows:[]};
      if(sql.startsWith("SELECT id,status"))return{rows:[{id:"connection-1",status:"CONNECTED"}]};
      if(sql.startsWith("UPDATE integration_connections")){updateParams=params;return{rows:[{id:"connection-1",workspace_id:"workspace-1",provider:"PRINTFUL",status:"DISCONNECTED",account_label:"42",metadata:{},updated_at:new Date("2026-08-10T01:00:00Z")}]};}
      if(sql.startsWith("INSERT INTO integration_connection_actions")){auditParams=params;return{rows:[]};}
      throw new Error("unexpected query");
    }),client={query,release:vi.fn()},pool={connect:vi.fn(async()=>client)};
    const repository=new IntegrationConnectionRepository(pool as never,new CredentialCipher(Buffer.alloc(32,7)));
    const result=await repository.disconnect({workspaceId:"workspace-1",provider:"PRINTFUL",actorId:"admin-ui",reason:"공급사 계정 교체"});
    expect(result).toMatchObject({provider:"PRINTFUL",status:"DISCONNECTED",metadata:{}});
    expect(updateParams?.[2]).toEqual(expect.any(Buffer));
    expect((updateParams?.[2] as Buffer).length).toBe(32);
    expect((updateParams?.[3] as Buffer).length).toBe(12);
    expect((updateParams?.[4] as Buffer).length).toBe(16);
    expect(auditParams?.slice(3)).toEqual(["PRINTFUL","admin-ui","CONNECTED","공급사 계정 교체"]);
    expect(query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("blocks Printful disconnect readiness while order or mockup work is active",async()=>{
    const pool={query:vi.fn().mockResolvedValue({rows:[{order_jobs:"2",mockup_jobs:"1"}]})};
    const repository=new IntegrationConnectionRepository(pool as never,new CredentialCipher(Buffer.alloc(32,7)));
    await expect(repository.disconnectReadiness("workspace-1","PRINTFUL")).resolves.toEqual({provider:"PRINTFUL",safe:false,blockingCount:3,blockers:{orderJobs:2,mockupJobs:1}});
    expect(pool.query.mock.calls[0]?.[0]).toContain("printful_order_jobs");
  });

  it("allows Shopify disconnect readiness when no publication or fulfillment work is active",async()=>{
    const pool={query:vi.fn().mockResolvedValue({rows:[{fulfillment_jobs:"0",publication_jobs:"0"}]})};
    const repository=new IntegrationConnectionRepository(pool as never,new CredentialCipher(Buffer.alloc(32,7)));
    await expect(repository.disconnectReadiness("workspace-1","SHOPIFY")).resolves.toEqual({provider:"SHOPIFY",safe:true,blockingCount:0,blockers:{fulfillmentJobs:0,publicationJobs:0}});
  });
  it("resolves a connected Shopify account to its workspace without credentials",async()=>{
    const pool={query:vi.fn().mockResolvedValue({rows:[{workspace_id:"workspace-1"}]})};
    const repository=new IntegrationConnectionRepository(pool as never,new CredentialCipher(Buffer.alloc(32,7)));
    await expect(repository.connectedWorkspaceForAccount("SHOPIFY","Store.MyShopify.com")).resolves.toBe("workspace-1");
    expect(pool.query.mock.calls[0]?.[0]).not.toContain("encrypted_payload");
  });
  it("prefers a recent uninstall owner for shop privacy redaction",async()=>{const pool={query:vi.fn().mockResolvedValue({rows:[{workspace_id:"workspace-old"}]})},repository=new IntegrationConnectionRepository(pool as never,new CredentialCipher(Buffer.alloc(32,7)));await expect(repository.privacyWorkspaceForShopifyAccount("store.myshopify.com",true)).resolves.toBe("workspace-old");expect(String(pool.query.mock.calls[0]?.[0])).toContain("shopify_app_uninstall_receipts");expect(String(pool.query.mock.calls[0]?.[0])).toContain("interval '7 days'")});
  it("resolves a connected Printful Store ID from non-secret metadata",async()=>{
    const pool={query:vi.fn().mockResolvedValue({rows:[{workspace_id:"workspace-2"}]})};
    const repository=new IntegrationConnectionRepository(pool as never,new CredentialCipher(Buffer.alloc(32,7)));
    await expect(repository.connectedWorkspaceForPrintfulStore("42")).resolves.toBe("workspace-2");
    expect(pool.query.mock.calls[0]?.[0]).toContain("metadata->>'storeId'");
    expect(pool.query.mock.calls[0]?.[0]).not.toContain("encrypted_payload");
  });
  it("marks a revoked connection for reauthentication without exposing or deleting encrypted credentials",async()=>{
    let updateSql="",auditParams:unknown[]|undefined;
    const query=vi.fn(async(sql:string,params?:unknown[])=>{
      if(sql==="BEGIN"||sql==="COMMIT"||sql==="ROLLBACK")return{rows:[]};
      if(sql.startsWith("SELECT id,status"))return{rows:[{id:"connection-1",status:"CONNECTED"}]};
      if(sql.startsWith("UPDATE integration_connections")){updateSql=sql;return{rows:[{id:"connection-1",workspace_id:"workspace-1",provider:"SHOPIFY",status:"REAUTH_REQUIRED",account_label:"seoul.myshopify.com",metadata:{reauthReason:"refresh token expired"},updated_at:new Date("2026-08-12T00:00:00Z")}]};}
      if(sql.startsWith("INSERT INTO integration_connection_actions")){auditParams=params;return{rows:[]};}
      throw new Error("unexpected query");
    }),client={query,release:vi.fn()},repository=new IntegrationConnectionRepository({connect:vi.fn(async()=>client)} as never,new CredentialCipher(Buffer.alloc(32,7)));
    await expect(repository.markReauthRequired({workspaceId:"workspace-1",provider:"SHOPIFY",actorId:"shopify-token-refresh",reason:"refresh token expired"})).resolves.toMatchObject({status:"REAUTH_REQUIRED"});
    expect(updateSql).not.toContain("encrypted_payload");expect(auditParams?.slice(3)).toEqual(["SHOPIFY","shopify-token-refresh","CONNECTED","refresh token expired"]);expect(query).toHaveBeenCalledWith("COMMIT");
  });
  it("holds and always releases a workspace credential rotation advisory lock",async()=>{const query=vi.fn().mockResolvedValue({rows:[]}),client={query,release:vi.fn()},repository=new IntegrationConnectionRepository({connect:vi.fn(async()=>client)} as never,new CredentialCipher(Buffer.alloc(32,7))),failure=new Error("refresh failed");await expect(repository.withCredentialRotationLock("workspace-1","SHOPIFY",async()=>{throw failure})).rejects.toBe(failure);expect(query).toHaveBeenNthCalledWith(1,"SELECT pg_advisory_lock(hashtext($1))",["storzy:credential-rotation:workspace-1:SHOPIFY"]);expect(query).toHaveBeenNthCalledWith(2,"SELECT pg_advisory_unlock(hashtext($1))",["storzy:credential-rotation:workspace-1:SHOPIFY"]);expect(client.release).toHaveBeenCalledOnce()});
  it("increments sanitized refresh failure metadata for connected credentials",async()=>{const query=vi.fn().mockResolvedValue({rows:[]}),repository=new IntegrationConnectionRepository({query} as never,new CredentialCipher(Buffer.alloc(32,7)));await repository.recordCredentialRefreshFailure({workspaceId:"workspace-1",provider:"SHOPIFY",error:"timeout\nsecret-safe-context"});expect(String(query.mock.calls[0]?.[0])).toContain("refreshFailureCount");expect(query.mock.calls[0]?.[1]).toEqual(["workspace-1","SHOPIFY","timeout secret-safe-context"])});
});
