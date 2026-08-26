import{describe,expect,it,vi}from"vitest";
import{PrintfulOrderRateLimiter}from"../src/orders/printful-rate-limiter.js";

function fixture(row:{expired:boolean;used:number;retry_after_ms:string}){const calls:string[]=[],query=vi.fn(async(sql:string)=>{calls.push(sql);if(sql.includes("SELECT window_started_at"))return{rows:[row]};return{rows:[]}}),client={query,release:vi.fn()},pool={connect:vi.fn(async()=>client)};return{limiter:new PrintfulOrderRateLimiter(pool as never,2),calls,query,client}}
describe("Printful order distributed rate limiter",()=>{
  it("atomically consumes capacity inside a row lock",async()=>{const{limiter,calls,query,client}=fixture({expired:false,used:1,retry_after_ms:"20000"});await expect(limiter.acquire("workspace-1")).resolves.toEqual({allowed:true,retryAfterMs:0});expect(calls).toContain("BEGIN");expect(query.mock.calls.some(([sql])=>String(sql).includes("FOR UPDATE"))).toBe(true);expect(query.mock.calls.some(([sql])=>String(sql).includes("used=used+1"))).toBe(true);expect(calls).toContain("COMMIT");expect(client.release).toHaveBeenCalledOnce()});
  it("returns the database window delay when capacity is exhausted",async()=>{const{limiter,query}=fixture({expired:false,used:2,retry_after_ms:"17000"});await expect(limiter.acquire("workspace-1")).resolves.toEqual({allowed:false,retryAfterMs:17000});expect(query.mock.calls.some(([sql])=>String(sql).includes("used=used+1"))).toBe(false)});
  it("starts a fresh window after expiry",async()=>{const{limiter,query}=fixture({expired:true,used:2,retry_after_ms:"1000"});await expect(limiter.acquire("workspace-1")).resolves.toEqual({allowed:true,retryAfterMs:0});expect(query.mock.calls.some(([sql])=>String(sql).includes("window_started_at=now(),used=1"))).toBe(true)});
});
