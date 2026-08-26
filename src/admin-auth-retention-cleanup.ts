import{loadConfig}from"./config.js";
import{createPool}from"./db/pool.js";
import{AdminSessionService}from"./auth/admin-session-service.js";
import{JsonLogger}from"./observability/logger.js";
import{AdminSecurityAlertDeliveryService,SignedAdminSecurityAlertWebhook}from"./auth/admin-security-alert-delivery.js";

const config=loadConfig(),pool=createPool(config.databaseUrl),logger=new JsonLogger(config.logLevel,{service:"storzy-admin-auth-retention"}),service=new AdminSessionService(pool);
try{const url=process.env.ADMIN_SECURITY_ALERT_WEBHOOK_URL?.trim(),secret=process.env.ADMIN_SECURITY_ALERT_WEBHOOK_SECRET?.trim(),delivery=url&&secret?await new AdminSecurityAlertDeliveryService(pool,new SignedAdminSecurityAlertWebhook(url,secret)).deliver(Number(process.env.ADMIN_SECURITY_ALERT_BATCH_SIZE??"20")):{claimed:0,sent:0,failed:0},result=await service.cleanup({eventRetentionDays:Number(process.env.ADMIN_AUTH_EVENT_RETENTION_DAYS??"90"),sessionRetentionDays:Number(process.env.ADMIN_SESSION_RECORD_RETENTION_DAYS??"30")});if(result.deletedEvents||result.deletedSessions)await service.record("RETENTION_CLEANUP","SUCCEEDED",service.clientDigest("scheduler"),{detail:{...result,source:"SCHEDULED"}});logger.info("admin-auth.maintenance.completed",{...result,...delivery});if(delivery.failed)process.exitCode=1;}catch(error){logger.error("admin-auth.maintenance.failed",{error});throw error}finally{await pool.end();}
