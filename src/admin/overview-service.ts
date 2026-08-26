import type pg from "pg";

const workspaceRunCtes=`WITH latest_workspace_run AS (
  SELECT r.id,item->>'status' workspace_status,item->>'error' workspace_error,r.started_at
  FROM order_reconciliation_runs r
  CROSS JOIN LATERAL jsonb_array_elements(r.results)item
  WHERE item->>'workspaceId'=$1::uuid::text
  ORDER BY r.started_at DESC LIMIT 1
),latest_running AS (
  SELECT id,started_at FROM order_reconciliation_runs
  WHERE status='RUNNING' ORDER BY started_at DESC LIMIT 1
)`;

export class AdminOverviewService{
  constructor(private readonly pool:pg.Pool){}

  async get(workspaceId:string){
    const exists=await this.pool.query(`SELECT 1 FROM workspaces WHERE id=$1`,[workspaceId]);
    if(!exists.rowCount)return null;

    const q=await this.pool.query<{
      brand:Record<string,number>;candidates:Record<string,number>;content:Record<string,number>;
      publication:Record<string,number>;mockups:Record<string,number>;orders:Record<string,number>;
      fulfillment:Record<string,number>;reconciliation:Record<string,number>;candidate_rate_limited:number;mockup_rate_limited:number;publication_rate_limited:number;storefront_rate_limited:number;fulfillment_rate_limited:number
    }>(`${workspaceRunCtes}
SELECT
(SELECT jsonb_object_agg(status,n) FROM(SELECT r.status,count(*)::int n FROM brand_profile_revisions r JOIN brand_profiles p ON p.id=r.brand_profile_id WHERE p.workspace_id=$1 GROUP BY r.status)x)brand,
(SELECT jsonb_object_agg(decision_status,n) FROM(SELECT c.decision_status,count(*)::int n FROM product_candidates c JOIN product_candidate_jobs j ON j.id=c.job_id WHERE j.workspace_id=$1 GROUP BY c.decision_status)x)candidates,
(SELECT jsonb_object_agg(status,n) FROM(SELECT status,count(*)::int n FROM product_content_jobs WHERE workspace_id=$1 GROUP BY status)x)content,
(SELECT jsonb_object_agg(status,n) FROM(SELECT status,count(*)::int n FROM shopify_publication_jobs WHERE workspace_id=$1 GROUP BY status)x)publication,
(SELECT jsonb_object_agg(status,n) FROM(SELECT status,count(*)::int n FROM printful_mockup_jobs WHERE workspace_id=$1 GROUP BY status)x)mockups,
(SELECT jsonb_object_agg(status,n) FROM(SELECT status,count(*)::int n FROM commerce_orders WHERE workspace_id=$1 GROUP BY status)x)orders,
(SELECT jsonb_object_agg(status,n) FROM(SELECT fj.status,count(*)::int n FROM shopify_fulfillment_jobs fj JOIN fulfillment_shipments s ON s.id=fj.shipment_id JOIN commerce_orders o ON o.id=s.commerce_order_id WHERE o.workspace_id=$1 GROUP BY fj.status)x)fulfillment,
(SELECT jsonb_object_agg(issue_type,n) FROM(
  SELECT issue_type,count(*)::int n FROM order_reconciliation_issues WHERE workspace_id=$1 AND status IN('OPEN','ACKNOWLEDGED') GROUP BY issue_type
  UNION ALL SELECT 'RUN_HEALTH',1
  WHERE EXISTS(SELECT 1 FROM integration_connections WHERE workspace_id=$1 AND provider='SHOPIFY' AND status='CONNECTED')
  AND (
    EXISTS(SELECT 1 FROM latest_running WHERE started_at<now()-interval '2 hours')
    OR EXISTS(SELECT 1 FROM latest_workspace_run WHERE workspace_status='FAILED' OR workspace_status='SUCCEEDED' AND started_at<now()-interval '26 hours')
    OR NOT EXISTS(SELECT 1 FROM latest_workspace_run) AND NOT EXISTS(SELECT 1 FROM latest_running WHERE started_at>=now()-interval '2 hours')
  )
)x)reconciliation,
(SELECT count(*)::int FROM product_candidate_jobs WHERE workspace_id=$1 AND status='PENDING' AND last_error='WAITING_FOR_PRINTFUL_RATE_LIMIT')candidate_rate_limited,
(SELECT count(*)::int FROM printful_mockup_jobs WHERE workspace_id=$1 AND status IN('PENDING','WAITING_REMOTE') AND last_error='WAITING_FOR_PRINTFUL_RATE_LIMIT')mockup_rate_limited,
(SELECT count(*)::int FROM shopify_publication_jobs WHERE workspace_id=$1 AND status='PENDING' AND last_error='WAITING_FOR_SHOPIFY_RATE_LIMIT')publication_rate_limited,
(SELECT count(*)::int FROM shopify_store_publication_jobs j JOIN store_drafts d ON d.id=j.store_draft_id WHERE d.workspace_id=$1 AND j.status='PENDING' AND j.last_error='WAITING_FOR_SHOPIFY_RATE_LIMIT')storefront_rate_limited,
(SELECT count(*)::int FROM shopify_fulfillment_jobs fj JOIN fulfillment_shipments s ON s.id=fj.shipment_id JOIN commerce_orders o ON o.id=s.commerce_order_id WHERE o.workspace_id=$1 AND fj.status='PENDING' AND fj.last_error='WAITING_FOR_SHOPIFY_RATE_LIMIT')fulfillment_rate_limited`,[workspaceId]);

    const alerts=await this.pool.query<{kind:string;id:string;status:string;message:string;created_at:Date}>(`${workspaceRunCtes}
SELECT * FROM(
SELECT 'ORDER' kind,id::text,status,COALESCE(decision_reasons::text,'[]') message,updated_at created_at FROM commerce_orders WHERE workspace_id=$1 AND status IN('HELD','WAITING')
UNION ALL SELECT 'SHOPIFY_PUBLICATION',id::text,status,COALESCE(last_error,'Publication requires attention'),created_at FROM shopify_publication_jobs WHERE workspace_id=$1 AND status='FAILED'
UNION ALL SELECT 'PRINTFUL_MOCKUP',id::text,status,COALESCE(last_error,'Mockup requires attention'),created_at FROM printful_mockup_jobs WHERE workspace_id=$1 AND status='FAILED'
UNION ALL SELECT 'PRINTFUL_ORDER',id::text,status,COALESCE(last_error,'Order requires attention'),created_at FROM printful_order_jobs WHERE workspace_id=$1 AND status IN('HELD','FAILED')
UNION ALL SELECT 'SHOPIFY_TOKEN',id::text,CASE WHEN status='REAUTH_REQUIRED' THEN 'REAUTH_REQUIRED' ELSE 'FAILED' END,jsonb_build_array(CASE WHEN status='REAUTH_REQUIRED' THEN 'SHOPIFY_REAUTH_REQUIRED' ELSE 'SHOPIFY_TOKEN_REFRESH_REPEATED_FAILURE' END)::text,updated_at FROM integration_connections WHERE workspace_id=$1 AND provider='SHOPIFY' AND (status='REAUTH_REQUIRED' OR status='CONNECTED' AND COALESCE((metadata->>'refreshFailureCount')::int,0)>=3)
UNION ALL SELECT 'SHOPIFY_UNINSTALL',id::text,'DISCONNECTED',jsonb_build_array('SHOPIFY_APP_UNINSTALLED')::text,received_at FROM shopify_app_uninstall_receipts r WHERE workspace_id=$1 AND received_at=(SELECT max(received_at) FROM shopify_app_uninstall_receipts WHERE workspace_id=$1) AND NOT EXISTS(SELECT 1 FROM integration_connections WHERE workspace_id=$1 AND provider='SHOPIFY' AND status='CONNECTED')
UNION ALL SELECT 'ORDER_RECONCILIATION',id::text,status,jsonb_build_array(issue_type)::text,created_at FROM order_reconciliation_issues WHERE workspace_id=$1 AND status IN('OPEN','ACKNOWLEDGED')
UNION ALL SELECT 'ORDER_RECONCILIATION_RUN',id::text,'FAILED',jsonb_build_array('RECONCILIATION_RUN_FAILED')::text,started_at FROM latest_workspace_run
WHERE workspace_status='FAILED' AND EXISTS(SELECT 1 FROM integration_connections WHERE workspace_id=$1 AND provider='SHOPIFY' AND status='CONNECTED')
UNION ALL SELECT 'ORDER_RECONCILIATION_RUN',id::text,'FAILED',jsonb_build_array('RECONCILIATION_RUN_STALLED')::text,started_at FROM latest_running
WHERE started_at<now()-interval '2 hours' AND EXISTS(SELECT 1 FROM integration_connections WHERE workspace_id=$1 AND provider='SHOPIFY' AND status='CONNECTED')
UNION ALL SELECT 'ORDER_RECONCILIATION_RUN',COALESCE(r.id::text,'schedule-not-started'),'FAILED',jsonb_build_array(CASE WHEN r.id IS NULL THEN 'RECONCILIATION_RUN_NEVER' ELSE 'RECONCILIATION_RUN_OVERDUE' END)::text,COALESCE(r.started_at,now())
FROM (SELECT EXISTS(SELECT 1 FROM integration_connections WHERE workspace_id=$1 AND provider='SHOPIFY' AND status='CONNECTED') connected)c
LEFT JOIN latest_workspace_run r ON true
WHERE c.connected AND (r.id IS NULL OR r.workspace_status='SUCCEEDED' AND r.started_at<now()-interval '26 hours')
AND NOT EXISTS(SELECT 1 FROM latest_running WHERE started_at>=now()-interval '2 hours')
)a ORDER BY created_at DESC LIMIT 20`,[workspaceId]);

    const row=q.rows[0];return{counts:row??{brand:{},candidates:{},content:{},publication:{},mockups:{},orders:{},fulfillment:{}},throttles:{candidates:Number(row?.candidate_rate_limited??0),mockups:Number(row?.mockup_rate_limited??0),publication:Number(row?.publication_rate_limited??0),storefront:Number(row?.storefront_rate_limited??0),fulfillment:Number(row?.fulfillment_rate_limited??0)},alerts:alerts.rows};
  }
}
