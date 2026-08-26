import {PrintfulClient} from "../integrations/printful.js";
import type {IntegrationConnectionRepository} from "../integrations/connection-repository.js";
import type {CatalogProvider} from "./types.js";
import {PrintfulCatalogProvider,type PrintfulCatalogSeed} from "./printful-catalog-provider.js";

export class PrintfulCatalogConnectionUnavailableError extends Error{constructor(){super("Workspace Printful catalog connection is unavailable");this.name="PrintfulCatalogConnectionUnavailableError"}}
export class WorkspacePrintfulCatalogProviders{
  constructor(private readonly connections:IntegrationConnectionRepository|undefined,private readonly baseUrl:string,private readonly seeds:readonly PrintfulCatalogSeed[],private readonly fallback?:Readonly<{token:string;storeId?:string}>){ }
  async forWorkspace(workspaceId:string):Promise<CatalogProvider>{
    if(this.connections){const connection=(await this.connections.list(workspaceId)).find(item=>item.provider==="PRINTFUL"&&item.status==="CONNECTED"),credentials=await this.connections.credentials(workspaceId,"PRINTFUL");if(connection&&credentials?.token)return new PrintfulCatalogProvider(new PrintfulClient({token:credentials.token,baseUrl:this.baseUrl,...credentials.storeId?{storeId:credentials.storeId}:{}}),this.seeds)}
    if(this.fallback)return new PrintfulCatalogProvider(new PrintfulClient({token:this.fallback.token,baseUrl:this.baseUrl,...this.fallback.storeId?{storeId:this.fallback.storeId}:{}}),this.seeds);
    throw new PrintfulCatalogConnectionUnavailableError();
  }
}
