import{createHash}from"node:crypto";import{readdir,readFile}from"node:fs/promises";import{resolve}from"node:path";
export type Migration=Readonly<{version:string;sql:string}>;
type Client=Readonly<{query:(sql:string,values?:unknown[])=>Promise<{rowCount:number|null;rows?:Record<string,unknown>[]}>}>;
const lockKey=[74821,1]as const;

export async function loadMigrations(directory:string):Promise<Migration[]>{const files=(await readdir(directory)).filter(file=>/^\d+_.+\.sql$/.test(file)).sort();return Promise.all(files.map(async version=>({version,sql:await readFile(resolve(directory,version),"utf8")})))}

export function transactionalSql(source:string){const trimmed=source.trim(),starts=/^BEGIN\s*;/i.test(trimmed),ends=/COMMIT\s*;\s*$/i.test(trimmed);if(starts!==ends)throw new Error("Migration must contain both BEGIN and COMMIT or neither");return starts?trimmed.replace(/^BEGIN\s*;/i,"").replace(/COMMIT\s*;\s*$/i,"").trim():trimmed}
export const migrationChecksum=(source:string)=>createHash("sha256").update(source.replace(/\r\n?/g,"\n")).digest("hex");

export async function runMigrationPlan(client:Client,migrations:readonly Migration[],onApplied:(version:string)=>void=()=>{}){
  await client.query("SET statement_timeout = '10min'");
  await client.query("SELECT pg_advisory_lock($1,$2)",[...lockKey]);
  try{
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    await client.query("ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text");
    for(const migration of migrations){
      const checksum=migrationChecksum(migration.sql),existing=await client.query("SELECT version,checksum FROM schema_migrations WHERE version=$1",[migration.version]);if(existing.rowCount){const stored=existing.rows?.[0]?.checksum;if(stored===null||stored===undefined){await client.query("UPDATE schema_migrations SET checksum=$2 WHERE version=$1 AND checksum IS NULL",[migration.version,checksum]);continue}if(stored!==checksum)throw new Error(`Migration checksum mismatch: ${migration.version}`);continue}
      await client.query("BEGIN");
      try{const sql=transactionalSql(migration.sql);if(sql)await client.query(sql);await client.query("INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)",[migration.version,checksum]);await client.query("COMMIT")}catch(error){await client.query("ROLLBACK");throw error}onApplied(migration.version)
    }
  }finally{try{await client.query("SELECT pg_advisory_unlock($1,$2)",[...lockKey])}finally{await client.query("RESET statement_timeout")}}
}
