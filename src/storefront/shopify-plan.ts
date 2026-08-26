import type { StoreConfig } from "./config-builder.js";

export type ShopifyStorePublicationPlan=Readonly<{
  version:"1.0.0";
  pages:readonly Readonly<{key:string;handle:string;title:string;body:string;isPublished:false}>[];
  menu:Readonly<{title:"Main menu";handle:"main-menu";items:readonly Readonly<{title:string;type:"FRONTPAGE"|"CATALOG"|"COLLECTIONS"|"HTTP";url:string}>[]}>;
  theme:Readonly<{templateKey:string;settings:StoreConfig["theme"];automation:"REQUIRES_SHOPIFY_THEME_API_EXEMPTION"}>;
}>;

const pageKeys=["about","faq","shipping","returns","contact"] as const;
const titleCase=(value:string)=>value.charAt(0).toUpperCase()+value.slice(1);

export function mapStoreConfigToShopifyPlan(config:StoreConfig):ShopifyStorePublicationPlan{
  const pages=pageKeys.map(key=>({key,handle:`storzy-${key}`,title:config.pages[key].title,body:`<p>${escapeHtml(config.pages[key].body)}</p>`,isPublished:false as const}));
  const urls:Record<string,string>={Home:"/",Shop:"/collections/all",Collections:"/collections",About:"/pages/storzy-about",FAQ:"/pages/storzy-faq",Shipping:"/pages/storzy-shipping",Returns:"/pages/storzy-returns",Contact:"/pages/storzy-contact"};
  return{version:"1.0.0",pages,menu:{title:"Main menu",handle:"main-menu",items:config.navigation.map(title=>({title,type:title==="Home"?"FRONTPAGE":title==="Shop"?"CATALOG":title==="Collections"?"COLLECTIONS":"HTTP",url:urls[title]??`/pages/storzy-${titleCase(title).toLowerCase()}`}))},theme:{templateKey:config.templateKey,settings:config.theme,automation:"REQUIRES_SHOPIFY_THEME_API_EXEMPTION"}};
}

function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!))}
