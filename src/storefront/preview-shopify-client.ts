import { createHash } from "node:crypto";
import type { ShopifyGraphqlClient } from "./shopify-publisher.js";

type Resource={id:string;handle:string};
const id=(type:string,handle:string)=>`gid://shopify/${type}/${createHash("sha256").update(handle).digest("hex").slice(0,12)}`;
export class PreviewStorefrontShopifyClient implements ShopifyGraphqlClient{
  private readonly pages=new Map<string,Resource>();private menu:Resource|null=null;
  async graphql<T>(query:string,variables:Record<string,unknown>={}):Promise<T>{
    if(query.includes("FindPage")){const handle=String(variables.query??"").replace(/^handle:/,"");return{pages:{nodes:this.pages.has(handle)?[this.pages.get(handle)!]:[]}}as T}
    if(query.includes("CreatePage")){const page=variables.page as {handle:string},resource={id:id("Page",page.handle),handle:page.handle};this.pages.set(page.handle,resource);return{pageCreate:{page:resource,userErrors:[]}}as T}
    if(query.includes("UpdatePage")){const page=variables.page as {handle:string},resource={id:String(variables.id),handle:page.handle};this.pages.set(page.handle,resource);return{pageUpdate:{page:resource,userErrors:[]}}as T}
    if(query.includes("FindMenu"))return{menus:{nodes:this.menu?[{...this.menu,isDefault:false}]:[]}}as T;
    if(query.includes("CreateMenu")){this.menu={id:id("Menu",String(variables.handle)),handle:String(variables.handle)};return{menuCreate:{menu:this.menu,userErrors:[]}}as T}
    if(query.includes("UpdateMenu")){this.menu={id:String(variables.id),handle:"storzy-main"};return{menuUpdate:{menu:this.menu,userErrors:[]}}as T}
    throw new Error("Unsupported preview Shopify storefront operation");
  }
}
