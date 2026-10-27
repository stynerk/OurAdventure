import {readRoomIds,rememberRoom,readCreateRequest,getCreateRequest,clearCreateRequest,loadAccessibleRooms} from './session.mjs';
import {createGroupViews} from './groups.mjs';
const localState={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)};
const app = document.querySelector('#app'), message = document.querySelector('#message');
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say = text => {message.textContent = text;};
let enableIndividualPilot=false;
let groupViews;
let api, auth, db, functions, course, user, room, me, members = [], inviteToken = '', inviteRoomId = '', stops = [], generation = 0, busy = false;
const configMissing = () => {
  app.innerHTML = '<section class="card"><h1>함께하는 탐험을 준비하고 있어요</h1><p>아직 서비스 연결 설정이 완료되지 않았어요. 기존 경주 가족 탐험은 계속 이용할 수 있어요.</p><a class="button" href="../">경주 탐험 열기</a></section>';
};
function clearListeners() {stops.forEach(stop=>stop());stops=[];room=null;me=null;members=[];}
async function call(name, data) {return (await api.httpsCallable(functions,name)(data)).data;}
async function ensureUser() {
  await auth.authStateReady();
  if (!auth.currentUser) await api.signInAnonymously(auth);
  user = auth.currentUser;
  return user;
}
function signOutButton(){return user ? '<button class="secondary" data-action="logout">로그아웃</button>' : '';}
function rememberHere(id) {
  if(!rememberRoom(localState,user?.uid,id))say('여행은 저장됐지만 이 기기의 여행 목록에 추가하지 못했어요. 현재 여행 주소를 보관해 주세요.');
}
function home() {
  app.innerHTML = `<section class="card"><h1>함께 떠나고,<br>발견을 모으는 탐험</h1><p>경주의 아홉 미션을 함께 즐겨요. 방장 포함 최대 10명이 하나의 스탬프북을 함께 채울 수 있어요.</p><a class="button" href="#create">탐험방 만들기</a><p class="muted">방장은 Google 로그인 · 참여자는 초대 링크와 별칭만으로 시작</p></section><section class="card"><h2>초대받았나요?</h2><p>받은 초대 링크를 열어 주세요. 한 브라우저에서 한 명의 기록을 이어갈 수 있어요.</p></section><section class="card"><h2>내가 만든 탐험방</h2><div id="myRooms">${user && !user.isAnonymous?'불러오는 중…':'방장으로 로그인하면 확인할 수 있어요.'}</div><div class="row"><button data-action="login">방장 Google 로그인</button>${signOutButton()}</div></section>`;
  app.insertAdjacentHTML('beforeend','<section class="card"><h2>내가 참여한 여행</h2><p class="muted">이 브라우저에서 참여한 여행을 다시 열 수 있어요. 다른 기기의 익명 기록 복구를 보장하지 않아요.</p><div id="joinedRooms">참여한 여행을 확인하고 있어요…</div></section>');
  const homeVersion=generation,homeUid=user?.uid;
  loadAccessibleRooms(readRoomIds(localState,homeUid),async id=>{
    const membership=await api.getDocFromServer(api.doc(db,'rooms',id,'members',homeUid));
    if(!membership.exists())return null;
    const snapshot=await api.getDocFromServer(api.doc(db,'rooms',id));
    if(!snapshot.exists() || snapshot.data().ownerId===homeUid)return null;
    return {id,...snapshot.data()};
  }).then(({rooms,failed})=>{
    if(homeVersion!==generation || homeUid!==user?.uid)return;
    const list=document.querySelector('#joinedRooms');if(!list)return;
    list.innerHTML=(rooms.length?rooms.map(r=>`<p><a href="#room/${esc(r.id)}">${esc(r.title)} · ${r.status==='closed'?'종료':'진행 중'}</a></p>`).join(''):'참여한 여행이 없거나 현재 접근 권한을 확인할 수 없어요.')+(failed?'<p>일부 여행을 확인하지 못했어요. 연결을 확인한 뒤 다시 열어 주세요.</p>':'');
  });
  if(user && !user.isAnonymous) {
    const version=generation;
    api.getDocsFromServer(api.query(api.collection(db,'rooms'),api.where('ownerId','==',user.uid))).then(result=>{
      if(version!==generation)return;
      document.querySelector('#myRooms').innerHTML = result.empty?'아직 만든 탐험방이 없어요.':result.docs.map(d=>`<p><a href="#room/${esc(d.id)}">${esc(d.data().title)} · ${d.data().status==='closed'?'종료':'진행 중'}</a></p>`).join('');
    }).catch(e=>{if(version===generation)say(e.message);});
  }
}
function createView() {
  app.innerHTML = `<section class="card"><h1>새 탐험방</h1><p>경주 역사 탐험 · ${course.quests.length}개 미션 · 방장 포함 최대 10명</p>${!user || user.isAnonymous ? '<p>방을 만들려면 방장 Google 로그인이 필요해요.</p><button data-action="login">Google로 로그인</button>' : `<form id="create"><label>탐험방 이름<input name="title" maxlength="60" required autocomplete="off" placeholder="우리 가족 경주 원정"></label><fieldset><legend>함께하는 방식</legend><label><input type="radio" name="mode" value="shared" checked>함께 완료</label><p class="muted">누가 완료하든 하나의 공동 스탬프북을 채워요.</p>${enableIndividualPilot?'<label><input type="radio" name="mode" value="individual">각자 완료 (후속 파일럿)</label><p class="muted">각자 스탬프를 모으고 마지막에 결과를 제출해요.</p>':''}</fieldset><button>탐험방 만들기</button></form>`}</section>`;
  const pending=readCreateRequest(localState,user?.uid);
  if(pending && document.querySelector('#create')){
    document.querySelector('#create [name="title"]').value=pending.title;
    const mode=document.querySelector(`#create [name="mode"][value="${pending.mode}"]`);if(mode)mode.checked=true;
    say('결과를 확인하지 못한 생성 요청을 이어서 확인할 수 있어요. 같은 이름으로 다시 시도해 주세요.');
  }
}
async function joinView(token, version) {
  const summary=await call('previewInvite',{token});
  if(version!==generation)return;
  app.innerHTML=`<section class="card"><h1>${esc(summary.title)}</h1><p>경주 역사 탐험 · ${summary.questCount}개 미션 · ${summary.mode==='shared'?'함께 완료':'각자 완료'}</p><h2>탐험에 초대받았어요!</h2><form id="join"><label>탐험가 별칭<input name="nickname" required maxlength="24" placeholder="씩씩한 탐험가" autocomplete="off"></label>${summary.mode==='individual'?'<label>참여 코드 / 번호 (선택)<input name="participantCode" maxlength="12" placeholder="사전에 안내받은 가상 코드"></label>':''}<p class="muted">실명 대신 별칭을 사용해 주세요. 기록은 이 브라우저에서 이어갈 수 있어요. 기기를 바꾸거나 브라우저 데이터를 지우면 복구가 어려워요.</p><button>탐험 시작</button></form></section>`;
  const form=document.querySelector('#join');
  form.insertAdjacentHTML('afterbegin',`<p>참여 ${summary.memberCount} / ${summary.capacity}명${!summary.canJoin && !summary.alreadyJoined?' · 정원이 모두 찼어요. 리더에게 확인해 주세요.':''}</p>`);
  if(!summary.canJoin && !summary.alreadyJoined)form.querySelector('button').disabled=true;
}
function renderRoom() {
  if(!room || !me || !serverConfirmed || !memberConfirmed)return;
  const expanded=new Set([...app.querySelectorAll('details[open]')].map(d=>d.dataset.questId));
  const owner=room.ownerId===user.uid, done=room.mode==='shared'?room.sharedDone:me.done, closed=room.status==='closed';
  const submitted=!!me.submittedAt, ready=room.requiredQuestIds.every(id=>done.includes(id));
  app.innerHTML=`<section class="card"><span class="badge">${room.mode==='shared'?'함께 완료':'각자 완료'} · ${closed?'종료':'탐험 중'}</span><h1>${esc(room.title)}</h1><p>${esc(me.displayName)}님, 오늘의 발견을 모아보세요.</p><div class="stamp-count">${room.mode==='shared'?'우리 방':'내'} 스탬프 ${done.length}/${room.questIds.length}</div><progress class="progress" max="${room.questIds.length}" value="${done.length}" aria-label="스탬프 완료 수"></progress><p id="sync" class="muted">서버 상태 확인 중</p>${closed?'<p>종료된 탐험방이에요. 기록은 읽기만 할 수 있어요.</p>':''}${room.mode==='individual'?`<button data-action="submit" ${closed || !ready || submitted?'disabled':''}>${submitted?'제출 완료':ready?'완료 결과 제출':'필수 미션을 완료하면 제출할 수 있어요'}</button>`:''}</section>
    ${owner?`<section class="card"><h2>방장 관리</h2><p>참여자 ${room.memberCount-1}명 · 방장 1명</p>${room.mode==='individual'?`<p>제출 ${members.filter(m=>m.role==='member' && m.submittedAt).length}/${members.filter(m=>m.role==='member').length}명 (참여자 기준)</p><ul class="members">${members.map(m=>`<li><strong>${esc(m.participantCode?m.participantCode+' / ':'')}${esc(m.displayName)}${m.role==='owner'?' (방장)':''}</strong>${m.done.length}/${room.questIds.length} · ${m.submittedAt?'제출 완료':m.done.length?'진행 중':'미시작'}</li>`).join('')}</ul>`:'<p>공동 스탬프북은 모두에게 같은 진행률로 보여요.</p>'}${inviteToken?`<p class="invite">${esc(inviteUrl(inviteToken))}</p><button data-action="copy">초대 링크 복사</button>`:''}<div class="row"><button class="secondary" data-action="rotate" ${closed?'disabled':''}>${inviteToken?'초대 링크 재발급':'초대 링크 발급·재발급'}</button><button class="danger" data-action="close" ${closed?'disabled':''}>탐험방 종료</button></div><p class="muted">재발급하면 이전 초대 링크로는 새로 입장할 수 없어요. 이미 참여한 사람의 기록은 유지돼요.</p></section>`:''}
    <h2>경주 이야기 지도</h2><p class="muted">가고 싶은 장소부터 열어보세요. 사진 촬영과 업로드 없이 미션을 완료할 수 있어요.</p>${[1,2,3].map(day=>`<h3>Chapter ${day}</h3>${course.quests.filter(q=>q.day===day).map(q=>`<details data-quest-id="${esc(q.id)}" ${expanded.has(q.id)?'open':''} class="quest ${done.includes(q.id)?'done':''}"><summary><span>${esc(q.icon)}</span><b>${esc(q.place)} ${done.includes(q.id)?'✓':''}</b></summary><h3>${esc(q.title)}</h3><p>${esc(q.story)}</p><h3>오늘의 미션</h3><p>${esc(q.mission)}</p><h3>여기 봐!</h3><p>${esc(q.look)}</p><p>${esc(q.fact)}</p><button data-quest="${esc(q.id)}" ${closed || done.includes(q.id) || submitted?'disabled':''}>${done.includes(q.id)?'쾅! '+esc(q.stamp):'미션 완료 · 스탬프 받기'}</button></details>`).join('')}`).join('')}`;
  updateSync();
}
let serverConfirmed=false, memberConfirmed=false;
function updateSync(){const el=document.querySelector('#sync');if(el)el.textContent=!navigator.onLine?'오프라인 · 완료를 저장하려면 다시 연결해 주세요.':serverConfirmed && memberConfirmed?'서버에서 확인한 진행 상태예요.':'연결 중 · 서버 확인 전 상태예요.';}
const inviteUrl=token=>`${location.origin}${location.pathname}#join/${token}`;
async function route() {
  const version=++generation;
  document.body.classList.remove('trip-active');
  clearListeners();say('');
  if(location.hash !== `#room/${inviteRoomId}`){inviteToken='';inviteRoomId='';}
  const [view,id,tripId,tab,placeId]=location.hash.slice(1).split('/');
  app.innerHTML='<section class="card"><p>탐험을 불러오고 있어요…</p></section>';
  try {
    if(view==='group-join'){await ensureUser();if(version!==generation)return;}
    if(groupViews && (!view || groupViews.handles(view)))await groupViews.open({view:view||'groups',groupId:id,tripId,tab,placeId},version);
    else if(view==='create')createView();
    else if(view==='join' && id)await joinView(id,version);
    else if(view==='room' && id) {
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('탐험방 주소를 확인해 주세요.');
      await ensureUser();if(version!==generation)return;
      serverConfirmed=false;memberConfirmed=false;
      const watchError=e=>{if(version===generation){app.innerHTML='<section class="card"><h1>탐험방을 열 수 없어요</h1><p>참여했던 브라우저에서 초대 링크를 열어 주세요.</p><a href="#">시작으로</a></section>';say('방 정보를 읽을 수 없어요. 초대 링크로 참여했는지 확인해 주세요. '+e.message);}};
      stops.push(api.onSnapshot(api.doc(db,'rooms',id),{includeMetadataChanges:true},snap=>{
        if(version!==generation)return;
        if(!snap.exists()){say('탐험방을 찾을 수 없어요.');return;}
        room={id:snap.id,...snap.data()};serverConfirmed=!snap.metadata.fromCache;renderRoom();
      },watchError));
      stops.push(api.onSnapshot(api.doc(db,'rooms',id,'members',user.uid),{includeMetadataChanges:true},snap=>{
        if(version!==generation)return;
        if(!snap.exists())return;
        me=snap.data();memberConfirmed=!snap.metadata.fromCache;
        if(memberConfirmed)rememberHere(id);
        renderRoom();
        if(me.role==='owner' && !stops.ownerWatch){
          stops.ownerWatch=true;
          stops.push(api.onSnapshot(api.collection(db,'rooms',id,'members'),snapshot=>{if(version!==generation)return;members=snapshot.docs.map(d=>({id:d.id,...d.data()}));renderRoom();},watchError));
        }
      },watchError));
    } else home();
  } catch(e){if(version===generation){app.innerHTML='<section class="card"><h1>탐험을 열 수 없어요</h1><p>초대 링크 또는 연결 상태를 확인해 주세요.</p><a href="#">시작으로</a></section>';say(e.message);}}
}
async function perform(action){
  if(busy)return;
  const actionVersion=generation;
  busy=true;say('처리 중이에요…');
  document.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)').forEach(b=>{b.dataset.pending='1';b.disabled=true;});
  try{await action();if(actionVersion===generation)say('');}catch(e){if(actionVersion===generation)say(e.message || '연결을 확인한 뒤 다시 시도해 주세요.');}
  finally{busy=false;document.querySelectorAll('[data-pending]').forEach(b=>{delete b.dataset.pending;b.disabled=false;});}
}
app.addEventListener('submit',event=>{
  if(!['create','join'].includes(event.target.id))return;
  event.preventDefault();const form=event.target, data=Object.fromEntries(new FormData(form));
  perform(async()=>{
    if(form.id==='create'){
      const uid=user.uid;
      let request;
      try{request=getCreateRequest(localState,uid,{...data,courseId:course.id},()=>crypto.randomUUID());}
      catch(error){throw new Error('생성 요청을 안전하게 보관하지 못했어요. '+error.message);}
      let result;
      try{result=await call('createRoom',request);}
      catch(error){
        if(error.code==='functions/invalid-argument')clearCreateRequest(localState,uid,request.requestId);
        throw error;
      }
      rememberHere(result.roomId);clearCreateRequest(localState,uid,request.requestId);
      inviteToken=result.token || '';inviteRoomId=result.roomId;location.hash=`room/${result.roomId}`;
    } else if(form.id==='join'){
      const token=location.hash.slice(1).split('/')[1];await ensureUser();
      const result=await call('joinRoom',{token,...data});rememberHere(result.roomId);location.hash=`room/${result.roomId}`;
    }
  });
});
app.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button || button.disabled)return;
  const action=button.dataset.action, questId=button.dataset.quest;
  if(!action && !questId)return;
  perform(async()=>{
    if(questId){await call('completeQuest',{roomId:room.id,questId});}
    else if(action==='login'){
      // Linking preserves the anonymous participant's UID rather than discarding progress.
      if(auth.currentUser?.isAnonymous)await api.linkWithPopup(auth.currentUser,new api.GoogleAuthProvider());
      else await api.signInWithPopup(auth,new api.GoogleAuthProvider());
      user=auth.currentUser;await route();
    } else if(action==='logout'){
      if(!confirm('로그아웃할까요? 익명 참여 기록은 이 브라우저에서도 다시 연결하지 못할 수 있어요.'))return;
      clearListeners();await api.signOut(auth);user=null;inviteToken='';location.hash='';await route();
    } else if(action==='copy'){
      await navigator.clipboard.writeText(inviteUrl(inviteToken));alert('초대 링크를 복사했어요.');
    } else if(action==='rotate'){
      if(!confirm('초대 링크를 재발급할까요? 이전 링크는 사용할 수 없어요.'))return;
      inviteToken=(await call('rotateInvite',{roomId:room.id})).token;inviteRoomId=room.id;renderRoom();
    } else if(action==='close'){
      if(confirm('탐험방을 종료할까요? 되돌릴 수 없고 모두의 기록이 읽기 전용으로 바뀌어요.'))await call('closeRoom',{roomId:room.id});
    } else if(action==='submit')await call('submit',{roomId:room.id});
  });
});
try {
  const config=await import('./firebase-config.js');
  enableIndividualPilot=config.enableIndividualPilot===true;
  if(!config.firebaseConfig?.projectId || config.firebaseConfig.projectId==='YOUR_PROJECT')throw new Error('Firebase 연결 설정이 필요해요.');
  const sdk='https://www.gstatic.com/firebasejs/13.0.0/';
  const modules=await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js','firebase-functions.js'].map(name=>import(sdk+name)));
  api=Object.assign({},...modules);
  const firebaseApp=api.initializeApp(config.firebaseConfig);
  auth=api.getAuth(firebaseApp);db=api.getFirestore(firebaseApp);functions=api.getFunctions(firebaseApp,config.functionsRegion || 'asia-northeast3');
  if(config.useEmulators){
    if(!['localhost','127.0.0.1'].includes(location.hostname))throw new Error('에뮬레이터는 로컬에서만 사용할 수 있어요.');
    document.body.classList.add('emulator-mode');
    api.connectAuthEmulator(auth,'http://127.0.0.1:9099');api.connectFirestoreEmulator(db,'127.0.0.1',8085);api.connectFunctionsEmulator(functions,'127.0.0.1',5001);
  }
  await api.setPersistence(auth,api.browserLocalPersistence);await auth.authStateReady();user=auth.currentUser;
  groupViews=createGroupViews({app,api,db,getUser:()=>user,call,perform,say,isCurrent:version=>version===generation,storage:localState});
  course=await fetch('./course.json').then(r=>{if(!r.ok)throw new Error('코스를 읽을 수 없어요.');return r.json();});
  window.addEventListener('hashchange',route);
  window.addEventListener('online',updateSync);window.addEventListener('offline',updateSync);
  api.onAuthStateChanged(auth,current=>{
    if(user?.uid !== current?.uid){clearListeners();user=current;route();}
  });
  await route();
} catch(error){configMissing();say(error.message);}
