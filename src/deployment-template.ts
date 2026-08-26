import {writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {buildProductionTemplates} from "./deployment/production-templates.js";

const [publicUrl,clientId,flag]=process.argv.slice(2);
if(!publicUrl||!clientId){console.error("Usage: npm run deploy:template -- https://app.example.com SHOPIFY_CLIENT_ID [--write]");process.exitCode=1}
else try{
  const templates=buildProductionTemplates({publicUrl,shopifyClientId:clientId});
  if(flag==="--write"){
    await writeFile(resolve(".env.production.template"),templates.env,{encoding:"utf8",flag:"wx"});
    await writeFile(resolve("shopify.app.toml"),templates.shopifyToml,{encoding:"utf8",flag:"wx"});
    await writeFile(resolve("storzy.processes.json"),templates.processManifest,{encoding:"utf8",flag:"wx"});
    console.log("Created .env.production.template, shopify.app.toml and storzy.processes.json");
  }else{
    console.log("# .env.production.template\n"+templates.env);
    console.log("# shopify.app.toml\n"+templates.shopifyToml);
    console.log("# storzy.processes.json\n"+templates.processManifest);
    console.log("Preview only. Add --write to create files without overwriting existing files.");
  }
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1}
