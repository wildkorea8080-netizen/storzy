import type pg from "pg";
import{migrationChecksum,type Migration}from"../db/migration-runner.js";

export class DatabaseReadinessService{
  #draining=false;
  readonly #expected:Map<string,string>|null;
  constructor(private readonly pool:Pick<pg.Pool,"query">,migrations?:readonly Migration[]){this.#expected=migrations?new Map(migrations.map(item=>[item.version,migrationChecksum(item.sql)])):null}
  markDraining(){this.#draining=true}
  get draining(){return this.#draining}
  async check():Promise<void>{if(this.#draining)throw new Error("Application is draining");await this.pool.query("SELECT 1");if(!this.#expected)return;const result=await this.pool.query<{version:string;checksum:string|null}>("SELECT version,checksum FROM schema_migrations ORDER BY version"),actual=new Map(result.rows.map(row=>[row.version,row.checksum]));for(const[version,checksum]of this.#expected)if(actual.get(version)!==checksum)throw new Error(`Database schema is not ready: ${version}`);for(const version of actual.keys())if(!this.#expected.has(version))throw new Error(`Database schema is newer than application: ${version}`)}
}
