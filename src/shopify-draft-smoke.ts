import{buildShopifyDraftSmokePlan,runShopifyDraftSmoke}from"./integrations/shopify-draft-smoke.js";

const apply=process.argv.includes("--apply"),plan=buildShopifyDraftSmokePlan(process.env);
if(!apply){
  console.log("Shopify draft 쓰기 smoke 계획 (외부 변경 없음)");
  console.log(JSON.stringify(plan,null,2));
  console.log(`실행하려면 SHOPIFY_WRITE_SMOKE_CONFIRM=${plan.shopDomain} 설정 후 npm run shopify:draft-smoke -- --apply`);
}else{
  const result=await runShopifyDraftSmoke(process.env);
  console.log("Shopify draft 쓰기 smoke: 통과");
  console.log(JSON.stringify(result,null,2));
}
