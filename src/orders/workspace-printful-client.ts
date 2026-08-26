import {PrintfulClient} from "../integrations/printful.js";
import type {IntegrationConnectionRepository} from "../integrations/connection-repository.js";
import {PrintfulOrderConnectionUnavailableError,type PrintfulOrderClient} from "./printful-worker.js";

export class WorkspacePrintfulOrderClients{
  constructor(private readonly connections:IntegrationConnectionRepository|undefined,private readonly baseUrl:string,private readonly fallback?:Readonly<{token:string;storeId?:string}>){ }
  async forWorkspace(workspaceId:string):Promise<PrintfulOrderClient>{
    if(this.connections){const connection=(await this.connections.list(workspaceId)).find(item=>item.provider==="PRINTFUL"&&item.status==="CONNECTED"),credentials=await this.connections.credentials(workspaceId,"PRINTFUL");if(connection&&credentials?.token)return new PrintfulClient({token:credentials.token,baseUrl:this.baseUrl,...credentials.storeId?{storeId:credentials.storeId}:{}})}
    if(this.fallback)return new PrintfulClient({token:this.fallback.token,baseUrl:this.baseUrl,...this.fallback.storeId?{storeId:this.fallback.storeId}:{}});
    throw new PrintfulOrderConnectionUnavailableError();
  }
}
