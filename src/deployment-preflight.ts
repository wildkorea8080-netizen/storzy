import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {checkShopifyDeployment} from "./deployment/shopify-preflight.js";

const configPath=resolve(process.argv[2]||"shopify.app.toml");
try{
  const toml=await readFile(configPath,"utf8"),manifest=await readFile(resolve("storzy.processes.json"),"utf8"),result=checkShopifyDeployment(process.env,toml,manifest);
  console.log(`Shopify 배포 사전점검: ${result.ready?"통과":"실패"}`);
  for(const check of result.checks)console.log(`${check.ok?"PASS":"FAIL"}  ${check.key}  ${check.message}`);
  if(!result.ready)process.exitCode=1;
}catch(error){console.error(`Shopify 배포 사전점검 실패: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1;}
