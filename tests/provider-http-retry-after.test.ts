import{describe,expect,it}from"vitest";
import{parseJsonResponse,parseRetryAfter,ProviderHttpError}from"../src/integrations/http.js";

describe("provider Retry-After handling",()=>{
  it("parses delta seconds and HTTP dates with safe bounds",()=>{expect(parseRetryAfter("17",0)).toBe(17000);expect(parseRetryAfter("Thu, 01 Jan 1970 00:00:20 GMT",5000)).toBe(15000);expect(parseRetryAfter("0",0)).toBe(1000);expect(parseRetryAfter("invalid",0)).toBeNull();expect(parseRetryAfter("999999",0)).toBe(86400000)});
  it("preserves Retry-After metadata on provider errors",async()=>{const response=new Response("limited",{status:429,headers:{"Retry-After":"17"}});try{await parseJsonResponse("printful",response);throw new Error("expected failure")}catch(error){expect(error).toBeInstanceOf(ProviderHttpError);expect(error).toMatchObject({provider:"printful",status:429,responseBody:"limited",retryAfterMs:17000})}});
});
