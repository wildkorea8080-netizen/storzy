import{runPrintfulCatalogContractSmoke}from"./integrations/printful-catalog-contract-smoke.js";
const result=await runPrintfulCatalogContractSmoke(process.env);
console.log("Printful catalog contract smoke: 통과");
console.log(JSON.stringify(result,null,2));
