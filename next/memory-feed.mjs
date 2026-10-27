import {photoForm} from './photo-views.mjs';
import {countBucket} from './analytics.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const FEED_PAGE_SIZE=12;
export function memoryQuery(api,db,context,filters={},cursor=null){
  const clauses=[api.where('status','==','published')];
  if(filters.place)clauses.push(api.where('placeId','==',filters.place==='free'?null:filters.place));
  if(filters.person)clauses.push(api.where('uid','==',filters.person));
  clauses.push(api.orderBy('createdAt','desc'),api.orderBy(api.documentId(),'desc'));
  if(cursor)clauses.push(api.startAfter(cursor));
  return api.query(api.collection(db,'groups',context.groupId,'trips',context.tripId,'posts'),...clauses,api.limit(FEED_PAGE_SIZE));
}
export function createMemoryFeed({app,api,db,photoStorage,current,getUser,call,perform,track}){
  let state=null;const urls=new Map();
  const valid=s=>state===s && current(s.context) && getUser()?.uid===s.uid;
  const common=s=>({group_id:s.context.groupId,trip_id:s.context.tripId,role:s.group.isOwner?'leader':'member',trip_status:s.closed?'ended':'active'});
  function clear(){state=null;for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();}
  const rows=s=>s.posts.length?s.posts.map(p=>`<article class="memory-item" data-post="${esc(p.id)}"><h3>${esc(s.names.get(p.uid)||'멤버')} · ${esc(p.placeId?s.places.get(p.placeId)?.name||'여행 장소':'자유 기록')}</h3><div class="memory-photo" data-photo-post="${esc(p.id)}"><span role="status">사진을 불러오고 있어요…</span></div>${p.feeling?`<p class="post-feeling">${esc(p.feeling)}</p>`:''}${!s.closed && p.uid===s.uid?'<div class="row"><button class="secondary" data-memory="edit">느낌 수정</button><button class="danger" data-memory="delete">기록 삭제</button></div><div class="post-editor"></div>':''}</article>`).join(''):'<p>조건에 맞는 추억이 없어요.</p>';
  async function images(s,version){
    const queue=[...s.posts];
    await Promise.all(Array.from({length:3},async()=>{while(queue.length && valid(s) && s.version===version){
      const post=queue.shift(),node=app.querySelector(`[data-photo-post="${post.id}"]`);if(!node)continue;
      const prefix=`groups/${s.context.groupId}/trips/${s.context.tripId}/uploads/${post.uid}/`,path=post.photo?.objectPath;
      try{
        if(typeof path!=='string' || !path.startsWith(prefix) || !/^[A-Za-z0-9_-]{16,128}$/.test(path.slice(prefix.length)))throw Error('사진 확인 실패');
        const key=post.id+':'+(post.photo.generation||'');let url=urls.get(key);
        if(!url){const blob=await api.getBlob(api.ref(photoStorage,path),5*1024*1024);if(!valid(s) || s.version!==version)return;url=URL.createObjectURL(blob);urls.set(key,url);}
        if(!valid(s) || s.version!==version)return;
        const img=document.createElement('img');img.src=url;img.alt='여행 사진';img.loading='lazy';node.replaceChildren(img);
      }catch{if(valid(s) && s.version===version)node.textContent='사진을 불러오지 못했어요. 새로고침으로 다시 확인해주세요.';}
    }}));
  }
  async function load(s,reset){
    const version=++s.version;if(reset){s.posts=[];s.cursor=null;s.edits.clear();app.querySelector('#memory-posts').replaceChildren();}
    const [result,trip]=await Promise.all([api.getDocsFromServer(memoryQuery(api,db,s.context,s.filters,reset?null:s.cursor)),api.getDocFromServer(api.doc(db,'groups',s.context.groupId,'trips',s.context.tripId))]);
    if(!valid(s) || s.version!==version)return;
    if(trip.data()?.status==='closed' && !s.closed){window.dispatchEvent(new Event('hashchange'));return;}
    const count=app.querySelector('[data-trip-post-count]');if(count)count.textContent=String(Number(trip.data()?.postCount)||0);
    s.posts=[...s.posts,...result.docs.map(d=>({id:d.id,...d.data()}))];s.cursor=result.docs.at(-1)||null;s.more=result.docs.length===FEED_PAGE_SIZE;
    app.querySelector('#memory-posts').innerHTML=rows(s);app.querySelector('[data-memory="more"]').hidden=!s.more;
    app.querySelector('#memory-status').textContent=`추억 ${s.posts.length}개 표시`;
    void images(s,version);
  }
  app.addEventListener('change',event=>{
    const s=state;if(!s || !valid(s) || !event.target.matches('[data-feed-filter]'))return;
    s.filters[event.target.dataset.feedFilter]=event.target.value;
    perform(()=>load(s,true));
  });
  app.addEventListener('click',event=>{
    const button=event.target.closest('button[data-memory]'),s=state;if(!button || button.disabled || !s || !valid(s))return;
    const action=button.dataset.memory;
    if(action==='more' || action==='refresh'){perform(()=>load(s,action==='refresh'));return;}
    if(s.closed)return;
    if(action==='cleanup'){
      const postId=button.dataset.cleanupId;if(!s.cleanup.has(postId))return;
      perform(async()=>{const result=await call('deletePost',{groupId:s.context.groupId,tripId:s.context.tripId,postId});if(valid(s) && !result.cleanupPending){s.cleanup.delete(postId);button.remove();}});return;
    }
    const article=button.closest('[data-post]'),post=s.posts.find(p=>p.id===article?.dataset.post);if(!post || post.uid!==s.uid)return;
    if(action==='edit'){
      const pending=s.edits.get(post.id);
      article.querySelector('.post-editor').innerHTML=`<form data-edit-post="${esc(post.id)}"><label>한 줄 느낌 수정 (선택)<textarea aria-label="한 줄 느낌 수정 (선택)" name="feeling" maxlength="60" rows="2" ${pending?'readonly':''}>${esc(pending?.feeling??post.feeling)}</textarea></label><button>${pending?'같은 수정 다시 저장':'수정 저장'}</button></form>`;return;
    }
    if(action==='delete'){
      if(!confirm('이 기록을 삭제할까요? 이 장소의 내 사진을 모두 지우면 스탬프도 미완료가 돼요.'))return;
      perform(async()=>{
        const result=await call('deletePost',{groupId:s.context.groupId,tripId:s.context.tripId,postId:post.id});
        if(!valid(s))return;
        track('post_delete',{...common(s),was_stamp:result.wasStamp});
        for(const [key,url] of urls)if(key.startsWith(post.id+':')){URL.revokeObjectURL(url);urls.delete(key);}
        const count=app.querySelector('[data-trip-post-count]');if(count)count.textContent=String(result.postCount);
        await load(s,true);
        if(valid(s) && result.cleanupPending){s.cleanup.add(post.id);const retry=document.createElement('button');retry.className='secondary';retry.dataset.memory='cleanup';retry.dataset.cleanupId=post.id;retry.textContent='삭제한 사진 파일 정리 재시도';app.querySelector('#memory-status').after(retry);}
        if(valid(s))app.querySelector('#memory-status').textContent=result.cleanupPending?'기록은 삭제됐어요. 사진 파일 정리는 다시 확인할 수 있어요.':result.stampRemoved?'기록을 삭제했어요. 이 장소의 내 스탬프는 미완료예요.':'기록을 삭제했어요.';
      });
    }
  });
  app.addEventListener('submit',event=>{
    const form=event.target,s=state;if(!form.dataset.editPost)return;event.preventDefault();if(!s || !valid(s) || s.closed)return;
    const post=s.posts.find(p=>p.id===form.dataset.editPost);if(!post || post.uid!==s.uid)return;
    const feeling=form.elements.feeling.value.trim();if([...feeling].length>60)return;
    if(!s.edits.has(post.id))s.edits.set(post.id,{feeling,revision:post.revision||0,requestId:crypto.randomUUID()});
    form.elements.feeling.readOnly=true;
    perform(async()=>{await call('editPost',{groupId:s.context.groupId,tripId:s.context.tripId,postId:post.id,...s.edits.get(post.id)});if(valid(s)){s.edits.delete(post.id);await load(s,true);}});
  });
  return {
    clear,
    async refresh(context){if(state && state.context===context && valid(state))await load(state,true);},
    async render(context,group,trip,places,members){
      clear();const s=state={context,group,uid:getUser()?.uid,closed:trip.status==='closed',filters:{},posts:[],cursor:null,version:0,edits:new Map(),cleanup:new Set(),places:new Map(places.map(p=>[p.id,p])),names:new Map(members.map(m=>[m.id,m.displayName]))};
      const result=await api.getDocsFromServer(memoryQuery(api,db,context));if(!valid(s))return '';
      s.posts=result.docs.map(d=>({id:d.id,...d.data()}));s.cursor=result.docs.at(-1)||null;s.more=result.docs.length===FEED_PAGE_SIZE;
      track('feed_view',{...common(s),post_count_bucket:countBucket(Number(trip.postCount)||0)});
      return `<h2 id="trip-panel-title">함께 남긴 추억</h2>${s.closed?'':`<details class="free-post"><summary>자유 기록 남기기</summary>${photoForm('free')}</details>`}<div class="feed-filters"><label>장소별<select aria-label="장소별" data-feed-filter="place"><option value="">모든 장소</option><option value="free">자유 기록</option>${places.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><label>사람별<select aria-label="사람별" data-feed-filter="person"><option value="">모든 사람</option>${members.map(m=>`<option value="${esc(m.id)}">${esc(m.displayName)}${m.id===s.uid?' (나)':''}</option>`).join('')}</select></label></div><p id="memory-status" role="status">최신순 · 저장된 기록 ${Number(trip.postCount)||0}개</p><button class="secondary" data-memory="refresh">추억 새로고침</button><div id="memory-posts">${rows(s)}</div><button class="secondary" data-memory="more" ${s.more?'':'hidden'}>추억 더 보기</button>${s.closed?'<p>종료된 여행의 추억을 다시 둘러보세요.</p>':''}`;
    },
    mount(){if(state && app.querySelector)void images(state,state.version);}
  };
}
