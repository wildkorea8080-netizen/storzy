import{describe,expect,it}from"vitest";
import{buildStoreConfig}from"../src/storefront/config-builder.js";
import{mapStoreConfigToShopifyPlan}from"../src/storefront/shopify-plan.js";

describe("Shopify store publication plan",()=>{
  it("maps approved configuration to draft pages and navigation without Liquid code",()=>{
    const config=buildStoreConfig({brand_name:"Seoul <Side>",summary:"Seoul & local",brand_style:{keywords:["street"]}}),plan=mapStoreConfigToShopifyPlan(config);
    expect(plan.pages).toHaveLength(5);
    expect(plan.pages.every(page=>page.isPublished===false)).toBe(true);
    expect(plan.pages[0]).toMatchObject({handle:"storzy-about"});
    expect(plan.pages[0]?.body).toContain("&amp;");
    expect(plan.menu.items).toHaveLength(8);
    expect(plan.menu.items[0]).toEqual({title:"Home",type:"FRONTPAGE",url:"/"});
    expect(plan.theme.automation).toBe("REQUIRES_SHOPIFY_THEME_API_EXEMPTION");
    expect(JSON.stringify(plan)).not.toContain("liquid");
  });
});
