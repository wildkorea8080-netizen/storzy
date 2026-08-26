import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import {afterEach,describe,expect,it,vi} from "vitest";
import {AdminSessionService} from "../src/auth/admin-session-service.js";
import {BrandProfileService} from "../src/brand/service.js";
import {MemoryBrandProfileStore} from "../src/brand/memory-store.js";
import {createApp} from "../src/http/app.js";

const servers:ReturnType<typeof createServer>[]=[];
afterEach(async()=>Promise.all(servers.splice(0).map(server=>new Promise<void>(resolve=>server.close(()=>resolve())))));

describe("admin sessions",()=>{
  it("stores only a digest and issues an HttpOnly strict cookie",async()=>{
    const query=vi.fn().mockResolvedValue({rows:[],rowCount:1});
    const service=new AdminSessionService({query} as never,{ttlSeconds:3600,secure:true});
    const created=await service.create(new Date("2026-08-21T00:00:00.000Z"));
    const parameters=query.mock.calls[0]?.[1] as unknown[];
    const rawToken=created.setCookie.match(/storzy_admin_session=([^;]+)/)?.[1];
    expect(parameters[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(parameters).not.toContain(rawToken);
    expect(created.setCookie).toContain("HttpOnly");
    expect(created.setCookie).toContain("SameSite=Strict");
    expect(created.setCookie).toContain("Secure");
  });

  it("accepts a server session cookie on protected APIs and revokes it on logout",async()=>{
    let active=true;
    const query=vi.fn(async(sql:string,_parameters?:unknown[])=>{
      if(sql.startsWith("INSERT"))return{rows:[],rowCount:1};
      if(sql.startsWith("UPDATE admin_sessions\n          SET last_seen_at"))return active?{rows:[{id:"session-id",expires_at:new Date(Date.now()+3600000)}],rowCount:1}:{rows:[],rowCount:0};
      if(sql.startsWith("UPDATE admin_sessions SET status")){active=false;return{rows:[],rowCount:1};}
      return{rows:[],rowCount:0};
    });
    const sessions=new AdminSessionService({query} as never,{ttlSeconds:3600});
    const args=Array(32).fill(undefined) as unknown as Parameters<typeof createApp>;
    args[0]=new BrandProfileService(new MemoryBrandProfileStore());args[9]="secret";args[31]=sessions;
    const server=createServer(createApp(...args));servers.push(server);
    await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const login=await fetch(base+"/api/auth/admin/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:"secret"})});
    expect(login.status).toBe(201);
    const cookie=login.headers.get("set-cookie")?.split(";")[0]??"";
    expect((await fetch(base+"/api/admin/workspaces",{headers:{Cookie:cookie}})).status).toBe(200);
    const crossSite=await fetch(base+"/api/auth/admin/session",{method:"DELETE",headers:{Cookie:cookie,Origin:"https://evil.example","Sec-Fetch-Site":"cross-site"}});expect(crossSite.status).toBe(403);
    const logout=await fetch(base+"/api/auth/admin/session",{method:"DELETE",headers:{Cookie:cookie}});
    expect(logout.status).toBe(200);expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await fetch(base+"/api/admin/workspaces",{headers:{Cookie:cookie}})).status).toBe(401);
  });

  it("serves a CSP-protected Korean login page",async()=>{
    const server=createServer(createApp(new BrandProfileService(new MemoryBrandProfileStore())));servers.push(server);
    await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const response=await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/admin/login`),html=await response.text();
    expect(response.status).toBe(200);expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");expect(html).toContain("관리자 로그인");
  });

  it("rate limits repeated invalid administrator logins",async()=>{
    const sessions=new AdminSessionService({query:vi.fn().mockResolvedValue({rows:[],rowCount:0})} as never);
    const args=Array(32).fill(undefined) as unknown as Parameters<typeof createApp>;
    args[0]=new BrandProfileService(new MemoryBrandProfileStore());args[9]="secret";args[31]=sessions;
    const server=createServer(createApp(...args));servers.push(server);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/admin/session`,init={method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:"wrong"})};
    for(let attempt=0;attempt<5;attempt++)expect((await fetch(url,init)).status).toBe(401);
    const blocked=await fetch(url,init);expect(blocked.status).toBe(429);expect(blocked.headers.get("retry-after")).toBe("900");
    await expect(blocked.json()).resolves.toEqual({error:{code:"ADMIN_LOGIN_RATE_LIMITED",message:"로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."}});
  });

  it("lists active sessions, redacts client digests, and revokes all sessions",async()=>{
    const now=new Date("2026-08-21T00:00:00.000Z"),query=vi.fn(async(sql:string)=>{
      if(sql.startsWith("SELECT id,created_at"))return{rows:[{id:"session-1",created_at:now,expires_at:new Date(now.getTime()+3600000),last_seen_at:now}],rowCount:1};
      if(sql.startsWith("SELECT id,event_type"))return{rows:[{id:"event-1",event_type:"LOGIN_SUCCEEDED",outcome:"SUCCEEDED",session_id:"session-1",client_digest:"a".repeat(64),detail:{},occurred_at:now}],rowCount:1};
      if(sql.startsWith("UPDATE admin_sessions SET status='REVOKED'"))return{rows:[],rowCount:3};
      return{rows:[],rowCount:1};
    }),service=new AdminSessionService({query} as never);
    expect(await service.active(now)).toEqual([{id:"session-1",createdAt:now.toISOString(),expiresAt:"2026-08-21T01:00:00.000Z",lastSeenAt:now.toISOString()}]);
    expect((await service.events(10))[0]?.client_digest).toBe("aaaaaaaaaaaa");
    expect(await service.revokeAll(now)).toBe(3);
    expect(service.clientDigest("127.0.0.1")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("revokes one session and cleans records only after configured retention",async()=>{
    const query=vi.fn(async(sql:string,_parameters?:unknown[])=>{
      if(sql.includes("RETURNING id"))return{rows:[{id:"session-1"}],rowCount:1};
      if(sql.startsWith("DELETE FROM admin_auth_events"))return{rows:[],rowCount:4};
      if(sql.startsWith("DELETE FROM admin_sessions"))return{rows:[],rowCount:2};
      return{rows:[],rowCount:0};
    }),service=new AdminSessionService({query} as never),now=new Date("2026-08-21T00:00:00.000Z");
    expect(await service.revokeById("session-1",now)).toBe(true);
    expect(await service.cleanup({eventRetentionDays:90,sessionRetentionDays:30},now)).toEqual({deletedEvents:4,deletedSessions:2});
    const eventCutoff=query.mock.calls.find(([sql])=>String(sql).startsWith("DELETE FROM admin_auth_events"))?.[1]?.[0] as Date;
    const sessionCutoff=query.mock.calls.find(([sql])=>String(sql).startsWith("DELETE FROM admin_sessions"))?.[1]?.[0] as Date;
    expect(eventCutoff.toISOString()).toBe("2026-05-23T00:00:00.000Z");expect(sessionCutoff.toISOString()).toBe("2026-07-22T00:00:00.000Z");
    await expect(service.cleanup({eventRetentionDays:1},now)).rejects.toThrow("retention policy");
  });

  it("serves the session security console",async()=>{
    const server=createServer(createApp(new BrandProfileService(new MemoryBrandProfileStore())));servers.push(server);await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`,page=await fetch(base+"/admin/security"),html=await page.text(),asset=await fetch(base+"/admin/assets/security.js");
    expect(page.status).toBe(200);expect(html).toContain("로그인 보안");expect(html).toContain("모든 세션 종료");expect(asset.status).toBe(200);
  });
});
