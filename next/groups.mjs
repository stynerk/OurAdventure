import {readPending,prepareRequest,finishRequest} from './creation-requests.mjs';
import {createTripViews} from './trip-views.mjs';

export function createGroupViews({app,api,db,getUser,call,perform,say,isCurrent,storage,track=()=>{}}) {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeId=value=>typeof value==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  const routes=new Set(['groups','group','group-create','trip-create','trip','group-join']);
  let active=null;
  const current=context=>active===context && isCurrent(context.version) && getUser()?.uid===context.uid;
  const tripViews=createTripViews({app,api,db,current,getUser,track,call,perform});
  const login=()=>'<p>그룹을 만들려면 Google 로그인이 필요해요.</p><button data-action="login">Google로 로그인</button>';
  const account=()=>getUser()?'<button class="secondary" data-action="logout">로그아웃</button>':'';
  const errorCard=(title,href='#groups')=>`<section class="card"><h1>${esc(title)}</h1><p>로그인·그룹 참여 상태와 연결을 확인해주세요.</p><a href="${href}">목록으로 돌아가기</a> <button class="secondary" data-v2-action="refresh">다시 확인</button></section>`;
  const timestamp=t=>t?.seconds??0;
  const status=t=>t.status==='closed'?'종료':'진행 중';
  async function getGroup(context) {
    const {groupId:g,uid}=context;
    if(!uid || !safeId(g))throw new Error('접근 불가');
    const [group,member]=await Promise.all([
      api.getDocFromServer(api.doc(db,'groups',g)),
      api.getDocFromServer(api.doc(db,'groups',g,'members',uid))
    ]);
    if(!group.exists() || !member.exists())throw new Error('접근 불가');
    return {id:g,...group.data(),isOwner:group.data().ownerId===uid && member.data().role==='owner'};
  }
  function pendingPanel(context,kind) {
    const panel=app.querySelector('#v2-pending');if(!panel || !current(context))return;
    let pending;
    try{pending=readPending(storage,context.uid,kind,context.groupId||'');}
    catch{panel.innerHTML='<section class="card"><p>이 기기의 생성 요청을 확인하지 못했어요. 중복 생성을 막기 위해 기존 그룹·여행 목록을 먼저 확인해주세요.</p><a href="#groups">내 그룹 확인</a></section>';return;}
    panel.innerHTML=pending?`<section class="card"><h2>이전 생성 요청이 남아 있어요</h2><p>${esc(pending.payload.title)} · 결과를 확인한 뒤 새로 만들 수 있어요.</p><button class="secondary" data-v2-action="retry-create" data-kind="${kind}">이전 요청 확인</button></section>`:'';
  }
  function groupForm(context) {
    app.innerHTML=`<section class="card"><a href="#groups">← 내 그룹</a><h1>새 그룹 만들기</h1>${!context.uid || getUser().isAnonymous?login():'<form id="v2-group-create"><label>그룹 이름<input name="title" maxlength="60" required autocomplete="off" placeholder="함께 떠날 그룹 이름"></label><button>그룹 만들기</button></form>'}</section><div id="v2-pending"></div>`;
    pendingPanel(context,'group');
  }
  async function groupList(context) {
    if(!context.uid){app.innerHTML=`<section class="card"><h1>내 그룹</h1><p>같은 사람들과 새로운 여행을 쌓아보세요.</p>${login()}</section><a href="#legacy">기존 공동 탐험방 열기</a>`;return;}
    const result=await api.getDocsFromServer(api.query(api.collection(db,'groups'),api.where('memberIds','array-contains',context.uid)));
    if(!current(context))return;
    const groups=result.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>timestamp(b.createdAt)-timestamp(a.createdAt));
    app.innerHTML=`<section class="card"><h1>내 그룹</h1><p>그룹은 그대로, 새로운 여행은 계속 이어가요.</p><div class="row">${!getUser().isAnonymous?'<a class="button" href="#group-create">새 그룹 만들기</a>':''}${account()}</div></section>${groups.length?groups.map(g=>`<section class="card"><h2><a href="#group/${esc(g.id)}">${esc(g.title)}</a></h2><p>멤버 ${Number(g.memberCount)||0}명</p></section>`).join(''):`<section class="card"><h2>아직 참여한 그룹이 없어요</h2><p>${getUser().isAnonymous?'리더가 보낸 그룹 초대를 기다려주세요.':'첫 그룹을 만들어 여행을 시작해보세요.'}</p></section>`}<p><button class="secondary" data-v2-action="refresh">목록 새로고침</button> <a href="#legacy">기존 공동 탐험방 열기</a></p>`;
  }
  async function groupDetail(context) {
    const g=await getGroup(context);
    const trips=await api.getDocsFromServer(api.collection(db,'groups',g.id,'trips'));
    if(!current(context))return;
    const rows=trips.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>timestamp(b.createdAt)-timestamp(a.createdAt));
    const section=(closed,title)=>`<section class="card"><h2>${title}</h2>${rows.filter(t=>(t.status==='closed')===closed).map(t=>`<article class="trip-list-item"><span class="badge">${status(t)}</span><h3><a href="#trip/${esc(g.id)}/${esc(t.id)}">${esc(t.title)}</a></h3><p>${esc(t.destination)} · ${esc(t.startDate)} ~ ${esc(t.endDate)}</p><p class="muted">장소 ${Number(t.placeCount)||0}개 · 기록 ${Number(t.postCount)||0}개</p></article>`).join('')||`<p>${closed?'종료된 여행이 없어요.':'진행 중인 여행이 없어요.'}</p>`}</section>`;
    app.innerHTML=`<section class="card"><a href="#groups">← 내 그룹</a><h1>${esc(g.title)}</h1><p>멤버 ${Number(g.memberCount)||0}명 / 10명 · 여행 ${rows.length}개</p>${g.isOwner?`<a class="button" href="#trip-create/${esc(g.id)}">새 여행 만들기</a>`:''}</section>${g.isOwner?'<section class="card"><h2>멤버 초대</h2><p>방장 포함 최대 10명이 함께해요. 재발급하면 이전 링크는 새 참여에 사용할 수 없고, 기존 멤버는 유지돼요.</p><button data-v2-action="create-invite">초대 링크 생성·재발급</button><div id="v2-invite"></div></section>':''}${section(false,'진행 중인 여행')}${section(true,'지난 여행')}<button class="secondary" data-v2-action="refresh">목록 새로고침</button>`;
  }
  function inviteUnavailable(state) {
    app.innerHTML=`<section class="card"><h1>${state==='full'?'그룹 정원이 모두 찼어요':'초대 링크를 확인해주세요'}</h1><p>${state==='full'?'최대 10명까지 참여할 수 있어요. 리더에게 문의해주세요.':'유효하지 않거나 재발급된 링크예요. 리더에게 새 링크를 요청해주세요.'}</p><a href="#groups">내 그룹으로</a></section>`;
  }
  async function inviteView(context) {
    const summary=await call('previewGroupInvite',{token:context.groupId});
    if(!current(context))return;
    if(summary.state==='member'){location.hash=`group/${summary.groupId}`;return;}
    if(summary.state!=='ready'){inviteUnavailable(summary.state);return;}
    app.innerHTML=`<section class="card"><h1>${esc(summary.title)}</h1><h2>그룹에 초대받았어요</h2><form id="v2-group-join"><label>탐험가 별칭<input name="nickname" required maxlength="24" autocomplete="off" placeholder="실명 대신 별칭을 써주세요"></label><p class="muted">이 브라우저의 참여 기록을 이어서 사용해요. 다른 기기에서는 이어서 쓰기 어려울 수 있어요. 브라우저 데이터를 지우거나 로그아웃하면 익명 기록에 다시 연결하기 어려워요.</p><button>그룹 참여하기</button></form></section>`;
  }
  async function tripForm(context) {
    const g=await getGroup(context);if(!current(context))return;
    if(!g.isOwner){app.innerHTML=`<section class="card"><h1>리더만 여행을 만들 수 있어요</h1><a href="#group/${esc(g.id)}">그룹으로 돌아가기</a></section>`;return;}
    app.innerHTML=`<section class="card"><a href="#group/${esc(g.id)}">← ${esc(g.title)}</a><h1>새 여행 만들기</h1><p>이전 여행의 장소·사진·완료 기록을 가져오지 않아요.</p><form id="v2-trip-create"><label>여행 이름<input name="title" maxlength="80" required autocomplete="off"></label><label>목적지<input name="destination" maxlength="100" required autocomplete="off" placeholder="예: 경주, 제주, 도쿄"></label><div class="row"><label>시작 날짜<input name="startDate" type="date" required></label><label>종료 날짜<input name="endDate" type="date" required></label></div><label>방문 장소 <span class="muted">선택</span><textarea name="places" rows="5" placeholder="한 줄에 장소 하나씩, 최대 10개"></textarea></label><p class="muted">장소 없이 여행을 만들고 나중에 추가해도 괜찮아요.</p><button>여행 만들기</button></form></section><div id="v2-pending"></div>`;
    // Always a fresh form. Unresolved requests are recoverable in a separate panel.
    pendingPanel(context,'trip');
  }
  async function tripDetail(context) {
    const group=await getGroup(context);if(!current(context))return;
    await tripViews.open(context,group);
  }
  async function open(params,version) {
    const context={...params,version,uid:getUser()?.uid};active=context;
    try {
      if(params.view==='group-join')await inviteView(context);
      else if(params.view==='group-create')groupForm(context);
      else if(params.view==='group')await groupDetail(context);
      else if(params.view==='trip-create')await tripForm(context);
      else if(params.view==='trip')await tripDetail(context);
      else await groupList(context);
    }catch {if(current(context))app.innerHTML=errorCard('목록이나 여행을 불러오지 못했어요');}
  }
  async function sendCreation(context,pending) {
    const name=pending.kind==='group'?'createGroup':'createTrip';
    const result=await call(name,{...pending.payload,requestId:pending.requestId});
    // Remove only this account's matching request, never any other account's state.
    try{finishRequest(storage,pending);}catch {if(current(context))say('생성은 확인됐지만 이 기기의 요청 기록을 정리하지 못했어요.');}
    if(!current(context))return;
    location.hash=pending.kind==='group'?`group/${result.groupId}`:`trip/${result.groupId}/${result.tripId}`;
  }
  app.addEventListener('submit',event=>{
    const form=event.target;if(!['v2-group-create','v2-trip-create','v2-group-join'].includes(form.id))return;
    event.preventDefault();const context=active;if(!context || !current(context))return;
    if(form.id==='v2-group-join'){
      const nickname=new FormData(form).get('nickname');
      perform(async()=>{
        try{
          const result=await call('joinGroup',{token:context.groupId,nickname});
          if(current(context))location.hash=`group/${result.groupId}`;
        }catch(error){
          if(!current(context))return;
          if(['functions/resource-exhausted','functions/not-found'].includes(error.code))inviteUnavailable(error.code==='functions/resource-exhausted'?'full':'invalid');
          throw error;
        }
      });
      return;
    }
    const data=Object.fromEntries(new FormData(form)),kind=form.id==='v2-group-create'?'group':'trip';
    const payload=kind==='group'?{title:data.title.trim()}:{groupId:context.groupId,title:data.title.trim(),destination:data.destination.trim(),startDate:data.startDate,endDate:data.endDate,places:data.places.split('\n').map(s=>s.trim()).filter(Boolean).map(name=>({name}))};
    perform(async()=>{
      try {
        if(kind==='trip' && payload.endDate<payload.startDate)throw new Error('종료 날짜는 시작 날짜보다 빠를 수 없어요.');
        if(payload.places?.length>10)throw new Error('장소는 최대 10개까지 입력해주세요.');
        let pending;
        try{pending=prepareRequest(storage,context.uid,kind,context.groupId||'',payload,()=>crypto.randomUUID());}
        catch(error){throw new Error('생성 요청을 보관하지 못했어요. '+error.message);}
        await sendCreation(context,pending);
      }catch(error){
        if(current(context)) {
          pendingPanel(context,kind);
          if(error.code==='functions/invalid-argument'){
            const pending=readPending(storage,context.uid,kind,context.groupId||'');
            try{if(pending)finishRequest(storage,pending);}catch {}
            pendingPanel(context,kind);
          }
          throw error;
        }
      }
    });
  });
  app.addEventListener('click',event=>{
    const button=event.target.closest('button[data-v2-action]');if(!button || button.disabled)return;
    const context=active;if(!context || !current(context))return;
    if(button.dataset.v2Action==='create-invite'){
      perform(async()=>{
        const pendingPanel=app.querySelector('#v2-invite');
        if(pendingPanel)pendingPanel.innerHTML='<p>새 초대 링크를 준비하고 있어요…</p>';
        const result=await call('createGroupInvite',{groupId:context.groupId});
        if(!current(context))return;
        const panel=app.querySelector('#v2-invite');if(!panel)return;
        const link=`${location.origin}${location.pathname}#group-join/${result.token}`;
        panel.innerHTML=`<label>그룹 초대 링크<input id="v2-invite-link" readonly value="${esc(link)}"></label><button class="secondary" data-v2-action="copy-invite">초대 링크 복사</button><p id="v2-invite-status" class="muted">이 링크를 공유하면 별칭만으로 참여할 수 있어요.</p>`;
      });return;
    }
    if(button.dataset.v2Action==='copy-invite'){
      const input=app.querySelector('#v2-invite-link');if(!input)return;
      perform(async()=>{await navigator.clipboard.writeText(input.value);if(current(context))app.querySelector('#v2-invite-status').textContent='초대 링크를 복사했어요.';});return;
    }
    if(button.dataset.v2Action==='refresh'){window.dispatchEvent(new Event('hashchange'));return;}
    if(button.dataset.v2Action==='retry-create'){
      const pending=readPending(storage,context.uid,button.dataset.kind,context.groupId||'');
      if(pending)perform(()=>sendCreation(context,pending));
    }
  });
  return {handles:view=>routes.has(view),open};
}
