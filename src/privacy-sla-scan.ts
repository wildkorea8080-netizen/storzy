import {loadConfig} from "./config.js";
import {createPool} from "./db/pool.js";
import {JsonLogger} from "./observability/logger.js";
import {PrivacyMaintenanceRunner} from "./privacy/maintenance-runner.js";
import {PrivacyMaintenanceIncidentStore} from "./privacy/maintenance-incident-store.js";
import {PrivacySlaAlertService} from "./privacy/sla-alert-service.js";
import {ShopifyUninstallReceiptRetentionService} from "./privacy/uninstall-receipt-retention.js";

const config=loadConfig(),pool=createPool(config.databaseUrl),logger=new JsonLogger(config.logLevel,{service:"storzy-privacy-sla"});
try{const result=await new PrivacyMaintenanceRunner(new PrivacySlaAlertService(pool),new ShopifyUninstallReceiptRetentionService(pool),logger,new PrivacyMaintenanceIncidentStore(pool)).run();if(!result.ok)process.exitCode=1;}finally{await pool.end();}
