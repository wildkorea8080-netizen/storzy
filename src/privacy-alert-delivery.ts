import {hostname} from "node:os";
import {randomUUID} from "node:crypto";
import {loadConfig} from "./config.js";
import {createPool} from "./db/pool.js";
import {JsonLogger} from "./observability/logger.js";
import {PrivacyAlertDeliveryService,SignedPrivacyAlertWebhook} from "./privacy/alert-delivery-service.js";

const url=process.env.PRIVACY_ALERT_WEBHOOK_URL?.trim(),secret=process.env.PRIVACY_ALERT_WEBHOOK_SECRET?.trim();if(!url||!secret)throw new Error("PRIVACY_ALERT_WEBHOOK_URL and PRIVACY_ALERT_WEBHOOK_SECRET are required");const config=loadConfig(),pool=createPool(config.databaseUrl),logger=new JsonLogger(config.logLevel,{service:"storzy-privacy-alert-delivery"}),workerId=`${hostname()}:${process.pid}:${randomUUID()}`;
try{const service=new PrivacyAlertDeliveryService(pool,new SignedPrivacyAlertWebhook(url,secret),{workerId,maxAttempts:Number(process.env.PRIVACY_ALERT_MAX_ATTEMPTS??"6"),leaseSeconds:Number(process.env.PRIVACY_ALERT_LEASE_SECONDS??"30")}),limit=Number(process.env.PRIVACY_ALERT_BATCH_SIZE??"20"),requests=await service.deliverBatch(limit),maintenance=await service.deliverMaintenanceBatch(limit);logger.info("privacy-alert-delivery.completed",{requests,maintenance});}catch(error){logger.error("privacy-alert-delivery.failed",{error});process.exitCode=1;}finally{await pool.end();}
