import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { BrandProfileService, type BrandProfileGenerator } from "./brand/service.js";
import { PostgresBrandProfileStore } from "./brand/postgres-store.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { GenerationWorker } from "./jobs/generation-worker.js";
import { PostgresGenerationJobQueue } from "./jobs/postgres-generation-queue.js";

const config=loadConfig(),pool=createPool(config.databaseUrl),service=new BrandProfileService(new PostgresBrandProfileStore(pool));
const generator:BrandProfileGenerator={async generate(answers){
  const strings=(value:unknown,fallback:string[])=>Array.isArray(value)?value.map(String).filter(Boolean):fallback;
  const brandName=String(answers.brandName??"Seoul Side Studio"),markets=strings(answers.targetCountries,["US","JP"]).filter(code=>/^[A-Z]{2}$/.test(code)),preferred=strings(answers.preferredProducts,["t-shirt","hoodie","tote bag"]);
  return{promptVersion:"preview.fixture.v1",model:"preview-fixture",profileData:{schema_version:"1.0.0",brand_name:brandName,summary:String(answers.brandStory??"서울의 일상을 절제된 그래픽 상품으로 전하는 브랜드입니다."),target_markets:(markets.length?markets:["US"]).map(country_code=>({country_code,content_locales:[country_code==="JP"?"ja-JP":"en-US"]})),audience:{age_min:20,age_max:40,segments:[String(answers.primaryAudience??"해외 고객")],interests:["streetwear","travel","Korean culture"],purchase_motivations:["서울의 감성을 일상에서 경험"]},brand_style:{keywords:strings(answers.styleKeywords,["Seoul street","minimal"]),voice:[String(answers.voice??"간결하고 자신감 있는 말투")],primary_colors:strings(answers.primaryColors,["Black","White"]).slice(0,8).map((name,index)=>({name,hex:["#111111","#FFFFFF","#777777","#C9F135"][index]??"#555555"})),avoid:strings(answers.constraints,[])},pricing:{currency:"USD",target_margin_rate:.55,price_ranges:preferred.map((product_type,index)=>({product_type,min_minor:3500+index*500,max_minor:6500+index*2000}))},catalog_plan:{initial_product_count:Math.min(200,Math.max(1,Number(answers.initialProductCount)||20)),preferred_product_types:preferred,excluded_product_types:[]},content_rules:{required_claims:[],prohibited_claims:["검증되지 않은 원산지 표현"],prohibited_terms:[]},assumptions:["미리보기용 결정론적 생성 결과"]}};
}};
const controller=new AbortController(),worker=new GenerationWorker(new PostgresGenerationJobQueue(pool),service,generator,{workerId:`preview:${hostname()}:${process.pid}:${randomUUID()}`,leaseSeconds:30,maxAttempts:2,pollMs:500,onError:error=>console.error(error)});
for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>controller.abort());
try{await worker.run(controller.signal)}finally{await pool.end()}
