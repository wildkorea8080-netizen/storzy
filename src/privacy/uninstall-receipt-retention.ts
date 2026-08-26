import type pg from "pg";

export const SHOPIFY_UNINSTALL_RECEIPT_RETENTION_DAYS=7;

export class ShopifyUninstallReceiptRetentionService{
  constructor(private readonly pool:pg.Pool){}

  async anonymizeExpired(now=new Date()){
    const result=await this.pool.query<{id:string}>(`UPDATE shopify_app_uninstall_receipts
SET webhook_id='expired:'||id::text,
    connection_id=NULL,
    workspace_id=NULL,
    shop_domain='expired.invalid',
    anonymized_at=$1::timestamptz
WHERE received_at < $1::timestamptz-make_interval(days=>$2)
  AND shop_domain NOT IN('expired.invalid','redacted.invalid')
RETURNING id`,[now,SHOPIFY_UNINSTALL_RECEIPT_RETENTION_DAYS]);
    return{anonymized:result.rowCount??result.rows.length,retentionDays:SHOPIFY_UNINSTALL_RECEIPT_RETENTION_DAYS};
  }
}
