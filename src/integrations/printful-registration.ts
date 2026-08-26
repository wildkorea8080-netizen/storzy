import { PrintfulClient } from "./printful.js";
import type { IntegrationConnectionRepository } from "./connection-repository.js";
import { DomainError } from "../brand/errors.js";

export async function registerPrintfulConnection(input:{workspaceId:string;token:string;storeId:string;actorId:string},repository:IntegrationConnectionRepository,baseUrl="https://api.printful.com",fetchImpl:typeof globalThis.fetch=globalThis.fetch){
  const token=input.token.trim(),storeId=input.storeId.trim(),actorId=input.actorId.trim();
  if(token.length<16||token.length>2048)throw new DomainError("INVALID_INPUT","Printful token 형식이 올바르지 않습니다.");
  if(!/^[0-9]{1,20}$/.test(storeId))throw new DomainError("INVALID_INPUT","Printful Store ID는 숫자여야 합니다.");
  if(!actorId||actorId.length>128)throw new DomainError("INVALID_INPUT","actorId가 필요합니다.");
  const client=new PrintfulClient({token,storeId,baseUrl,fetch:(request,init={})=>fetchImpl(request,{...init,signal:AbortSignal.timeout(8_000)})});
  let store:{id?:number|string;name?:string;type?:string};
  try{const response=await client.request<{result?:{id?:number|string;name?:string;type?:string}}>(`/stores/${encodeURIComponent(storeId)}`);if(!response.result)throw new Error("missing store");store=response.result;}catch{throw new DomainError("PROVIDER_VALIDATION_FAILED","Printful token, Store ID 또는 네트워크 연결을 확인해 주세요.");}
  if(String(store.id??"")!==storeId)throw new DomainError("PROVIDER_VALIDATION_FAILED","Printful 응답의 Store ID가 요청과 일치하지 않습니다.");
  const accountLabel=`${store.name||"Printful Store"} · ${storeId}`;
  const saved=await repository.upsert({workspaceId:input.workspaceId,provider:"PRINTFUL",accountLabel,credentials:{token,storeId},metadata:{storeId,storeType:store.type||null},actorId});
  return {provider:"PRINTFUL" as const,status:saved.status,accountLabel:saved.accountLabel,storeId,updatedAt:saved.updatedAt};
}
