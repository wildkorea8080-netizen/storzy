export const orderAutomationOrderGuardCss=`
.automation-order-guard{display:flex;gap:12px;align-items:flex-start;margin:0 0 14px;padding:14px;border:1px solid #efc9a4;border-radius:12px;background:#fff7ed;color:#7c3f0c}
.automation-order-guard[hidden]{display:none}
.automation-order-guard strong{display:block;margin-bottom:3px}
.automation-order-guard p{margin:0;font-size:13px;line-height:1.5}
.automation-order-guard a{color:inherit;font-weight:800}
.actions button[data-action="MANUAL_APPROVE"]:disabled{cursor:not-allowed;opacity:.48}
`;

export const orderAutomationOrderGuardJs=`(()=>{
const drawer=document.querySelector('#drawer'),approve=document.querySelector('[data-action="MANUAL_APPROVE"]');
if(!drawer||!approve)return;
let enabled=false,loaded=false,guard;
const workspace=()=>((document.querySelector('#workspace')?.value||sessionStorage.getItem('storzy.workspace')||'').trim());
const token=()=>((document.querySelector('#token')?.value||sessionStorage.getItem('storzy.adminToken')||'').trim());
function mount(){if(guard)return;guard=document.createElement('div');guard.className='automation-order-guard';guard.hidden=true;guard.setAttribute('role','status');guard.innerHTML='<div><strong>주문 자동화가 중지되어 있습니다.</strong><p>수동 승인으로도 Printful 제출을 재개할 수 없습니다. <a href="/admin/integrations">연동 및 출시 설정</a>에서 필수 조건을 확인하고 자동화를 승인해 주세요.</p></div>';approve.closest('.actions')?.before(guard)}
function render(){mount();const actionable=!drawer.hidden&&Boolean(drawer.dataset.id);approve.disabled=actionable&&(!loaded||!enabled);approve.title=!loaded?'주문 자동화 상태를 확인하는 중입니다.':!enabled?'주문 자동화를 먼저 승인해 주세요.':'';guard.hidden=!actionable||!loaded||enabled}
async function load(){const id=workspace();loaded=false;render();if(!id)return;try{const response=await fetch('/api/workspaces/'+encodeURIComponent(id)+'/order-automation',{headers:{...(token()?{Authorization:'Bearer '+token()}:{})}}),body=await response.json().catch(()=>({}));enabled=response.ok&&body.data?.enabled===true}finally{loaded=true;render()}}
document.querySelector('#connect')?.addEventListener('click',()=>setTimeout(load));
document.querySelector('#refresh')?.addEventListener('click',load);
window.addEventListener('storzy:automation-changed',load);
new MutationObserver(render).observe(drawer,{attributes:true,attributeFilter:['hidden','data-id']});
mount();if(workspace())load();else render();
})();`;
