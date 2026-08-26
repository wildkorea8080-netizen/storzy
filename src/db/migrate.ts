import{resolve}from"node:path";import{fileURLToPath}from"node:url";import{createPool}from"./pool.js";import{loadMigrations,runMigrationPlan}from"./migration-runner.js";
const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error("DATABASE_URL is required");
const directory=resolve(fileURLToPath(new URL("../../migrations",import.meta.url))),pool=createPool(databaseUrl),client=await pool.connect();
try{await runMigrationPlan(client,await loadMigrations(directory),version=>process.stdout.write(`Applied migration ${version}\n`))}finally{client.release();await pool.end()}
