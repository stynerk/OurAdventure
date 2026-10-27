// Real SDK + exported handlers, demo emulators only; no production credentials.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Demo emulators required');
const root=process.cwd(),origin='http://127.0.0.1:8080/next/';
const files=new Set(['index.html','style.css','app.js','session.mjs','groups.mjs','trip-views.mjs','illustrated-map.mjs','creation-requests.mjs','course.json']);
const config="export const firebaseConfig={apiKey:'demo-key',authDomain:'demo-our-adventure.firebaseapp.com',projectId:'demo-our-adventure',appId:'demo-app'};export const useEmulators=true;";
const server=createServer((req,res)=>{
  const name=new URL(req.url,origin).pathname.replace(/^\/next\//,'');
  if(name==='firebase-config.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(config);return;}
  const file=name===''?'index.html':name;
  if(!files.has(file)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/javascript'});
  res.end(readFileSync(resolve(root,'next',file)));
}).listen(8080,'127.0.0.1');
await once(server,'listening');
const admin=initializeApp({projectId:'demo-our-adventure'},'groups-browser'),db=getFirestore(admin);
let browser;
async function auth(page,google=false) {
  await page.evaluate(async google=>{
    const sdk=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');
    if(!google){await sdk.signInAnonymously(sdk.getAuth());return;}
    const encode=d=>btoa(JSON.stringify(d)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const token=encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://accounts.google.com',sub:'groups-browser-owner',aud:'demo',email:'groups-owner@example.test',email_verified:true})+'.';
    await sdk.signInWithCredential(sdk.getAuth(),sdk.GoogleAuthProvider.credential(token));
  },google);
}
async function fillTrip(page,title,placeNames='') {
  await page.getByLabel('여행 이름',{exact:true}).fill(title);
  await page.getByLabel('목적지',{exact:true}).fill('경주');
  await page.getByLabel('시작 날짜',{exact:true}).fill('2026-10-27');
  await page.getByLabel('종료 날짜',{exact:true}).fill('2026-10-28');
  await page.getByLabel('방문 장소',{exact:false}).fill(placeNames);
}
async function blankTrip(page) {
  for(const label of ['여행 이름','목적지','시작 날짜','종료 날짜','방문 장소'])assert.equal(await page.getByLabel(label,{exact:false}).inputValue(),'');
}
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined});
  const leader=await browser.newContext({viewport:{width:390,height:844}}),member=await browser.newContext({viewport:{width:390,height:844}});
  const owner=await leader.newPage(),peer=await member.newPage(),errors=[];
  for(const page of [owner,peer])page.on('pageerror',e=>errors.push(e.message));
  await owner.goto(origin);await owner.getByRole('heading',{name:'내 그룹',exact:true}).waitFor();
  for(const width of [320,390]){
    await owner.setViewportSize({width,height:844});
    const layout=await owner.evaluate(()=>{
      const brand=document.querySelector('header .brand').getBoundingClientRect(),badge=document.querySelector('header .badge').getBoundingClientRect();
      return {overlap:brand.left<badge.right && brand.right>badge.left && brand.top<badge.bottom && brand.bottom>badge.top,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.equal(layout.overlap,false,`header overlaps at ${width}px`);assert.equal(layout.overflow,false);
  }
  await auth(owner,true);await owner.getByRole('link',{name:'새 그룹 만들기',exact:true}).click();
  await owner.getByLabel('그룹 이름',{exact:true}).fill('브라우저 테스트 그룹');
  await owner.getByRole('button',{name:'그룹 만들기',exact:true}).click();
  await owner.getByRole('heading',{name:'브라우저 테스트 그룹',exact:true}).waitFor();
  const groupId=await owner.evaluate(()=>location.hash.split('/')[1]);
  await owner.getByRole('link',{name:'새 여행 만들기',exact:true}).click();await blankTrip(owner);
  await fillTrip(owner,'첫 여행','대릉원\n첨성대');await owner.getByRole('button',{name:'여행 만들기',exact:true}).click();
  await owner.getByRole('heading',{name:'첫 여행',exact:true}).waitFor();
  const firstTripId=await owner.evaluate(()=>location.hash.split('/')[2]);
  await owner.getByRole('link',{name:'← 브라우저 테스트 그룹',exact:true}).click();
  await owner.getByRole('link',{name:'새 여행 만들기',exact:true}).click();await blankTrip(owner);
  await fillTrip(owner,'장소 없는 새 여행');await owner.getByRole('button',{name:'여행 만들기',exact:true}).click();
  await owner.getByRole('heading',{name:'장소 없는 새 여행',exact:true}).waitFor();
  await owner.getByText('아직 장소를 정하지 않았어요.',{exact:true}).waitFor();
  await db.doc(`groups/${groupId}/trips/${firstTripId}`).update({status:'closed',closedAt:FieldValue.serverTimestamp()});
  await owner.getByRole('link',{name:'← 브라우저 테스트 그룹',exact:true}).click();
  await owner.getByRole('heading',{name:'지난 여행',exact:true}).waitFor();
  await owner.getByRole('link',{name:'첫 여행',exact:true}).click();
  await owner.getByText('종료된 여행이에요. 기존 여행 정보는 계속 볼 수 있어요.',{exact:true}).waitFor();
  assert.equal(await owner.locator('form').count(),0);
  console.log('PASS: Google-emulator leader creates group and separate trips; fresh empty forms, zero places and closed-trip reentry');

  // Simulate a committed server response lost in transit, then recover the same trip.
  await owner.goto(origin+'#trip-create/'+groupId);await blankTrip(owner);await fillTrip(owner,'응답 유실 복구 여행','월정교');
  await owner.route('**/createTrip',async route=>{if(route.request().method()!=='POST'){await route.continue();return;}await route.fetch();await route.abort('failed');});
  await owner.getByRole('button',{name:'여행 만들기',exact:true}).click();
  await owner.getByRole('button',{name:'이전 요청 확인',exact:true}).waitFor();
  assert.equal(await owner.getByLabel('여행 이름',{exact:true}).inputValue(),'응답 유실 복구 여행');
  assert.equal((await db.collection(`groups/${groupId}/trips`).get()).size,3);
  await owner.unroute('**/createTrip');await owner.getByRole('button',{name:'이전 요청 확인',exact:true}).click();
  await owner.getByRole('heading',{name:'응답 유실 복구 여행',exact:true}).waitFor();
  const openTripId=await owner.evaluate(()=>location.hash.split('/')[2]);
  assert.equal((await db.collection(`groups/${groupId}/trips`).get()).size,3);
  console.log('PASS: lost creation response preserves form; recovery reuses one trip without duplicates');

  await owner.goto(origin+'#group/'+groupId);
  await owner.getByRole('button',{name:'초대 링크 생성·재발급',exact:true}).click();
  const inviteInput=owner.getByLabel('그룹 초대 링크',{exact:true});await inviteInput.waitFor();
  const inviteLink=await inviteInput.inputValue();assert.match(inviteLink,/#group-join\/[A-Za-z0-9_-]{43}$/);
  await leader.grantPermissions(['clipboard-read','clipboard-write']);
  await owner.getByRole('button',{name:'초대 링크 복사',exact:true}).click();
  await owner.getByText('초대 링크를 복사했어요.',{exact:true}).waitFor();
  assert.equal(await owner.evaluate(()=>navigator.clipboard.readText()),inviteLink);
  await peer.goto(inviteLink);
  await peer.getByRole('heading',{name:'그룹에 초대받았어요',exact:true}).waitFor();
  await peer.getByText('다른 기기에서는 이어서 쓰기 어려울 수 있어요.',{exact:false}).waitFor();
  await peer.getByLabel('탐험가 별칭',{exact:true}).fill('테스트 멤버');
  await peer.getByRole('button',{name:'그룹 참여하기',exact:true}).click();
  await peer.waitForURL(url=>url.hash===`#group/${groupId}`);
  await peer.getByRole('heading',{name:'브라우저 테스트 그룹',exact:true}).waitFor();
  const peerUid=await peer.evaluate(async()=>{const a=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');return a.getAuth().currentUser.uid;});
  await peer.goto(inviteLink);await peer.waitForURL(url=>url.hash===`#group/${groupId}`);await peer.getByRole('heading',{name:'브라우저 테스트 그룹',exact:true}).waitFor();
  assert.equal((await db.doc(`groups/${groupId}`).get()).data().memberCount,2);
  assert.equal((await db.collection(`groups/${groupId}/members`).get()).size,2);
  assert.equal((await db.doc(`groups/${groupId}/members/${peerUid}`).get()).data().displayName,'테스트 멤버');
  await peer.getByRole('heading',{name:'지난 여행',exact:true}).waitFor();
  assert.equal(await peer.getByRole('button',{name:'초대 링크 생성·재발급',exact:true}).count(),0);
  assert.equal(await peer.getByRole('link',{name:'새 여행 만들기',exact:true}).count(),0);
  await peer.getByRole('link',{name:'첫 여행',exact:true}).click();
  await peer.getByRole('heading',{name:'첫 여행',exact:true}).waitFor();
  await peer.goto(origin+'#trip-create/'+groupId);await peer.getByRole('heading',{name:'리더만 여행을 만들 수 있어요',exact:true}).waitFor();
  assert.equal(await peer.locator('#v2-trip-create').count(),0);
  await peer.goto(origin+'#group/not-a-member');await peer.getByRole('heading',{name:'목록이나 여행을 불러오지 못했어요',exact:true}).waitFor();
  assert.equal(await peer.getByText('브라우저 테스트 그룹',{exact:true}).count(),0);

  // T7 reads trusted photo-finalization fixtures; no Storage upload or false completion UI.
  const ownerUid=await owner.evaluate(async()=>{const sdk=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');return sdk.getAuth().currentUser.uid;});
  const firstTrip=await db.doc(`groups/${groupId}/trips/${firstTripId}`).get(),[p1,p2]=firstTrip.data().placeIds;
  const prefix=`groups/${groupId}/trips/${firstTripId}`;
  await db.doc(`${prefix}/completions/leader-fixture`).set({uid:ownerUid,placeId:p1,photoCount:1});
  await db.doc(`${prefix}/completions/member-fixture`).set({uid:peerUid,placeId:p2,photoCount:1});
  await db.doc(`${prefix}/posts/published-fixture`).set({uid:peerUid,placeId:null,status:'published',feeling:'함께 남긴 테스트 추억',photo:{objectPath:'TEST_ONLY_PRIVATE_PATH'},createdAt:FieldValue.serverTimestamp()});
  await db.doc(`${prefix}/posts/uploading-fixture`).set({uid:peerUid,status:'uploading',feeling:'SHOULD_NOT_BE_VISIBLE'});
  await db.doc(prefix).update({postCount:1});
  for(const [page,firstState,secondState] of [[owner,'완료','미완료'],[peer,'미완료','완료']]){
    await page.goto(origin+`#trip/${groupId}/${firstTripId}/stamps`);
    await page.getByRole('heading',{name:'내 스탬프 1/2',exact:true}).waitFor();
    const nav=page.getByRole('navigation',{name:'여행 화면',exact:true});assert.equal(await nav.getByRole('link').count(),4);
    assert.equal(await page.locator('.stamp-tile small').nth(0).textContent(),firstState);
    assert.equal(await page.locator('.stamp-tile small').nth(1).textContent(),secondState);
    assert.equal(await page.getByRole('link',{name:'여행 관리',exact:true}).count(),0);
    for(const [label,heading] of [['지도','여행 지도'],['코스','여행 코스'],['추억','함께 남긴 추억'],['스탬프','내 스탬프 1/2']]){
      await nav.getByRole('link',{name:label,exact:true}).click();
      await page.getByRole('heading',{name:heading,exact:true}).waitFor();
      assert.equal(await page.locator('form,input[type=file]').count(),0);
      assert.equal(await page.getByRole('navigation',{name:'여행 화면'}).locator('a[aria-current="page"]').count(),1);
      assert.equal(await page.getByText('SHOULD_NOT_BE_VISIBLE',{exact:true}).count(),0);
    }
    await nav.getByRole('link',{name:'추억',exact:true}).click();
    await page.getByText('함께 남긴 테스트 추억',{exact:true}).waitFor();
    assert.equal(await page.getByText('TEST_ONLY_PRIVATE_PATH',{exact:false}).count(),0);
  }
  await owner.goto(origin+`#trip/${groupId}/${firstTripId}/map`);await owner.getByRole('heading',{name:'여행 지도',exact:true}).waitFor();
  assert.equal(await owner.locator('.illustrated-map .map-pin').count(),2);
  assert.equal(await owner.locator('.map-route').count(),1);assert.equal(await owner.locator('.map-pin.is-done').count(),1);
  assert.equal(await owner.locator('.trip-panel a[href^="http"]').count(),0);
  await owner.screenshot({path:'test-results/trip-illustrated-map-mobile.png',fullPage:true});
  await owner.getByRole('link',{name:'다음 탐험 · 첨성대',exact:true}).click();
  await owner.getByText('종료된 여행이에요. 스탬프는 읽기만 할 수 있어요.',{exact:true}).waitFor();
  await owner.goto(origin+`#trip/${groupId}/${firstTripId}/manage`);await owner.getByRole('heading',{name:'여행 지도',exact:true}).waitFor();
  assert.equal(await owner.getByRole('link',{name:'초대 링크·참여 관리',exact:true}).count(),0);
  await owner.goto(origin+`#trip/${groupId}/${openTripId}/map`);await owner.getByRole('link',{name:'여행 관리',exact:true}).click();
  await owner.getByRole('heading',{name:'여행 관리',exact:true}).waitFor();
  await owner.getByRole('link',{name:'초대 링크·참여 관리',exact:true}).waitFor();
  await peer.goto(origin+`#trip/${groupId}/${openTripId}/manage`);
  await peer.getByRole('heading',{name:'리더만 여행을 관리할 수 있어요',exact:true}).waitFor();
  assert.equal(await peer.getByRole('link',{name:'초대 링크·참여 관리',exact:true}).count(),0);
  await owner.goto(origin+`#trip/${groupId}/${firstTripId}/stamps`);await owner.getByRole('heading',{name:'내 스탬프 1/2',exact:true}).waitFor();
  for(const width of [320,390]){
    await owner.setViewportSize({width,height:844});
    assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const bounds=await owner.getByRole('navigation',{name:'여행 화면'}).boundingBox();assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width+1);
    await owner.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
    assert.equal(await owner.evaluate(()=>document.querySelector('.trip-panel').getBoundingClientRect().bottom<=document.querySelector('.trip-tabs').getBoundingClientRect().top),true);
  }
  mkdirSync('test-results',{recursive:true});await owner.screenshot({path:'test-results/trip-tabs-mobile.png',fullPage:true});
  console.log('PASS: both roles retain four closed-trip tabs; UID-based stamp progress differs, only published memories display and member management is denied');
  console.log('PASS: illustrated map pins and dotted path, next stamp, closed management hidden, direct closed route read-only and 320/390px content clearance');

  await peer.goto(origin+'#groups');await peer.getByRole('link',{name:'브라우저 테스트 그룹',exact:true}).waitFor();
  assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  mkdirSync('test-results',{recursive:true});await owner.screenshot({path:'test-results/groups-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: member management controls absent, direct create route denied, closed-trip reads and outsider denial');

  // Group details may be introduced by a valid invite, but a full/invalid state must clear them.
  const outsiderContext=await browser.newContext({viewport:{width:320,height:740}}),stranger=await outsiderContext.newPage();
  stranger.on('pageerror',e=>errors.push(e.message));
  await stranger.goto(inviteLink);await stranger.getByRole('heading',{name:'그룹에 초대받았어요',exact:true}).waitFor();
  await db.runTransaction(async tx=>{
    const ref=db.doc(`groups/${groupId}`),snapshot=await tx.get(ref),ids=Array.from({length:8},(_,i)=>`ui-capacity-${i}`);
    for(const uid of ids)tx.create(ref.collection('members').doc(uid),{role:'member',displayName:'정원 테스트',joinedAt:FieldValue.serverTimestamp()});
    tx.update(ref,{memberIds:[...snapshot.data().memberIds,...ids],memberCount:10});
  });
  await stranger.getByLabel('탐험가 별칭',{exact:true}).fill('초과 멤버');
  await stranger.getByRole('button',{name:'그룹 참여하기',exact:true}).click();
  await stranger.getByRole('heading',{name:'그룹 정원이 모두 찼어요',exact:true}).waitFor();
  assert.equal(await stranger.getByText('브라우저 테스트 그룹',{exact:true}).count(),0);
  assert.equal(await stranger.locator('form').count(),0);
  await stranger.reload();await stranger.getByRole('heading',{name:'그룹 정원이 모두 찼어요',exact:true}).waitFor();
  assert.equal(await stranger.getByText('브라우저 테스트 그룹',{exact:true}).count(),0);
  await stranger.goto(origin+'#group-join/not-a-valid-link');
  await stranger.getByRole('heading',{name:'초대 링크를 확인해주세요',exact:true}).waitFor();
  assert.equal(await stranger.getByText('브라우저 테스트 그룹',{exact:true}).count(),0);
  await owner.goto(origin+'#group/'+groupId);await owner.getByRole('button',{name:'초대 링크 생성·재발급',exact:true}).click();
  await owner.getByLabel('그룹 초대 링크',{exact:true}).waitFor();
  await owner.waitForFunction(old=>document.querySelector('#v2-invite-link')?.value && document.querySelector('#v2-invite-link').value!==old,inviteLink);
  await stranger.goto(inviteLink);await stranger.getByRole('heading',{name:'초대 링크를 확인해주세요',exact:true}).waitFor();
  assert.equal(await stranger.getByText('브라우저 테스트 그룹',{exact:true}).count(),0);
  await peer.goto(origin+'#group/'+groupId);await peer.getByRole('heading',{name:'브라우저 테스트 그룹',exact:true}).waitFor();
  await peer.goto(origin+'#groups');await peer.getByRole('link',{name:'브라우저 테스트 그룹',exact:true}).waitFor();
  await peer.evaluate(async()=>{const sdk=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');await sdk.signOut(sdk.getAuth());});
  await peer.getByRole('button',{name:'Google로 로그인',exact:true}).waitFor();
  assert.equal(await peer.getByRole('link',{name:'브라우저 테스트 그룹',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  await stranger.screenshot({path:'test-results/invite-full-invalid-mobile.png',fullPage:true});
  console.log('PASS: leader generates and copies link; anonymous nickname join and repeated-link reentry do not duplicate membership');
  console.log('PASS: full race clears introduction; full, malformed and revoked links expose no group content; rotation preserves members');
  console.log('PASS: header brand and badge do not overlap at 320px and 390px');
  console.log('Physical mobile, production OAuth/Functions and visual font quality remain untested.');
} finally {
  await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.terminate();await deleteApp(admin);
}
