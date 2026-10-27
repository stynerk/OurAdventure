import {auditUi} from './ui-audit.mjs';
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
const files=new Set(['index.html','style.css','icons.mjs','ui.mjs','app.js','session.mjs','groups.mjs','trip-views.mjs','illustrated-map.mjs','creation-requests.mjs','photo-upload.mjs','photo-views.mjs','photo-drafts.mjs','memory-feed.mjs','report-views.mjs','share-renderer.mjs','analytics.mjs','analytics-source.mjs','course.json']);
const config="export const firebaseConfig={apiKey:'demo-key',authDomain:'demo-our-adventure.firebaseapp.com',projectId:'demo-our-adventure',appId:'demo-app',storageBucket:'demo-our-adventure.firebasestorage.app'};export const useEmulators=true;";
const server=createServer((req,res)=>{
  const name=new URL(req.url,origin).pathname.replace(/^\/next\//,'');
  if(name==='firebase-config.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(config);return;}
  if(name==='analytics.mjs'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end("export {countBucket,daysBucket} from './analytics-source.mjs';export async function createAnalytics(){return {setAuthType:()=>{},track:(name,params)=>{(window.__photoEvents||=[]).push({name,params});}};}");return;}
  const file=name===''?'index.html':name;
  if(/^assets\/(travel-cover-v2\.(webp|jpg)|PretendardVariable\.woff2|Jua-Regular\.ttf)$/.test(file)){res.writeHead(200,{'Content-Type':file.endsWith('.webp')?'image/webp':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.ttf')?'font/ttf':'font/woff2'});res.end(readFileSync(resolve(root,'next',file)));return;}
  if(!files.has(file)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/javascript'});
  res.end(readFileSync(resolve(root,'next',file==='analytics-source.mjs'?'analytics.mjs':file)));
}).listen(8080,'127.0.0.1');
await once(server,'listening');
const admin=initializeApp({projectId:'demo-our-adventure'},'groups-browser'),db=getFirestore(admin);
let browser;const errors=[];
async function sdkCache(context){if(!process.env.FIREBASE_BROWSER_SDK_CACHE)return;await context.route('https://www.gstatic.com/firebasejs/13.0.0/*.js',async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);if(!/^firebase-(app|auth|firestore|functions|storage)\.js$/.test(name)){await route.continue();return;}await route.fulfill({status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:readFileSync(resolve(process.env.FIREBASE_BROWSER_SDK_CACHE,name))});});}
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
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--disable-gpu','--renderer-process-limit=2','--js-flags=--max-old-space-size=128']});
  const leader=await browser.newContext({viewport:{width:390,height:844}}),member=await browser.newContext({viewport:{width:390,height:844}});
  await sdkCache(leader);await sdkCache(member);
  const owner=await leader.newPage(),peer=await member.newPage();
  for(const page of [owner,peer]){page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>{errors.push(e.message);console.error('UI error:',e.message);});}
  await owner.goto(origin);await owner.getByRole('heading',{name:/내 그룹|오늘의 여행이/}).waitFor();
  for(const width of [320,390]){
    await owner.setViewportSize({width,height:844});
    const layout=await owner.evaluate(()=>{
      const brand=document.querySelector('header .brand').getBoundingClientRect(),badge=document.querySelector('header .badge').getBoundingClientRect();
      return {overlap:brand.left<badge.right && brand.right>badge.left && brand.top<badge.bottom && brand.bottom>badge.top,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.equal(layout.overlap,false,`header overlaps at ${width}px`);assert.equal(layout.overflow,false);
  }
  await auditUi(owner,'login');await auth(owner,true);await owner.getByRole('link',{name:'새 그룹 만들기',exact:true}).click();
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
  await owner.getByLabel('종료된 여행',{exact:true}).waitFor();
  await owner.getByRole('link',{name:'여행 리포트 보기',exact:true}).waitFor();
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
  await owner.getByRole('button',{name:'초대 링크 생성·재발급',exact:true}).waitFor();await auditUi(owner,'groups');
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
  await auditUi(owner,'map');
  await owner.screenshot({path:'test-results/trip-illustrated-map-mobile.png',fullPage:true});
  assert.equal(await owner.getByRole('link',{name:'다음 탐험 · 첨성대',exact:true}).count(),0);
  await owner.locator('.map-pin').nth(1).click();
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
  mkdirSync('test-results',{recursive:true});await auditUi(owner,'stamps');
  await owner.screenshot({path:'test-results/trip-tabs-mobile.png',fullPage:true});
  console.log('PASS: both roles retain four closed-trip tabs; UID-based stamp progress differs, only published memories display and member management is denied');
  console.log('PASS: illustrated map pins and dotted path, next stamp, closed management hidden, direct closed route read-only and 320/390px content clearance');

  // Real Storage upload + trusted finalizer, failure before/after commit, no optimistic stamps.
  const photoTrip=(await db.doc(`groups/${groupId}/trips/${openTripId}`).get()).data(),photoPlace=photoTrip.placeIds[0],photoRoot=`groups/${groupId}/trips/${openTripId}`;
  await owner.goto(origin+`#trip/${groupId}/${openTripId}/stamp/${photoPlace}`);
  await owner.getByRole('button',{name:'사진 저장하고 스탬프 받기',exact:true}).waitFor();
  await owner.waitForFunction(()=>!document.querySelector('#photo-stamp fieldset')?.disabled && !document.querySelector('#photo-stamp button')?.disabled);
  const imageData=await owner.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=400;const x=c.getContext('2d');x.fillStyle='#ddeacc';x.fillRect(0,0,600,400);x.fillStyle='#e7bd57';x.beginPath();x.arc(455,90,45,0,Math.PI*2);x.fill();x.fillStyle='#7b9b77';x.fillRect(0,260,600,140);x.fillStyle='#fffdf7';x.font='32px sans-serif';x.fillText('Our Adventure',145,325);return c.toDataURL('image/png').split(',')[1];});
  const image={name:'test-landscape.png',mimeType:'image/png',buffer:Buffer.from(imageData,'base64')};
  const chooserReady=owner.waitForEvent('filechooser');await owner.getByRole('button',{name:'앨범에서 사진 선택',exact:true}).click();await(await chooserReady).setFiles(image);
  await owner.getByLabel('한 줄 느낌 (선택)',{exact:true}).fill('테스트 사진의 한 줄 느낌');
  await auditUi(owner,'stamp-detail');
  await owner.screenshot({path:'test-results/photo-selected-mobile.png',fullPage:true});
  let firstFinalize,releaseFinalize;const finalizeSeen=new Promise(resolve=>{firstFinalize=resolve;}),gate=new Promise(resolve=>{releaseFinalize=resolve;});
  let requestBody,finalizeCount=0;
  await owner.route('**/finalizePhoto',async route=>{if(route.request().method()!=='POST'){await route.continue();return;}finalizeCount++;requestBody=route.request().postDataJSON().data;firstFinalize();await gate;await route.abort('failed');});
  await owner.getByRole('button',{name:'사진 저장하고 스탬프 받기',exact:true}).click();
  await Promise.race([finalizeSeen,new Promise((_,reject)=>{const timer=setTimeout(async()=>{console.error('Photo stage:',await owner.locator('#photo-status').textContent());await owner.screenshot({path:'test-results/photo-stage-failure.png',fullPage:true});reject(Error('Photo did not reach finalization within 20s'));},20000);finalizeSeen.then(()=>clearTimeout(timer));})]);
  await owner.locator('#photo-stamp').evaluate(form=>{for(let i=0;i<3;i++)form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(finalizeCount,1);assert.equal((await db.collection(photoRoot+'/posts').get()).size,0);assert.equal((await db.collection(photoRoot+'/completions').get()).size,0);
  assert.equal(await owner.locator('[data-own-stamp]').textContent(),'내 스탬프 미완료');
  const objectPath=`${photoRoot}/uploads/${ownerUid}/${requestBody.uploadId}`;
  const readPhoto=async(page,path)=>page.evaluate(async path=>{const s=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js');try{return {size:(await s.getBlob(s.ref(s.getStorage(),path))).size};}catch(error){return {code:error.code};}},path);
  assert.equal((await readPhoto(peer,objectPath)).code,'storage/unauthorized');
  await owner.screenshot({path:'test-results/photo-awaiting-confirmation-mobile.png',fullPage:true});
  releaseFinalize();await owner.getByRole('button',{name:'같은 사진 다시 저장',exact:true}).waitFor();await owner.unroute('**/finalizePhoto');
  const beforeReloadEvents=await owner.evaluate(()=>window.__photoEvents||[]);
  await owner.reload();await owner.getByRole('button',{name:'같은 사진 다시 저장',exact:true}).waitFor();
  assert.equal(await owner.getByLabel('한 줄 느낌 (선택)',{exact:true}).inputValue(),'테스트 사진의 한 줄 느낌');assert.equal(await owner.locator('#photo-preview img').count(),1);
  let finalizationReply;
  await owner.route('**/finalizePhoto',async route=>{if(route.request().method()!=='POST'){await route.continue();return;}assert.deepEqual(route.request().postDataJSON().data,requestBody);const response=await route.fetch();finalizationReply=await response.json();await route.abort('failed');});
  await owner.getByRole('button',{name:'같은 사진 다시 저장',exact:true}).click();
  await owner.waitForFunction(()=>document.querySelector('#photo-status')?.textContent.startsWith('저장하지 못했어요') && !document.querySelector('#photo-stamp button')?.disabled);
  assert.equal((await db.collection(photoRoot+'/posts').get()).size,1,JSON.stringify(finalizationReply));
  await owner.unroute('**/finalizePhoto');await owner.getByRole('button',{name:'같은 사진 다시 저장',exact:true}).click();
  await owner.getByText('사진과 스탬프가 저장됐어요.',{exact:true}).waitFor();
  assert.equal((await db.collection(photoRoot+'/posts').get()).size,1);assert.equal((await db.collection(photoRoot+'/completions').get()).size,1);
  assert.ok((await readPhoto(peer,objectPath)).size>0);
  assert.equal(await owner.locator('[data-trip-post-count]').textContent(),'1');
  await auditUi(owner,'stamp-complete');
  await owner.screenshot({path:'test-results/photo-complete-mobile.png',fullPage:true});
  await owner.getByRole('button',{name:'사진 더 남기기',exact:true}).click();
  await peer.goto(origin+`#trip/${groupId}/${openTripId}/stamps`);await peer.getByRole('heading',{name:'내 스탬프 0/1',exact:true}).waitFor();
  // Camera input, a failed Storage request and an empty feeling: photo two, same one stamp.
  await owner.locator('input[name=camera]').setInputFiles(image);
  await owner.route('**/v0/b/**',route=>route.abort('failed'));
  await owner.locator('#photo-stamp button[type=submit]').click();
  await owner.getByRole('button',{name:'같은 사진 다시 저장',exact:true}).waitFor();await owner.unroute('**/v0/b/**');
  assert.equal(await owner.locator('#photo-preview img').count(),1);await owner.getByRole('button',{name:'같은 사진 다시 저장',exact:true}).click();
  await owner.getByText('사진과 스탬프가 저장됐어요.',{exact:true}).waitFor();
  const savedPhotos=await db.collection(photoRoot+'/posts').get(),completion=(await db.collection(photoRoot+'/completions').get()).docs[0].data();
  assert.equal(savedPhotos.size,2);assert.equal(completion.uid,ownerUid);assert.equal(completion.photoCount,2);assert.ok(savedPhotos.docs.some(d=>d.data().feeling===''));
  const events=[...beforeReloadEvents,...await owner.evaluate(()=>window.__photoEvents||[])].filter(e=>['photo_select','stamp_complete','stamp_complete_fail','photo_add'].includes(e.name));
  assert.equal(events.filter(e=>e.name==='stamp_complete').length,1);assert.equal(events.filter(e=>e.name==='photo_add').length,1);
  assert.ok(events.some(e=>e.name==='photo_select' && e.params.source==='camera'));assert.ok(events.some(e=>e.name==='stamp_complete_fail' && e.params.reason==='upload'));
  assert.doesNotMatch(JSON.stringify(events),/test-landscape|테스트 사진의|objectPath|uploadId|requestId/);
  console.log('PASS: actual Storage upload stays private until server confirmation; failed upload/save preserves input; lost-response and repeated submits make one photo/stamp');
  console.log('PASS: A completes without changing B, empty feeling works, second photo keeps one stamp, camera/gallery and safe GA event sequence verified');


  // T9: actual authenticated images, optional free records and server-owned mutations.
  await owner.goto(origin+`#trip/${groupId}/${openTripId}/memory`);
  await owner.getByRole('heading',{name:'함께 남긴 추억',exact:true}).waitFor();
  await owner.waitForFunction(()=>document.querySelectorAll('.memory-photo img').length===2);
  assert.equal(await owner.locator('.memory-item').count(),2);
  const firstStampId=savedPhotos.docs[0].id,secondStampId=savedPhotos.docs[1].id;
  await owner.locator(`[data-post="${firstStampId}"] .post-menu summary`).click();await owner.locator(`[data-post="${firstStampId}"] [data-memory="edit"]`).click();
  await owner.getByLabel('한 줄 느낌 수정 (선택)',{exact:true}).fill('수정한 여행 느낌');
  let editAbort=true;const editBodies=[];
  await owner.route('**/editPost',async route=>{if(route.request().method()!=='POST'){await route.continue();return;}editBodies.push(route.request().postDataJSON().data);if(editAbort){editAbort=false;await route.fetch();await route.abort('failed');}else await route.continue();});
  await owner.getByRole('button',{name:'수정 저장',exact:true}).click();
  await owner.waitForFunction(()=>document.querySelector('[data-edit-post] button')?.disabled===false);
  assert.equal(await owner.getByLabel('한 줄 느낌 수정 (선택)',{exact:true}).inputValue(),'수정한 여행 느낌');
  await owner.getByRole('button',{name:'수정 저장',exact:true}).click();
  await owner.getByText('수정한 여행 느낌',{exact:true}).waitFor();await owner.unroute('**/editPost');
  assert.equal(new Set(editBodies.map(b=>b.requestId)).size,1);
  await peer.goto(origin+`#trip/${groupId}/${openTripId}/memory`);await peer.getByRole('heading',{name:'함께 남긴 추억',exact:true}).waitFor();
  assert.equal(await peer.locator('[data-memory="edit"],[data-memory="delete"]').count(),0);
  await peer.getByText('자유 기록 남기기',{exact:true}).click();
  await peer.waitForFunction(()=>!document.querySelector('#photo-stamp fieldset')?.disabled && !document.querySelector('#photo-stamp button')?.disabled);
  await peer.getByLabel('사진 선택',{exact:true}).setInputFiles({name:'free-test.png',mimeType:'image/png',buffer:image.buffer});
  await peer.getByRole('button',{name:'자유 기록 저장',exact:true}).click();
  await peer.getByText('자유 기록이 저장됐어요.',{exact:true}).waitFor();
  const freeDocs=await db.collection(photoRoot+'/posts').where('uid','==',peerUid).get();assert.equal(freeDocs.size,1);
  const freeId=freeDocs.docs[0].id;assert.equal(freeDocs.docs[0].data().placeId,null);assert.equal(freeDocs.docs[0].data().feeling,'');
  assert.equal((await db.collection(photoRoot+'/completions').where('uid','==',peerUid).get()).size,0);
  assert.equal(await peer.locator('.memory-item').first().getAttribute('data-post'),freeId);
  await peer.getByLabel('장소별',{exact:true}).selectOption(photoPlace,{force:true});await peer.waitForFunction(()=>document.querySelectorAll('.memory-item').length===2);
  await peer.getByLabel('사람별',{exact:true}).selectOption(peerUid,{force:true});await peer.getByText('조건에 맞는 추억이 없어요.',{exact:true}).waitFor();
  await peer.getByLabel('장소별',{exact:true}).selectOption('free',{force:true});await peer.waitForFunction(()=>document.querySelectorAll('.memory-item').length===1);
  await peer.waitForFunction(()=>document.querySelectorAll('.memory-photo img').length===1);
  assert.equal(await peer.locator('.memory-item').first().getAttribute('data-post'),freeId);
  await peer.screenshot({path:'test-results/t9-filtered-memory-mobile.png',fullPage:true});
  const mutations=await owner.evaluate(async({g,t,id})=>{const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js'),functions=f.getFunctions(undefined,'asia-northeast3');const out=[];for(const name of ['editPost','deletePost']){try{await f.httpsCallable(functions,name)({groupId:g,tripId:t,postId:id,requestId:crypto.randomUUID(),revision:0,feeling:'타인 변경 시도'});out.push('allowed');}catch(e){out.push(e.code);}}return out;},{g:groupId,t:openTripId,id:freeId});
  assert.deepEqual(mutations,['functions/permission-denied','functions/permission-denied']);
  await owner.getByRole('button',{name:'추억 새로고침',exact:true}).click();
  await owner.waitForFunction(()=>document.querySelectorAll('.memory-photo img').length===3);
  assert.equal(await owner.locator('[data-trip-post-count]').textContent(),'3');
  await auditUi(owner,'memories');
  await owner.screenshot({path:'test-results/t9-memory-feed-mobile.png',fullPage:true});
  // More than one page of controlled published fixtures, with equal timestamps, tests cursor ties.
  const batch=db.batch();for(let i=0;i<13;i++){batch.set(db.doc(photoRoot+'/posts/paging-'+String(i).padStart(2,'0')),{uid:peerUid,placeId:null,status:'published',feeling:'페이지 검증 '+i,revision:0,photo:freeDocs.docs[0].data().photo,createdAt:FieldValue.serverTimestamp()});}batch.update(db.doc(photoRoot),{postCount:16});await batch.commit();
  await owner.getByRole('button',{name:'추억 새로고침',exact:true}).click();await owner.waitForFunction(()=>document.querySelectorAll('.memory-item').length===12);
  await owner.getByRole('button',{name:'추억 더 보기',exact:true}).click();await owner.waitForFunction(()=>document.querySelectorAll('.memory-item').length===16);
  const ids=await owner.locator('.memory-item').evaluateAll(nodes=>nodes.map(n=>n.dataset.post));assert.equal(new Set(ids).size,16);
  await owner.getByLabel('장소별',{exact:true}).selectOption(photoPlace,{force:true});await owner.waitForFunction(()=>document.querySelectorAll('.memory-item').length===2);
  for(const id of [firstStampId,secondStampId]){owner.once('dialog',dialog=>dialog.accept());await owner.locator(`[data-post="${id}"] .post-menu summary`).click();await owner.locator(`[data-post="${id}"] [data-memory="delete"]`).click();await owner.waitForFunction(id=>!document.querySelector(`[data-post="${id}"]`),id);}
  await owner.getByText('기록을 삭제했어요. 이 장소의 내 스탬프는 미완료예요.',{exact:true}).waitFor();
  await owner.screenshot({path:'test-results/t9-last-stamp-deleted-mobile.png',fullPage:true});
  assert.equal((await db.collection(photoRoot+'/completions').where('uid','==',ownerUid).get()).size,0);
  assert.ok((await readPhoto(peer,savedPhotos.docs[0].data().photo.objectPath)).code);
  await owner.getByRole('link',{name:'스탬프',exact:true}).click();await owner.getByRole('heading',{name:'내 스탬프 0/1',exact:true}).waitFor();
  const t9Events=[...await owner.evaluate(()=>window.__photoEvents||[]),...await peer.evaluate(()=>window.__photoEvents||[])];
  assert.equal(t9Events.filter(e=>e.name==='free_post_create').length,1);assert.equal(t9Events.filter(e=>e.name==='post_delete').length,2);assert.ok(t9Events.some(e=>e.name==='feed_view'));
  assert.doesNotMatch(JSON.stringify(t9Events.filter(e=>['free_post_create','post_delete','feed_view'].includes(e.name))),/修|수정한 여행 느낌|free-test.png|objectPath|member_id|place_id/);
  console.log('PASS T9: authenticated photo feed, newest order, combined place/person filters and cursor pagination without duplicate IDs');
  console.log('PASS T9: optional free post creates no stamp; own edit survives lost response; leader cannot mutate another author; deleting last photo removes only own stamp');

  const invoke=async(page,name,data)=>page.evaluate(async({name,data})=>{
    const sdk=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js');
    try{return {data:(await sdk.httpsCallable(sdk.getFunctions(undefined,'asia-northeast3'),name)(data)).data};}catch(error){return {code:error.code};}
  },{name,data});
  assert.equal((await invoke(peer,'endTrip',{groupId,tripId:openTripId})).code,'functions/permission-denied');
  await owner.goto(origin+`#trip/${groupId}/${openTripId}/manage`);
  const endButton=owner.getByRole('button',{name:'여행 종료',exact:true});await endButton.waitFor();
  owner.once('dialog',dialog=>dialog.dismiss());await endButton.click();
  assert.equal((await db.doc(`groups/${groupId}/trips/${openTripId}`).get()).data().status,'open');
  // Commit the end, lose the response, retry from stale UI: the server must keep one closure.
  await owner.route('**/endTrip',async route=>{if(route.request().method()!=='POST'){await route.continue();return;}await route.fetch();await route.abort('failed');});
  owner.once('dialog',dialog=>dialog.accept());await endButton.click();
  await owner.waitForFunction(()=>document.querySelector('#message')?.textContent && !document.querySelector('button[data-trip-action="end"]')?.disabled);
  const endedRef=db.doc(`groups/${groupId}/trips/${openTripId}`),firstEnd=(await endedRef.get()).data();
  assert.equal(firstEnd.status,'closed');assert.equal(firstEnd.closedBy,ownerUid);
  await owner.unroute('**/endTrip');owner.once('dialog',dialog=>dialog.accept());await endButton.click();
  await owner.waitForURL(url=>url.hash===`#trip/${groupId}/${openTripId}/map`);
  await owner.getByRole('heading',{name:'여행 지도',exact:true}).waitFor();
  assert.equal((await endedRef.get()).data().closedAt.toMillis(),firstEnd.closedAt.toMillis());
  for(const page of [owner,peer]){
    await page.goto(origin+`#trip/${groupId}/${openTripId}/map`);await page.getByRole('heading',{name:'여행 지도',exact:true}).waitFor();
    const nav=page.getByRole('navigation',{name:'여행 화면'});
    for(const [label,heading] of [['코스','여행 코스'],['스탬프','내 스탬프 0/1'],['추억','함께 남긴 추억'],['지도','여행 지도']]){
      await nav.getByRole('link',{name:label,exact:true}).click();await page.getByRole('heading',{name:heading,exact:true}).waitFor();
      assert.equal(await page.getByRole('link',{name:'여행 관리',exact:true}).count(),0);
      assert.equal(await page.locator('form,input[type=file],button[data-trip-action="end"]').count(),0);
    }
  }
  assert.equal((await invoke(owner,'addTripPlace',{groupId,tripId:openTripId,requestId:crypto.randomUUID(),place:{name:'종료 후 장소'}})).code,'functions/failed-precondition');
  await owner.screenshot({path:'test-results/trip-ended-readonly-mobile.png',fullPage:true});
  console.log('PASS: member end denied; leader cancel preserves open; committed end survives lost-response retry with unchanged closedAt');
  console.log('PASS: newly ended trip retains four read-only tabs for both roles, no management/write controls and callable rejects new place');

  await peer.goto(origin+'#groups');await peer.getByRole('link',{name:'브라우저 테스트 그룹',exact:true}).waitFor();
  assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  mkdirSync('test-results',{recursive:true});await owner.screenshot({path:'test-results/groups-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: member management controls absent, direct create route denied, closed-trip reads and outsider denial');

  // Group details may be introduced by a valid invite, but a full/invalid state must clear them.
  const outsiderContext=await browser.newContext({viewport:{width:320,height:740}});await sdkCache(outsiderContext);const stranger=await outsiderContext.newPage();
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
  await peer.getByRole('button',{name:'Google로 시작하기',exact:true}).waitFor();
  assert.equal(await peer.getByRole('link',{name:'브라우저 테스트 그룹',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  await stranger.screenshot({path:'test-results/invite-full-invalid-mobile.png',fullPage:true});
  console.log('PASS: leader generates and copies link; anonymous nickname join and repeated-link reentry do not duplicate membership');
  console.log('PASS: full race clears introduction; full, malformed and revoked links expose no group content; rotation preserves members');
  console.log('PASS: header brand and badge do not overlap at 320px and 390px');
  console.log('Physical mobile, production OAuth/Functions and visual font quality remain untested.');
} catch(error){console.error('Browser page errors:',errors);if(browser){let i=0;for(const context of browser.contexts())for(const page of context.pages()){await page.screenshot({path:'test-results/ui-failure-'+(i++)+'.png',fullPage:true,timeout:5000}).catch(()=>{});console.error('UI diagnostic:',await page.evaluate(()=>({message:document.querySelector('#message')?.textContent,screen:document.querySelector('#app')?.textContent?.slice(0,500)})).catch(()=>({})));}}throw error;} finally {
  await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.terminate();await deleteApp(admin);
}
