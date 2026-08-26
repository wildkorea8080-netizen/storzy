import{PrintfulClient}from"./printful.js";

type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==="object"&&!Array.isArray(value)?value as Row:{};
const rows=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const data=(value:unknown):unknown=>row(value).data??value;
const required=(env:NodeJS.ProcessEnv,key:string):string=>{const value=env[key]?.trim();if(!value)throw new Error(`${key}이 필요합니다.`);return value};
const timed=(fetcher:typeof fetch,timeoutMs:number):typeof fetch=>(input,init={})=>fetcher(input,{...init,signal:AbortSignal.timeout(timeoutMs)});

export type PrintfulCatalogContractResult=Readonly<{
  storeId:string;
  productId:string;
  name:string;
  technique:string;
  variantCount:number;
  mockupStyleCount:number;
  shippingCountryCount:number;
  currency:string;
  minPrice:string;
  maxPrice:string;
}>;

export async function runPrintfulCatalogContractSmoke(env:NodeJS.ProcessEnv,fetcher:typeof fetch=fetch):Promise<PrintfulCatalogContractResult>{
  const token=required(env,"PRINTFUL_TOKEN"),storeId=required(env,"PRINTFUL_STORE_ID"),productId=env.PRINTFUL_CATALOG_SMOKE_PRODUCT_ID?.trim()||"1",currency=(env.PRINTFUL_CATALOG_SMOKE_CURRENCY?.trim()||"USD").toUpperCase();
  if(!/^\d+$/.test(productId))throw new Error("PRINTFUL_CATALOG_SMOKE_PRODUCT_ID는 숫자여야 합니다.");
  if(!/^[A-Z]{3}$/.test(currency))throw new Error("PRINTFUL_CATALOG_SMOKE_CURRENCY는 ISO 4217 코드여야 합니다.");
  const client=new PrintfulClient({token,storeId,baseUrl:env.PRINTFUL_API_BASE_URL?.trim()||"https://api.printful.com",fetch:timed(fetcher,Number(env.PROVIDER_SMOKE_TIMEOUT_MS??"10000"))}),id=encodeURIComponent(productId);
  const [detailResponse,variantsResponse,stylesResponse,pricesResponse,countriesResponse]=await Promise.all([
    client.request<unknown>(`/v2/catalog-products/${id}`),
    client.request<unknown>(`/v2/catalog-products/${id}/catalog-variants?limit=100&offset=0`),
    client.request<unknown>(`/v2/catalog-products/${id}/mockup-styles?limit=100&offset=0`),
    client.request<unknown>(`/v2/catalog-products/${id}/prices?currency=${encodeURIComponent(currency)}&limit=100&offset=0`),
    client.request<unknown>(`/v2/catalog-products/${id}/shipping-countries`),
  ]);
  const detail=row(data(detailResponse)),name=String(detail.name??detail.title??"").trim(),techniqueRows=rows(detail.techniques).map(row),technique=String(techniqueRows.find(item=>item.is_default===true)?.key??techniqueRows[0]?.key??"").trim();
  const variants=rows(data(variantsResponse)).map(row),styles=rows(data(stylesResponse)).map(row),countries=rows(data(countriesResponse)).map(row),priceRoot=row(data(pricesResponse)),responseCurrency=String(priceRoot.currency??"").toUpperCase(),priceRows=rows(priceRoot.variants).map(row);
  const prices=priceRows.flatMap(variant=>rows(variant.techniques).map(row).map(item=>String(item.discounted_price??item.price??"")).filter(value=>/^\d+(?:\.\d+)?$/.test(value))).map(Number);
  if(!name)throw new Error("Printful catalog product name이 비어 있습니다.");
  if(!technique)throw new Error("Printful catalog technique이 비어 있습니다.");
  if(variants.length===0||variants.some(item=>!String(item.id??"").trim()))throw new Error("Printful catalog variant 계약이 유효하지 않습니다.");
  if(styles.length===0||!styles.some(item=>rows(item.mockup_styles).length>0))throw new Error("Printful mockup style 계약이 유효하지 않습니다.");
  if(responseCurrency!==currency||prices.length===0||prices.some(value=>!Number.isFinite(value)||value<=0))throw new Error("Printful price 계약이 유효하지 않습니다.");
  if(countries.length===0)throw new Error("Printful shipping countries 계약이 비어 있습니다.");
  return{storeId,productId,name,technique,variantCount:variants.length,mockupStyleCount:styles.reduce((sum,item)=>sum+rows(item.mockup_styles).length,0),shippingCountryCount:countries.length,currency,minPrice:Math.min(...prices).toFixed(2),maxPrice:Math.max(...prices).toFixed(2)};
}
