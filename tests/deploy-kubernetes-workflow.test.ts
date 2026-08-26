import{readFile}from"node:fs/promises";import{describe,expect,it}from"vitest";
const workflowUrl=new URL("../.github/workflows/deploy-kubernetes.yml",import.meta.url);
describe("Kubernetes 운영 배포 workflow",()=>{
it("수동 실행과 production 환경 승인을 사용한다",async()=>{const w=await readFile(workflowUrl,"utf8");expect(w).toContain("workflow_dispatch:");expect(w).toContain("environment: production");expect(w).toContain("cancel-in-progress: false")});
it("migration 이후 workload를 적용한다",async()=>{const w=await readFile(workflowUrl,"utf8");expect(w.indexOf("Apply workloads")).toBeGreaterThan(w.indexOf("Apply and wait for migration"));expect(w).toContain("storzy.migration.k8s.yaml")});
it("10개 deployment와 5개 scheduler를 검증한다",async()=>{const w=await readFile(workflowUrl,"utf8");expect(w).toContain("Expected 10 STORZY deployments");for(const name of["storzy-privacy-sla-scan","storzy-privacy-alert-delivery","storzy-order-reconciliation","storzy-shopify-token-alert-delivery","storzy-admin-auth-retention"])expect(w).toContain(name);expect(w).toContain('create job --from="cronjob/$scheduler"')});
it("배포 후 검증과 보안 설정을 유지한다",async()=>{const w=await readFile(workflowUrl,"utf8");expect(w).toContain("uses: ./.github/workflows/post-deploy-verify.yml");expect(w).toContain("expected_release: ${{ inputs.image_reference }}");expect(w).toContain("ADMIN_API_TOKEN: ${{ secrets.ADMIN_API_TOKEN }}");expect(w).not.toContain("kubectl create secret");expect(w).not.toContain("echo $KUBECONFIG_BASE64")});
});
