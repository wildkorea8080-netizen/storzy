import{productionProcesses}from"./production-templates.js";
type Json=Record<string,unknown>;
const labels=(role:string)=>({"app.kubernetes.io/name":"storzy","app.kubernetes.io/component":role});
const podSecurity={runAsNonRoot:true,seccompProfile:{type:"RuntimeDefault"}};
const containerSecurity={allowPrivilegeEscalation:false,readOnlyRootFilesystem:true,capabilities:{drop:["ALL"]}};
const resources={requests:{cpu:"100m",memory:"128Mi"},limits:{cpu:"1000m",memory:"512Mi"}};
const container=(role:string,image:string,command:string,api=false)=>({name:role,image,imagePullPolicy:"IfNotPresent",command:command.split(" "),env:[{name:"NPM_CONFIG_CACHE",value:"/tmp/.npm"},{name:"STORZY_RELEASE",value:image}],envFrom:[{secretRef:{name:"storzy-runtime"}}],securityContext:containerSecurity,resources,...api?{ports:[{name:"http",containerPort:3000}],readinessProbe:{httpGet:{path:"/ready",port:"http"},initialDelaySeconds:5,periodSeconds:10,timeoutSeconds:3,failureThreshold:3},livenessProbe:{httpGet:{path:"/health",port:"http"},initialDelaySeconds:20,periodSeconds:30,timeoutSeconds:3,failureThreshold:3}}:{}});
const podSpec=(role:string,image:string,command:string,api=false)=>({serviceAccountName:"storzy",automountServiceAccountToken:false,securityContext:podSecurity,containers:[container(role,image,command,api)],terminationGracePeriodSeconds:40});
const metadata=(name:string,role:string)=>({name,labels:labels(role)});

const buildResources=(image:string)=>{
  if(!/^ghcr\.io\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/.test(image))throw new Error("Image must be a lowercase GHCR reference pinned by sha256 digest");
  const processes=productionProcesses().processes,documents:Json[]=[
    {apiVersion:"v1",kind:"ServiceAccount",metadata:{name:"storzy"},automountServiceAccountToken:false},
    {apiVersion:"v1",kind:"Service",metadata:metadata("storzy-api","api"),spec:{selector:labels("api"),ports:[{name:"http",port:80,targetPort:"http"}]}},
    {apiVersion:"batch/v1",kind:"Job",metadata:metadata(`storzy-migrate-${image.slice(-12)}`,"migration"),spec:{backoffLimit:1,ttlSecondsAfterFinished:86400,template:{metadata:{labels:labels("migration")},spec:{...podSpec("migration",image,"node dist/src/db/migrate.js"),restartPolicy:"Never"}}}},
  ];
  for(const process of processes){
    const name=`storzy-${process.name}`;
    if(process.type==="scheduler")documents.push({apiVersion:"batch/v1",kind:"CronJob",metadata:metadata(name,process.name),spec:{schedule:process.schedule,concurrencyPolicy:"Forbid",successfulJobsHistoryLimit:2,failedJobsHistoryLimit:3,jobTemplate:{spec:{backoffLimit:1,ttlSecondsAfterFinished:86400,template:{metadata:{labels:labels(process.name)},spec:{...podSpec(process.name,image,process.command),restartPolicy:"Never"}}}}}});
    else documents.push({apiVersion:"apps/v1",kind:"Deployment",metadata:metadata(name,process.name),spec:{replicas:1,strategy:process.type==="worker"?{type:"Recreate"}:{type:"RollingUpdate",rollingUpdate:{maxUnavailable:0,maxSurge:1}},selector:{matchLabels:labels(process.name)},template:{metadata:{labels:labels(process.name)},spec:podSpec(process.name,image,process.command,process.name==="api")}}});
  }
  return documents;
};
const serialize=(documents:Json[])=>documents.map(document=>JSON.stringify(document,null,2)).join("\n---\n")+"\n";
export function buildKubernetesBundle(image:string){const documents=buildResources(image),serviceAccount=documents.find(item=>item.kind==="ServiceAccount")!,migration=documents.find(item=>item.kind==="Job")!;return{all:serialize(documents),migration:serialize([serviceAccount,migration]),workloads:serialize(documents.filter(item=>item.kind!=="Job"))}}
export function buildKubernetesManifest(image:string){return buildKubernetesBundle(image).all}
