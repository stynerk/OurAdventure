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
const files=new Set(['index.html','style.css','app.js','session.mjs','groups.mjs','creation-requests.mjs','analytics.mjs','course.json']);
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
  assert.equal((await db.collection(`groups/${groupId}/trips`).get()).size,3);
  console.log('PASS: lost creation response preserves form; recovery reuses one trip without duplicates');

  await peer.goto(origin);await peer.getByRole('heading',{name:'내 그룹',exact:true}).waitFor();await auth(peer);
  const peerUid=await peer.evaluate(async()=>{const a=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');return a.getAuth().currentUser.uid;});
  await db.runTransaction(async tx=>{
    const ref=db.doc(`groups/${groupId}`),g=await tx.get(ref);
    tx.create(ref.collection('members').doc(peerUid),{role:'member',displayName:'테스트 멤버',joinedAt:FieldValue.serverTimestamp()});
    tx.update(ref,{memberIds:[...g.data().memberIds,peerUid],memberCount:g.data().memberCount+1});
  });
  await peer.reload();await peer.getByRole('link',{name:'브라우저 테스트 그룹',exact:true}).click();
  await peer.getByRole('heading',{name:'지난 여행',exact:true}).waitFor();
  assert.equal(await peer.getByRole('link',{name:'새 여행 만들기',exact:true}).count(),0);
  await peer.getByRole('link',{name:'첫 여행',exact:true}).click();
  await peer.getByRole('heading',{name:'첫 여행',exact:true}).waitFor();
  await peer.goto(origin+'#trip-create/'+groupId);await peer.getByRole('heading',{name:'리더만 여행을 만들 수 있어요',exact:true}).waitFor();
  assert.equal(await peer.locator('#v2-trip-create').count(),0);
  await peer.goto(origin+'#group/not-a-member');await peer.getByRole('heading',{name:'목록이나 여행을 불러오지 못했어요',exact:true}).waitFor();
  assert.equal(await peer.getByText('브라우저 테스트 그룹',{exact:true}).count(),0);
  await peer.goto(origin+'#groups');await peer.getByRole('link',{name:'브라우저 테스트 그룹',exact:true}).waitFor();
  await peer.evaluate(async()=>{const sdk=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');await sdk.signOut(sdk.getAuth());});
  await peer.getByRole('button',{name:'Google로 로그인',exact:true}).waitFor();
  assert.equal(await peer.getByRole('link',{name:'브라우저 테스트 그룹',exact:true}).count(),0);
  assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  mkdirSync('test-results',{recursive:true});await owner.screenshot({path:'test-results/groups-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: member management controls absent, direct create route denied, closed-trip reads, outsider denial and sign-out isolation');
  console.log('Physical mobile, production OAuth/Functions and visual font quality remain untested.');
} finally {
  await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.terminate();await deleteApp(admin);
}
