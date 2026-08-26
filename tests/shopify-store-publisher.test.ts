import{describe,expect,it}from"vitest";
import{buildStoreConfig}from"../src/storefront/config-builder.js";
import{mapStoreConfigToShopifyPlan}from"../src/storefront/shopify-plan.js";
import{ShopifyStorePublisher,type ShopifyGraphqlClient}from"../src/storefront/shopify-publisher.js";

class FakeShopify implements ShopifyGraphqlClient{
  pages=new Map<string,{id:string;handle:string}>();menu:{id:string;handle:string}|null=null;creates=0;updates=0;
  async graphql<T>(query:string,variables:Record<string,unknown>={}):Promise<T>{
    if(query.includes("FindPage")){const handle=String(variables.query).slice(7);return{pages:{nodes:this.pages.has(handle)?[this.pages.get(handle)]:[]}}as T}
    if(query.includes("CreatePage")){const page=variables.page as{handle:string};const resource={id:`gid://shopify/Page/${this.pages.size+1}`,handle:page.handle};this.pages.set(page.handle,resource);this.creates++;return{pageCreate:{page:resource,userErrors:[]}}as T}
    if(query.includes("UpdatePage")){const page=variables.page as{handle:string};const resource={id:String(variables.id),handle:page.handle};this.pages.set(page.handle,resource);this.updates++;return{pageUpdate:{page:resource,userErrors:[]}}as T}
    if(query.includes("FindMenu"))return{menus:{nodes:this.menu?[{...this.menu,isDefault:true}]:[]}}as T;
    if(query.includes("CreateMenu")){this.menu={id:"gid://shopify/Menu/1",handle:String(variables.handle)};this.creates++;return{menuCreate:{menu:this.menu,userErrors:[]}}as T}
    if(query.includes("UpdateMenu")){this.updates++;return{menuUpdate:{menu:this.menu,userErrors:[]}}as T}
    throw new Error("Unexpected query");
  }
}

describe("Shopify store publisher",()=>{
  it("creates missing resources then updates the same handles on retry",async()=>{
    const client=new FakeShopify(),publisher=new ShopifyStorePublisher(client),plan=mapStoreConfigToShopifyPlan(buildStoreConfig({brand_name:"Seoul Side"}));
    const first=await publisher.publish(plan);expect(first.pages).toHaveLength(5);expect(client.creates).toBe(6);
    const second=await publisher.publish(plan);expect(second.menu.id).toBe("gid://shopify/Menu/1");expect(client.creates).toBe(6);expect(client.updates).toBe(6);
  });

  it("treats Shopify user errors as permanent contract errors",async()=>{
    const client:ShopifyGraphqlClient={async graphql<T>(query:string){if(query.includes("FindPage"))return{pages:{nodes:[]}}as T;return{pageCreate:{page:null,userErrors:[{message:"Invalid page"}]}}as T}},publisher=new ShopifyStorePublisher(client);
    await expect(publisher.publish(mapStoreConfigToShopifyPlan(buildStoreConfig({brand_name:"Test"})))).rejects.toMatchObject({status:422});
  });
});
