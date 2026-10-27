import {illustratedMap} from './illustrated-map.mjs';
import {createPhotoViews,photoForm} from './photo-views.mjs';
import {createMemoryFeed} from './memory-feed.mjs';
import {createReportViews} from './report-views.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const TRIP_TABS=Object.freeze(['map','course','stamps','memory']);
export function googlePlaceUrl(destination,place) {
  const url=new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api','1');url.searchParams.set('query',`${destination||''} ${place.name||''}`.trim());
  if(typeof place.googlePlaceId==='string' && /^[A-Za-z0-9_-]{1,255}$/.test(place.googlePlaceId))url.searchParams.set('query_place_id',place.googlePlaceId);
  return url.href;
}
export function completionSummary(placeIds,members,completions) {
  const allowed=new Set(placeIds),byMember=new Map(members.map(m=>[m.id,new Set()]));
  for(const c of completions)if(allowed.has(c.placeId) && byMember.has(c.uid) && c.photoCount>0)byMember.get(c.uid).add(c.placeId);
  return byMember;
}
export function createTripViews({app,api,db,photoStorage,current,getUser,call,perform,track=()=>{},activate=()=>document.body.classList.add('trip-active'),confirmEnd=()=>confirm('여행을 종료할까요? 종료 후 사진과 스탬프는 읽기 전용이 되며 되돌릴 수 없어요.')}) {
  const reports=createReportViews({app,api,photoStorage,getUser,current,call,perform,track});
  const memories=createMemoryFeed({app,api,db,photoStorage,getUser,current,call,perform,track});
  const photos=createPhotoViews({app,api,photoStorage,getUser,current,call,perform,track,onSaved:context=>memories.refresh(context)});
  let active=null;
  app.addEventListener('click',event=>{
    const button=event.target.closest('button[data-trip-action="end"]');
    if(!button || button.disabled || !active || active.closed || !active.group.isOwner || !current(active.context))return;
    const {context}=active;
    if(!confirmEnd())return;
    perform(async()=>{
      await call('endTrip',{groupId:context.groupId,tripId:context.tripId});
      if(current(context))location.hash=`trip/${encodeURIComponent(context.groupId)}/${encodeURIComponent(context.tripId)}/map`;
    });
  });
  const timestamp=t=>t?.seconds||0;
  async function open(context,group) {
    memories.clear();reports.clear();
    const {groupId:g,tripId:t}=context;
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(t||''))throw Error('잘못된 여행 주소');
    const root=['groups',g,'trips',t];let tab=context.tab||'map';
    const snapshot=await api.getDocFromServer(api.doc(db,...root));
    if(!current(context))return;
    if(!snapshot.exists())throw Error('없는 여행');
    const trip=snapshot.data();
    if(tab==='manage' && trip.status==='closed')tab='map';
    if(![...TRIP_TABS,'stamp','manage','report','share'].includes(tab))throw Error('없는 화면');
    if(tab==='manage' && !group.isOwner){app.innerHTML='<section class="card"><h1>리더만 여행을 관리할 수 있어요</h1><a href="#groups">내 그룹으로</a></section>';return;}
    const [placeSnap,memberSnap,doneSnap]=await Promise.all([
      api.getDocsFromServer(api.collection(db,...root,'places')),
      api.getDocsFromServer(api.collection(db,'groups',g,'members')),
      api.getDocsFromServer(api.collection(db,...root,'completions'))
    ]);
    if(!current(context))return;
    const byId=new Map(placeSnap.docs.map(d=>[d.id,{id:d.id,...d.data()}]));
    const places=(trip.placeIds||[]).map(id=>byId.get(id)).filter(Boolean);
    const members=memberSnap.docs.map(d=>({id:d.id,...d.data()}));
    const summaries=completionSummary(places.map(p=>p.id),members,doneSnap.docs.map(d=>d.data()));
    const done=summaries.get(getUser()?.uid)||new Set(),closed=trip.status==='closed';
    const base=`#trip/${encodeURIComponent(g)}/${encodeURIComponent(t)}`;
    const placeLink=p=>`${base}/stamp/${encodeURIComponent(p.id)}`;
    const badge=p=>`<span class="badge" data-own-stamp>${done.has(p.id)?'내 스탬프 완료':'내 스탬프 미완료'}</span>`;
    const empty='<p>아직 장소를 정하지 않았어요.</p>';
    const mapLink=p=>`<a href="${escape(googlePlaceUrl(trip.destination,p))}" target="_blank" rel="noopener noreferrer">${escape(p.name)} · Google 지도 열기 ↗</a>`;
    const mission=p=>{
      const content=p.mission||{};
      return `<h3>${escape(content.question||'이곳에서 어떤 장면을 발견했나요?')}</h3><p>${escape(content.observation||'주변을 천천히 둘러보고 마음에 드는 장면을 찾아보세요.')}</p><p class="muted">${escape(content.photoIdea||'오늘 기억하고 싶은 모습을 사진으로 남겨보세요.')}</p>`;
    };
    let content='';
    if(tab==='report' || tab==='share'){
      content=closed?await reports.render(context,group,tab):'<h2 id="trip-panel-title">여행 종료 후 결과를 볼 수 있어요</h2>';
    }else if(tab==='map'){
      const next=closed?null:places.find(p=>!done.has(p.id));
      content=`<h2 id="trip-panel-title">여행 지도</h2>${places.length?illustratedMap(places,done,placeLink):empty}${next?`<a class="button" href="${placeLink(next)}">다음 탐험 · ${escape(next.name)}</a>`:places.length && done.size===places.length?'<p>모든 장소의 내 스탬프를 모았어요!</p>':''}`;
    }else if(tab==='course'){
      content=`<h2 id="trip-panel-title">여행 코스</h2>${places.length?`<ol class="course-stops">${places.map(p=>`<li><h3><a href="${placeLink(p)}">${escape(p.name)}</a></h3>${badge(p)}${mission(p)}</li>`).join('')}</ol>`:empty}`;
    }else if(tab==='stamps'){
      content=`<h2 id="trip-panel-title">내 스탬프 ${done.size}/${places.length}</h2><div class="stamp-grid">${places.map(p=>`<a class="stamp-tile ${done.has(p.id)?'is-done':''}" href="${placeLink(p)}"><span aria-hidden="true">${escape(p.icon||'📍')}</span><strong>${escape(p.name)}</strong><small>${done.has(p.id)?'완료':'미완료'}</small></a>`).join('')}</div>${places.length?'':empty}<h3>멤버별 진행</h3><ul class="members">${members.map(m=>`<li><strong>${escape(m.displayName)}${m.id===getUser()?.uid?' (나)':''}</strong>스탬프 ${summaries.get(m.id)?.size||0}/${places.length}</li>`).join('')}</ul>`;
    }else if(tab==='memory'){
      content=await memories.render(context,group,trip,places,members);
    }else if(tab==='stamp'){
      const p=byId.get(context.placeId);
      if(!p || !places.some(place=>place.id===p.id))throw Error('없는 장소');
      content=`<h2 id="trip-panel-title">${escape(p.icon||'📍')} ${escape(p.mission?.stampName||p.name)}</h2>${badge(p)}${mission(p)}<p>${mapLink(p)}</p>${closed?'<p>종료된 여행이에요. 스탬프는 읽기만 할 수 있어요.</p>':photoForm()}<a href="${base}/stamps">스탬프판으로</a>`;
    }else{
      content=`<h2 id="trip-panel-title">여행 관리</h2><p>그룹 멤버 ${members.length}/10명</p><p>${closed?'종료된 여행이에요. 기존 기록을 계속 볼 수 있어요.':'그룹에서 초대 링크를 발급하고 참여 현황을 확인할 수 있어요.'}</p><a class="button" href="#group/${escape(g)}">초대 링크·참여 관리</a><h3>참여 현황</h3><ul class="members">${members.map(m=>`<li><strong>${escape(m.displayName)}${m.role==='owner'?' (리더)':''}</strong>스탬프 ${summaries.get(m.id)?.size||0}/${places.length}</li>`).join('')}</ul>`;
    }
    if(tab==='manage' && group.isOwner && !closed)content+='<hr><p>종료하면 사진·스탬프는 읽기 전용이 되고 기존 기록은 계속 볼 수 있어요.</p><button class="danger" data-trip-action="end">여행 종료</button>';
    if(!current(context))return;
    active={context,group,closed};
    const selected=tab==='stamp'?'stamps':['report','share'].includes(tab)?'memory':tab;
    app.innerHTML=`<section class="card trip-heading"><a href="#group/${escape(g)}">← ${escape(group.title)}</a><span class="badge">${closed?'종료':'진행 중'}</span><h1>${escape(trip.title)}</h1><p>${escape(trip.destination)} · ${escape(trip.startDate)} ~ ${escape(trip.endDate)}</p><p>장소 ${places.length}개 · 기록 <span data-trip-post-count>${Number(trip.postCount)||0}</span>개</p>${closed?'<p>종료된 여행이에요. 기존 여행 정보는 계속 볼 수 있어요.</p>':''}${group.isOwner && !closed && tab!=='manage'?`<a class="button secondary" href="${base}/manage">여행 관리</a>`:''}</section><section class="card trip-panel" aria-labelledby="trip-panel-title">${content}</section><nav class="trip-tabs" aria-label="여행 화면">${[['map','🗺️','지도'],['course','🧭','코스'],['stamps','🏅','스탬프'],['memory','📷','추억']].map(([key,icon,label])=>`<a href="${base}/${key}" ${selected===key?'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</a>`).join('')}</nav>`;
    if(closed && !['report','share'].includes(tab))app.querySelector?.('.trip-heading')?.insertAdjacentHTML('beforeend',`<a class="button secondary" href="${base}/report">여행 리포트 보기</a>`);
    activate();
    if(['report','share'].includes(tab) && closed)reports.mount();
    if(tab==='stamp' && !closed)await photos.mount(context,group,places.findIndex(p=>p.id===context.placeId)+1);
    if(tab==='memory'){memories.mount();if(!closed)await photos.mount(context,group,0);}
    if(tab!=='manage')track('screen_view',{screen_name:tab==='stamp'?'stamp_detail':tab==='share'?'share_image':tab,role:group.isOwner?'leader':'member',group_id:g,trip_id:t,trip_status:closed?'ended':'active'});
  }
  return {open,clearMemory:()=>{memories.clear();reports.clear();},clearPhotos:()=>{photos.clear();memories.clear();reports.clear();}};
}
