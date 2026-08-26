import {verifyPostDeployment} from "./deployment/post-deploy-verifier.js";

const [baseUrl,workspaceId]=process.argv.slice(2),adminToken=process.env.ADMIN_API_TOKEN?.trim();
if(!baseUrl||!adminToken){console.error("Usage: ADMIN_API_TOKEN=... npm run deploy:verify -- https://app.example.com [workspaceId]");process.exitCode=1}
else try{
  const processAttempts=Number(process.env.DEPLOY_VERIFY_PROCESS_ATTEMPTS??12),processRetryMs=Number(process.env.DEPLOY_VERIFY_PROCESS_RETRY_MS??10000);
  if(!Number.isInteger(processAttempts)||processAttempts<1||processAttempts>60||!Number.isInteger(processRetryMs)||processRetryMs<0||processRetryMs>60000)throw new Error("DEPLOY_VERIFY_PROCESS_ATTEMPTS(1~60)와 DEPLOY_VERIFY_PROCESS_RETRY_MS(0~60000)를 확인하세요.");
  const expectedRelease=process.env.DEPLOY_VERIFY_EXPECTED_RELEASE?.trim();
  const result=await verifyPostDeployment({baseUrl,adminToken,processAttempts,processRetryMs,...workspaceId?{workspaceId}:{},...expectedRelease?{expectedRelease}:{}});
  console.log(`배포 후 검증: ${result.healthy?"통과":"실패"}`);
  for(const check of result.checks)console.log(`${check.ok?"PASS":"FAIL"}  ${check.key}  ${check.message}`);
  if(result.pilot)console.log(`INFO  PILOT  ${result.pilot.completed}/${result.pilot.total}${result.pilot.nextStep?` · 다음 작업: ${result.pilot.nextStep}`:" · 실행 준비 완료"}`);
  if(result.processes)console.log(`INFO  PROCESSES  정상 ${result.processes.healthy}/${result.processes.total} · 지연 ${result.processes.stale} · 실패 ${result.processes.failed} · 미실행 ${result.processes.neverSeen}`);
  if(!result.healthy)process.exitCode=1;
}catch(error){console.error(`배포 후 검증 실패: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}
