import{describe,expect,it,vi}from"vitest";
import{runPrintfulCatalogContractSmoke}from"../src/integrations/printful-catalog-contract-smoke.js";

const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{"Content-Type":"application/json"}}),env={PRINTFUL_TOKEN:"secret",PRINTFUL_STORE_ID:"store-1",PRINTFUL_CATALOG_SMOKE_PRODUCT_ID:"1",PRINTFUL_CATALOG_SMOKE_CURRENCY:"USD"};

describe("Printful catalog contract smoke",()=>{
  it("validates detail, variants, mockup styles, prices and shipping countries using GET only",async()=>{
    const fetcher=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
      expect(init?.method).toBeUndefined();
      const url=String(input);
      if(url.includes("/catalog-variants"))return json({data:[{id:48504,size:"A3",color:""}]});
      if(url.includes("/mockup-styles"))return json({data:[{placement:"default",technique:"digital",mockup_styles:[{id:9087}]}]});
      if(url.includes("/prices"))return json({data:{currency:"USD",variants:[{id:48504,techniques:[{technique_key:"digital",price:"12.89",discounted_price:"11.00"}]}]}});
      if(url.includes("/shipping-countries"))return json({data:[{code:"US"},{code:"KR"}]});
      return json({data:{id:1,name:"Enhanced Matte Paper Poster",techniques:[{key:"digital",is_default:true}]}});
    });
    await expect(runPrintfulCatalogContractSmoke(env,fetcher as never)).resolves.toEqual({storeId:"store-1",productId:"1",name:"Enhanced Matte Paper Poster",technique:"digital",variantCount:1,mockupStyleCount:1,shippingCountryCount:2,currency:"USD",minPrice:"11.00",maxPrice:"11.00"});
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("rejects a price currency mismatch",async()=>{
    const fetcher=vi.fn(async(input:string|URL|Request)=>{const url=String(input);if(url.includes("/catalog-variants"))return json({data:[{id:1}]});if(url.includes("/mockup-styles"))return json({data:[{mockup_styles:[{id:1}]}]});if(url.includes("/prices"))return json({data:{currency:"EUR",variants:[{techniques:[{price:"1.00"}]}]}});if(url.includes("/shipping-countries"))return json({data:[{code:"US"}]});return json({data:{name:"Product",techniques:[{key:"dtg"}]}})});
    await expect(runPrintfulCatalogContractSmoke(env,fetcher as never)).rejects.toThrow(/price 계약/);
  });
});
