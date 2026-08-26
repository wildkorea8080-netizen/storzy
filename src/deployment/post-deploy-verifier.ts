export type PostDeployCheck=Readonly<{key:string;ok:boolean;message:string}>;
export type PostDeployResult=Readonly<{
  healthy:boolean;
  checks:readonly PostDeployCheck[];
  workspaceId:string|null;
  pilot:Readonly<{ready:boolean;completed:number;total:number;nextStep:string|null}>|null;
  processes:Readonly<{healthy:number;stale:number;failed:number;neverSeen:number;total:number}>|null;
}>;

type Fetch=typeof globalThis.fetch;
const json=async(response:Response)=>response.json().catch(()=>null) as Promise<unknown>;
const record=(value:unknown):Record<string,unknown>|null=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
const wait=(milliseconds:number)=>new Promise<void>(resolve=>setTimeout(resolve,milliseconds));
const processSummary=(value:unknown)=>{const data=record(record(value)?.data),summary=record(data?.summary),number=(key:string)=>typeof summary?.[key]==="number"?summary[key] as number:null,healthy=number("healthy"),stale=number("stale"),failed=number("failed"),neverSeen=number("neverSeen"),total=number("total");return healthy===null||stale===null||failed===null||neverSeen===null||total===null?null:{healthy,stale,failed,neverSeen,total,allHealthy:data?.healthy===true&&healthy===total&&stale===0&&failed===0&&neverSeen===0}};

export async function verifyPostDeployment(input:Readonly<{baseUrl:string;adminToken:string;workspaceId?:string;expectedRelease?:string;fetch?:Fetch;processAttempts?:number;processRetryMs?:number;sleep?:(milliseconds:number)=>Promise<void>}>):Promise<PostDeployResult>{
  const fetcher=input.fetch??globalThis.fetch,base=new URL(input.baseUrl),headers={Authorization:`Bearer ${input.adminToken}`},checks:PostDeployCheck[]=[];
  if(base.username||base.password||base.search||base.hash||base.pathname!=="/")throw new Error("Base URL must be an origin without credentials, path, query, or hash");
  const origin=base.origin;

  try{
    const response=await fetcher(`${origin}/health`,{headers:{Accept:"application/json"}}),body=record(await json(response));
    checks.push({key:"HEALTH",ok:response.ok&&body?.status==="ok"&&body?.service==="storzy",message:"공개 헬스체크 응답"});
  }catch{checks.push({key:"HEALTH",ok:false,message:"공개 헬스체크 연결 실패"})}

  if(input.expectedRelease)try{const response=await fetcher(`${origin}/health`,{headers:{Accept:"application/json"}}),body=record(await json(response));checks.push({key:"RELEASE",ok:response.ok&&body?.release===input.expectedRelease,message:"실행 이미지 digest 일치"})}catch{checks.push({key:"RELEASE",ok:false,message:"실행 이미지 digest 확인 실패"})}

  try{
    const response=await fetcher(`${origin}/ready`,{headers:{Accept:"application/json"}}),body=record(await json(response)),state=record(body?.checks);
    checks.push({key:"READINESS",ok:response.ok&&body?.status==="ready"&&state?.database===true&&state.schema===true&&response.headers.get("cache-control")?.includes("no-store")===true,message:"애플리케이션·PostgreSQL·schema 준비 상태"});
  }catch{checks.push({key:"READINESS",ok:false,message:"준비 상태 확인 실패"})}

  try{
    const response=await fetcher(`${origin}/admin`,{redirect:"manual"}),csp=response.headers.get("content-security-policy")??"";
    checks.push({key:"ADMIN_HEADERS",ok:response.ok&&csp.includes("frame-ancestors 'none'")&&response.headers.get("x-frame-options")==="DENY"&&response.headers.get("cache-control")?.includes("no-store")===true,message:"관리자 문서 보안·캐시 헤더"});
  }catch{checks.push({key:"ADMIN_HEADERS",ok:false,message:"관리자 문서 확인 실패"})}

  try{
    const response=await fetcher(`${origin}/api/admin/workspaces?limit=1`);
    checks.push({key:"AUTH_GUARD",ok:response.status===401&&response.headers.get("www-authenticate")==='Bearer realm="storzy-admin"',message:"무인증 관리자 API 차단"});
  }catch{checks.push({key:"AUTH_GUARD",ok:false,message:"관리자 인증 차단 확인 실패"})}

  let workspaceId=input.workspaceId?.trim()||null;
  try{
    const response=await fetcher(`${origin}/api/admin/workspaces?limit=1`,{headers}),body=record(await json(response)),data=body?.data;
    checks.push({key:"ADMIN_ACCESS",ok:response.ok&&Array.isArray(data),message:"관리자 토큰 및 데이터베이스 조회"});
    if(!workspaceId&&Array.isArray(data)){const first=record(data[0]);workspaceId=typeof first?.id==="string"?first.id:null}
  }catch{checks.push({key:"ADMIN_ACCESS",ok:false,message:"인증된 관리자 API 확인 실패"})}

  let processes:PostDeployResult["processes"]=null,processConnected=false;
  const attempts=Math.max(1,Math.min(60,Math.trunc(input.processAttempts??1))),retryMs=Math.max(0,Math.min(60_000,Math.trunc(input.processRetryMs??10_000))),sleep=input.sleep??wait;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetcher(`${origin}/api/admin/process-health`,{headers}),parsed=processSummary(await json(response));
      processConnected=response.ok&&parsed!==null;
      if(parsed){processes={healthy:parsed.healthy,stale:parsed.stale,failed:parsed.failed,neverSeen:parsed.neverSeen,total:parsed.total};if(parsed.allHealthy)break}
    }catch{processConnected=false}
    if(attempt<attempts)await sleep(retryMs);
  }
  const expectedProcessCount=15,allProcessesHealthy=Boolean(processConnected&&processes&&processes.total===expectedProcessCount&&processes.healthy===expectedProcessCount&&processes.stale===0&&processes.failed===0&&processes.neverSeen===0);
  checks.push({key:"PROCESS_HEALTH",ok:allProcessesHealthy,message:allProcessesHealthy?`API·worker·scheduler ${expectedProcessCount}개 역할 정상`:"필수 프로세스가 누락·지연 또는 실패 상태"});

  let pilot:PostDeployResult["pilot"]=null;
  if(workspaceId)try{
    const response=await fetcher(`${origin}/api/workspaces/${encodeURIComponent(workspaceId)}/integrations/pilot-readiness`,{headers}),body=record(await json(response)),data=record(body?.data),next=record(data?.nextStep);
    const valid=response.ok&&typeof data?.ready==="boolean"&&typeof data.completed==="number"&&typeof data.total==="number";
    checks.push({key:"PILOT_API",ok:valid,message:"워크스페이스 파일럿 준비 API"});
    if(valid)pilot={ready:data.ready as boolean,completed:data.completed as number,total:data.total as number,nextStep:typeof next?.label==="string"?next.label:null};
  }catch{checks.push({key:"PILOT_API",ok:false,message:"파일럿 준비 API 확인 실패"})}
  else checks.push({key:"PILOT_API",ok:true,message:"워크스페이스가 없어 파일럿 API 확인 생략"});

  return{healthy:checks.every(check=>check.ok),checks,workspaceId,pilot,processes};
}
