import{describe,expect,it}from"vitest";
import{AdminLoginRateLimiter}from"../src/auth/admin-login-rate-limiter.js";

describe("admin login rate limiter",()=>{
  it("blocks the sixth failed attempt for fifteen minutes",()=>{
    const limiter=new AdminLoginRateLimiter({maxAttempts:5,windowMs:900_000});
    for(let attempt=0;attempt<5;attempt++){expect(limiter.check("127.0.0.1",attempt).allowed).toBe(true);limiter.fail("127.0.0.1",attempt);}
    expect(limiter.check("127.0.0.1",5)).toEqual({allowed:false,retryAfterSeconds:900});
    expect(limiter.check("127.0.0.1",900_001).allowed).toBe(true);
  });

  it("clears failures after a successful login",()=>{
    const limiter=new AdminLoginRateLimiter({maxAttempts:1,windowMs:1000});
    limiter.fail("client",0);expect(limiter.check("client",1).allowed).toBe(false);
    limiter.success("client");expect(limiter.check("client",1).allowed).toBe(true);
  });
});
