import{describe,expect,it,vi}from"vitest";
import{SHOPIFY_DRAFT_SMOKE_HANDLE,assertShopifyDraftSmokeConfirmation,buildShopifyDraftSmokePlan,runShopifyDraftSmoke}from"../src/integrations/shopify-draft-smoke.js";

const base={SHOPIFY_SHOP_DOMAIN:"example-store.myshopify.com",SHOPIFY_ADMIN_ACCESS_TOKEN:"secret",SHOPIFY_API_VERSION:"2026-07"};

describe("Shopify draft write smoke",()=>{
  it("plans a fixed non-public idempotent product",()=>{
    expect(buildShopifyDraftSmokePlan(base)).toEqual({shopDomain:"example-store.myshopify.com",handle:SHOPIFY_DRAFT_SMOKE_HANDLE,title:"[STORZY TEST] Seoul One-Way Street Tee",status:"DRAFT",price:"39.00"});
  });

  it("requires an exact target-domain confirmation",()=>{
    const plan=buildShopifyDraftSmokePlan(base);
    expect(()=>assertShopifyDraftSmokeConfirmation({...base,SHOPIFY_WRITE_SMOKE_CONFIRM:"other.myshopify.com"},plan)).toThrow(/일치/);
    expect(()=>assertShopifyDraftSmokeConfirmation({...base,SHOPIFY_WRITE_SMOKE_CONFIRM:"EXAMPLE-STORE.MYSHOPIFY.COM"},plan)).not.toThrow();
  });

  it("publishes DRAFT with a fixed handle and verifies the result",async()=>{
    const fetch=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{productSet:{product:{id:"gid://shopify/Product/1",title:"test",status:"DRAFT"},productSetOperation:null,userErrors:[]}}}),{status:200,headers:{"Content-Type":"application/json"}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data:{product:{
          id:"gid://shopify/Product/1",
          title:"[STORZY TEST] Seoul One-Way Street Tee",
          handle:SHOPIFY_DRAFT_SMOKE_HANDLE,
          status:"DRAFT",
          variants:{nodes:[{id:"gid://shopify/ProductVariant/1",title:"Default Title",price:"39.00",sku:null}]},
        }},
      }),{status:200,headers:{"Content-Type":"application/json"}}));
    const result=await runShopifyDraftSmoke({...base,SHOPIFY_WRITE_SMOKE_CONFIRM:base.SHOPIFY_SHOP_DOMAIN},fetch);
    expect(result).toMatchObject({productId:"gid://shopify/Product/1",handle:SHOPIFY_DRAFT_SMOKE_HANDLE,status:"DRAFT"});
    const mutation=JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(mutation.variables.input).toMatchObject({handle:SHOPIFY_DRAFT_SMOKE_HANDLE,status:"DRAFT"});
    expect(mutation.variables.input.tags).toContain("do-not-publish");
  });
});
