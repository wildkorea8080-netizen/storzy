type ScanIssue=Readonly<{shopify_order_id:unknown;issue_type:unknown;local_value:unknown;remote_value:unknown;remote_updated_at:unknown;created_at:unknown}>;

function safeCell(value:unknown){
  let text=value instanceof Date?value.toISOString():String(value??"");
  if(/^[=+\-@\t\r]/.test(text))text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}

export function reconciliationScanCsv(rows:readonly ScanIssue[]){
  const header=["shopify_order_id","issue_type","local_value","remote_value","remote_updated_at","recorded_at"];
  const records=rows.map(row=>[row.shopify_order_id,row.issue_type,row.local_value,row.remote_value,row.remote_updated_at,row.created_at]);
  return `\uFEFF${[header,...records].map(record=>record.map(safeCell).join(",")).join("\r\n")}\r\n`;
}
