import type pg from"pg";

export type PrivacyMaintenanceIncidentType="SLA_SCAN_FAILED"|"UNINSTALL_RETENTION_FAILED";

const safeError=(error:unknown)=>{
  const message=error instanceof Error?error.message:String(error);
  return message.replace(/:\/\/[^\s/@:]+:[^\s/@]+@/g,"://[REDACTED]@").replace(/\b(password|secret|token|api[_-]?key)=([^\s&]+)/gi,"$1=[REDACTED]").replace(/[\r\n\t]+/g," ").slice(0,1000);
};

export class PrivacyMaintenanceIncidentStore{
  constructor(private readonly pool:pg.Pool){}

  async synchronize(type:PrivacyMaintenanceIncidentType,error:unknown|null){
    if(error!==null){
      const saved=await this.pool.query(`INSERT INTO privacy_maintenance_incidents(id,incident_type,status,last_error)
VALUES(gen_random_uuid(),$1,'OPEN',$2)
ON CONFLICT(incident_type) DO UPDATE SET status='OPEN',last_error=EXCLUDED.last_error,opened_at=CASE WHEN privacy_maintenance_incidents.status='RESOLVED' THEN now() ELSE privacy_maintenance_incidents.opened_at END,updated_at=now(),resolved_at=NULL
RETURNING id,incident_type,status,last_error,opened_at,updated_at,resolved_at`,[type,safeError(error)]);
      return saved.rows[0];
    }
    const resolved=await this.pool.query(`UPDATE privacy_maintenance_incidents SET status='RESOLVED',last_error=NULL,updated_at=now(),resolved_at=now() WHERE incident_type=$1 AND status='OPEN' RETURNING id,incident_type,status,last_error,opened_at,updated_at,resolved_at`,[type]);
    return resolved.rows[0]??null;
  }
}
