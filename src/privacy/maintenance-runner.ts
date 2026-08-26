import type{Logger}from"../observability/logger.js";
import type{PrivacyMaintenanceIncidentStore,PrivacyMaintenanceIncidentType}from"./maintenance-incident-store.js";

type SlaScanner={scan():Promise<unknown>};
type ReceiptRetention={anonymizeExpired():Promise<unknown>};

export class PrivacyMaintenanceRunner{
  constructor(private readonly sla:SlaScanner,private readonly retention:ReceiptRetention,private readonly logger:Logger,private readonly incidents?:PrivacyMaintenanceIncidentStore){}

  async run(){
    let slaCompleted=false,retentionCompleted=false,incidentSyncCompleted=true,slaError:unknown=null,retentionError:unknown=null;
    try{const result=await this.sla.scan();slaCompleted=true;this.logger.info("privacy-sla.scan.completed",result as Record<string,unknown>);}catch(error){slaError=error;this.logger.error("privacy-sla.scan.failed",{error});}
    try{const result=await this.retention.anonymizeExpired();retentionCompleted=true;this.logger.info("shopify-uninstall-retention.completed",result as Record<string,unknown>);}catch(error){retentionError=error;this.logger.error("shopify-uninstall-retention.failed",{error});}
    if(this.incidents){for(const[type,error]of[["SLA_SCAN_FAILED",slaError],["UNINSTALL_RETENTION_FAILED",retentionError]]as Array<[PrivacyMaintenanceIncidentType,unknown|null]>){try{await this.incidents.synchronize(type,error);}catch(syncError){incidentSyncCompleted=false;this.logger.error("privacy-maintenance-incident.sync.failed",{incidentType:type,error:syncError});}}}
    return{ok:slaCompleted&&retentionCompleted&&incidentSyncCompleted,slaCompleted,retentionCompleted,incidentSyncCompleted};
  }
}
