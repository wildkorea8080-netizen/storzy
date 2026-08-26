import {DomainError} from "../brand/errors.js";
import {PrintfulClient} from "./printful.js";
import {ProviderHttpError} from "./http.js";

export const PRINTFUL_WEBHOOK_EVENTS=["mockup_task_finished","shipment_sent","shipment_returned"] as const;
type EventResult={type:string;url:string|null;params?:unknown[]};

export async function syncPrintfulWebhooks(input:{token:string;storeId:string;publicAppUrl:string;baseUrl?:string;fetch?:typeof globalThis.fetch}){
  let endpoint:URL;
  try{endpoint=new URL("/webhooks/printful",input.publicAppUrl);}catch{throw new DomainError("INVALID_INPUT","PUBLIC_APP_URL이 올바르지 않습니다.");}
  if(endpoint.protocol!=="https:")throw new DomainError("WEBHOOK_PUBLIC_HTTPS_REQUIRED","Printful Webhook 등록에는 공개 HTTPS 주소가 필요합니다.");
  const client=new PrintfulClient({token:input.token,storeId:input.storeId,baseUrl:input.baseUrl??"https://api.printful.com",...(input.fetch?{fetch:input.fetch}:{})}),subscriptions:EventResult[]=[];
  let created=0,updated=0,existing=0;
  for(const type of PRINTFUL_WEBHOOK_EVENTS){
    let current:EventResult|null=null;
    try{current=(await client.request<{result?:EventResult}>(`/v2/webhooks/${type}`)).result??null;}catch(error){if(!(error instanceof ProviderHttpError)||error.status!==404)throw error;}
    if(current?.url===endpoint.href){existing++;subscriptions.push(current);continue;}
    const configured=await client.request<{result?:EventResult}>(`/v2/webhooks/${type}`,{method:"POST",body:JSON.stringify({type,url:endpoint.href,params:[]})});
    if(!configured.result)throw new DomainError("PROVIDER_VALIDATION_FAILED",`${type} Webhook 설정 응답이 올바르지 않습니다.`);
    current?updated++:created++;subscriptions.push(configured.result);
  }
  return{provider:"PRINTFUL" as const,endpoint:endpoint.href,events:PRINTFUL_WEBHOOK_EVENTS,total:PRINTFUL_WEBHOOK_EVENTS.length,created,updated,existing,subscriptions};
}
