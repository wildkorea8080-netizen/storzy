import type { ShopifyStorePublicationPlan } from "./shopify-plan.js";

export interface ShopifyGraphqlClient{graphql<T>(query:string,variables?:Record<string,unknown>):Promise<T>}
type UserError={field?:readonly string[]|null;message:string;code?:string|null};
type Resource={id:string;handle:string};
export type StorePublicationResult=Readonly<{pages:Resource[];menu:Resource;theme:ShopifyStorePublicationPlan["theme"]}>;
export interface StorePublisher{publish(plan:ShopifyStorePublicationPlan,workspaceId?:string):Promise<StorePublicationResult>}

const FIND_PAGE=`#graphql query FindPage($query:String!){pages(first:1,query:$query){nodes{id handle}}}`;
const CREATE_PAGE=`#graphql mutation CreatePage($page:PageCreateInput!){pageCreate(page:$page){page{id handle} userErrors{field message code}}}`;
const UPDATE_PAGE=`#graphql mutation UpdatePage($id:ID!,$page:PageUpdateInput!){pageUpdate(id:$id,page:$page){page{id handle} userErrors{field message code}}}`;
const FIND_MENU=`#graphql query FindMenu($query:String!){menus(first:1,query:$query){nodes{id handle isDefault}}}`;
const CREATE_MENU=`#graphql mutation CreateMenu($title:String!,$handle:String!,$items:[MenuItemCreateInput!]!){menuCreate(title:$title,handle:$handle,items:$items){menu{id handle} userErrors{field message code}}}`;
const UPDATE_MENU=`#graphql mutation UpdateMenu($id:ID!,$title:String!,$items:[MenuItemUpdateInput!]!){menuUpdate(id:$id,title:$title,items:$items){menu{id handle} userErrors{field message code}}}`;

export class ShopifyStorePublisher implements StorePublisher{
  constructor(private readonly client:ShopifyGraphqlClient){}

  async publish(plan:ShopifyStorePublicationPlan):Promise<StorePublicationResult>{
    const pages:Resource[]=[];
    for(const page of plan.pages){
      const found=await this.client.graphql<{pages:{nodes:Resource[]}}>(FIND_PAGE,{query:`handle:${page.handle}`});
      const input={title:page.title,handle:page.handle,body:page.body,isPublished:false};
      if(found.pages.nodes[0]){
        const result=await this.client.graphql<{pageUpdate:{page:Resource|null;userErrors:UserError[]}}>(UPDATE_PAGE,{id:found.pages.nodes[0].id,page:input});
        pages.push(this.result("pageUpdate",result.pageUpdate));
      }else{
        const result=await this.client.graphql<{pageCreate:{page:Resource|null;userErrors:UserError[]}}>(CREATE_PAGE,{page:input});
        pages.push(this.result("pageCreate",result.pageCreate));
      }
    }
    const pageByHandle=new Map(pages.map(page=>[page.handle,page]));
    const items=plan.menu.items.map(item=>{const handle=item.url.startsWith("/pages/")?item.url.slice(7):"",page=pageByHandle.get(handle);return page?{title:item.title,type:"PAGE",resourceId:page.id,url:item.url,items:[]}:{title:item.title,type:item.type,url:item.url,items:[]}});
    const found=await this.client.graphql<{menus:{nodes:Array<Resource&{isDefault:boolean}>}}>(FIND_MENU,{query:`handle:${plan.menu.handle}`});
    let menu:Resource;
    if(found.menus.nodes[0]){
      const result=await this.client.graphql<{menuUpdate:{menu:Resource|null;userErrors:UserError[]}}>(UPDATE_MENU,{id:found.menus.nodes[0].id,title:plan.menu.title,items});
      menu=this.result("menuUpdate",result.menuUpdate);
    }else{
      const result=await this.client.graphql<{menuCreate:{menu:Resource|null;userErrors:UserError[]}}>(CREATE_MENU,{title:plan.menu.title,handle:plan.menu.handle,items});
      menu=this.result("menuCreate",result.menuCreate);
    }
    return{pages,menu,theme:plan.theme};
  }

  private result(name:string,payload:{page?:Resource|null;menu?:Resource|null;userErrors:UserError[]}){
    if(payload.userErrors.length){const error=Object.assign(new Error(`${name}: ${payload.userErrors.map(item=>item.message).join("; ")}`),{status:422});throw error}
    const resource=payload.page??payload.menu;if(!resource)throw Object.assign(new Error(`${name} returned no resource`),{status:502});return resource;
  }
}
