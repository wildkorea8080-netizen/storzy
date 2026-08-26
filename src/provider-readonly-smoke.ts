import{runProviderReadonlySmoke}from"./integrations/provider-readonly-smoke.js";
const result=await runProviderReadonlySmoke(process.env);console.log(`공급사 읽기 전용 smoke: ${result.ok?"통과":"실패"}`);for(const check of result.checks)console.log(`${check.ok?"PASS":"FAIL"}  ${check.provider}  ${check.key}  ${check.message} · ${check.latencyMs}ms`);if(!result.ok)process.exitCode=1;
