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
import {createHash} from 'node:crypto';
assert.ok(process.env.FIREBASE_STORAGE_EMULATOR_HOST,'Storage emulator required');
const invoke=(page,name,data)=>page.evaluate(async({name,data})=>{
  const f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js');
  try{return {data:(await f.httpsCallable(f.getFunctions(undefined,'asia-northeast3'),name)(data)).data};}catch(error){return {code:error.code};}
},{name,data});
const request=async(page,name,data)=>{const result=await invoke(page,name,data);assert.ok(result.data,JSON.stringify(result));return result.data;};
async function upload(page,{groupId,tripId,placeId=null,index=0,feeling='',finish=true}){
  return page.evaluate(async data=>{
    const a=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),s=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js'),f=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js');
    const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;const c=canvas.getContext('2d'),palette=[['#eed8a0','#bb643d','#536e57'],['#b5dfed','#e3bf5a','#437f9a'],['#dfe8c6','#c77b41','#3b6755'],['#d7c4da','#ede0ad','#6e668c']][data.index%4];
    c.fillStyle=palette[0];c.fillRect(0,0,960,640);c.fillStyle=palette[1];c.beginPath();c.arc(710,155,78,0,Math.PI*2);c.fill();c.fillStyle=palette[2];c.beginPath();c.moveTo(0,480);c.lineTo(250,270);c.lineTo(510,470);c.lineTo(700,330);c.lineTo(960,490);c.lineTo(960,640);c.lineTo(0,640);c.fill();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),uid=a.getAuth().currentUser.uid,uploadId=crypto.randomUUID();
    await s.uploadBytes(s.ref(s.getStorage(),`groups/${data.groupId}/trips/${data.tripId}/uploads/${uid}/${uploadId}`),blob,{contentType:'image/png'});
    if(!data.finish)return {uploadId,uid};
    return (await f.httpsCallable(f.getFunctions(undefined,'asia-northeast3'),'finalizePhoto')({groupId:data.groupId,tripId:data.tripId,placeId:data.placeId,feeling:data.feeling,uploadId,requestId:crypto.randomUUID()})).data;
  },{groupId,tripId,placeId,index,feeling,finish});
}
function pngInfo(bytes){
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');const chunks=[];
  for(let offset=8;offset<bytes.length;){const length=bytes.readUInt32BE(offset),type=bytes.subarray(offset+4,offset+8).toString('ascii');chunks.push(type);offset+=length+12;if(type==='IEND')break;}
  assert.ok(!chunks.some(type=>['eXIf','tEXt','zTXt','iTXt'].includes(type)),'Export must not retain source EXIF/text metadata');
  assert.equal(bytes.includes(Buffer.from('PRIVATE_')),false);
  return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
}
try{
  mkdirSync('test-results',{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--disable-gpu','--renderer-process-limit=2','--js-flags=--max-old-space-size=128']});
  const leader=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),member=await browser.newContext({viewport:{width:390,height:844}});
  await sdkCache(leader);await sdkCache(member);const owner=await leader.newPage(),peer=await member.newPage();
  for(const page of [owner,peer]){await page.addInitScript(()=>{const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(this.canvas.width===1080 && [1350,1920].includes(this.canvas.height))(window.__exportTexts||=[]).push(String(text));return original.call(this,text,...args);};});page.setDefaultNavigationTimeout(60000);page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);await page.getByRole('heading',{name:/내 그룹|오늘의 여행이/}).waitFor();}
  await auth(owner,true);await auth(peer);
  const groupId=(await request(owner,'createGroup',{title:'리포트 검증 그룹',requestId:crypto.randomUUID()})).groupId;
  const {token}=await request(owner,'createGroupInvite',{groupId});await request(peer,'joinGroup',{token,nickname:'별빛'});
  const tripId=(await request(owner,'createTrip',{groupId,requestId:crypto.randomUUID(),title:'PRIVATE_TRIP_REPORT',destination:'PRIVATE_LOCATION_REPORT',startDate:'2026-10-28',endDate:'2026-10-30',places:[{name:'PRIVATE_LOCATION_ONE'},{name:'PRIVATE_LOCATION_TWO'}]})).tripId;
  const path=`groups/${groupId}/trips/${tripId}`,[p1,p2]=(await db.doc(path).get()).data().placeIds;
  await upload(owner,{groupId,tripId,placeId:p1,index:0,feeling:'PRIVATE_NOTE_A'});
  const representative=await upload(owner,{groupId,tripId,placeId:p1,index:1});
  await upload(peer,{groupId,tripId,placeId:p2,index:2,feeling:'PRIVATE_NOTE_B'});
  await upload(peer,{groupId,tripId,index:3,feeling:'PRIVATE_NOTE_FREE'});
  await upload(peer,{groupId,tripId,index:0,finish:false});
  await db.doc(path+'/posts/unfinished').set({uid:'pending-author',status:'pending',feeling:'PRIVATE_PENDING'});
  assert.equal((await invoke(owner,'getTripReport',{groupId,tripId})).code,'functions/failed-precondition');
  await request(owner,'endTrip',{groupId,tripId});
  for(const page of [owner,peer]){
    await page.goto(origin+`#trip/${groupId}/${tripId}/report`);await page.getByRole('heading',{name:'여행 리포트',exact:true}).waitFor();
    assert.equal(await page.locator('[data-report-value="places"]').textContent(),'2');assert.equal(await page.locator('[data-report-value="photos"]').textContent(),'4');assert.equal(await page.locator('[data-report-value="stamps"]').textContent(),'2 / 4');
    await page.getByText('2026-10-28 ~ 2026-10-30 · 3일',{exact:true}).waitFor();await page.getByText('PRIVATE_NOTE_FREE',{exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelectorAll('.report-photo img').length===2);
    assert.equal(await page.locator(`[data-report-photo="${representative.postId}"] img`).count(),1);assert.equal(await page.getByText('PRIVATE_PENDING',{exact:true}).count(),0);
  }
  await auditUi(owner,'report');
  await owner.screenshot({path:'test-results/report-leader-mobile.png',fullPage:true});
  assert.equal(await peer.getByRole('link',{name:'인스타 이미지 만들기',exact:true}).count(),0);
  await peer.goto(origin+`#trip/${groupId}/${tripId}/share`);await peer.getByRole('heading',{name:'리더만 결과 이미지를 구성할 수 있어요',exact:true}).waitFor();assert.equal(await peer.locator('[data-report="save"]').count(),0);
  await peer.screenshot({path:'test-results/report-member-readonly-mobile.png',fullPage:true});
  const report=await request(owner,'getTripReport',{groupId,tripId});
  assert.equal((await invoke(peer,'configureShareImage',{groupId,tripId,requestId:crypto.randomUUID(),format:'feed',template:'grid',postIds:[report.photos[0].id]})).code,'functions/permission-denied');
  console.log('PASS REPORT: ended member/leader report, period and actual published counts, deduplicated stamps, representative photos, lines and member configure rejection');
  const emptyTrip=(await request(owner,'createTrip',{groupId,requestId:crypto.randomUUID(),title:'사진 없는 여행',destination:'테스트',startDate:'2026-10-28',endDate:'2026-10-28',places:[]})).tripId;
  await request(owner,'endTrip',{groupId,tripId:emptyTrip});await owner.goto(origin+`#trip/${groupId}/${emptyTrip}/share`);await owner.getByRole('heading',{name:'인스타 이미지 만들기',exact:true}).waitFor();
  assert.equal(await owner.locator('[data-report="preview"]').isDisabled(),true);assert.equal(await owner.locator('[data-report="save"]').isDisabled(),true);assert.equal(await owner.locator('#share-preview img').count(),0);
  console.log('PASS REPORT: zero photos cannot preview or download a blank image');
  await owner.route('**/v0/b/**',async route=>{if(route.request().method()==='GET')await route.abort('failed');else await route.continue();});
  await owner.goto(origin+`#trip/${groupId}/${tripId}/share`);await owner.getByRole('heading',{name:'인스타 이미지 만들기',exact:true}).waitFor();
  assert.equal(await owner.locator('[data-share-photo]').count(),4);
  assert.equal(await owner.locator('[data-report="preview"]').isDisabled(),true);
  for(let i=1;i<=4;i++)await owner.getByLabel(`사진 ${i} 선택`,{exact:true}).check();
  await owner.getByRole('button',{name:'미리보기 만들기',exact:true}).click();
  await owner.waitForFunction(()=>document.querySelector('#share-status')?.textContent.startsWith('이미지를 만들지 못했어요') && !document.querySelector('[data-report="preview"]')?.disabled);
  assert.equal(await owner.locator('#share-preview img').count(),0);assert.equal(await owner.locator('[data-report="save"]').isDisabled(),true);assert.equal(await owner.locator('[data-share-photo]:checked').count(),4);
  await owner.screenshot({path:'test-results/report-photo-failure-mobile.png',fullPage:true});await owner.unroute('**/v0/b/**');
  console.log('PASS REPORT: actual Storage read failure blocks PNG and preserves selected photos for retry');
  let downloads=0;owner.on('download',()=>downloads++);
  for(const format of ['feed','story'])for(const template of ['grid','board']){
    await owner.getByLabel('이미지 크기',{exact:true}).selectOption(format,{force:true});await owner.getByLabel('템플릿',{exact:true}).selectOption(template,{force:true});
    assert.equal(await owner.locator('#share-preview img').count(),0);assert.equal(await owner.locator('[data-report="save"]').isDisabled(),true);
    await owner.getByRole('button',{name:'미리보기 만들기',exact:true}).click();
    await owner.locator('#share-preview img').waitFor();
    assert.equal(await owner.locator('[data-report="save"]').isDisabled(),true,'Photo-content confirmation is required');
    const preview=await owner.locator('#share-preview img').evaluate(async img=>{await img.decode();const bytes=await(await fetch(img.src)).arrayBuffer();return {width:img.naturalWidth,height:img.naturalHeight,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('')};});
    assert.equal(preview.width,1080);assert.equal(preview.height,format==='feed'?1350:1920);
    const rendered=await owner.evaluate(()=>window.__exportTexts||[]);assert.ok(rendered.includes('사진 4장 · 도장 2/4'));assert.ok(rendered.includes(template==='grid'?'함께 남긴 추억':'우리가 모은 도장'));assert.doesNotMatch(JSON.stringify(rendered),/PRIVATE_|Made together|MADE TOGETHER|STAMP COLLECTION|PHOTOS/);
    await owner.getByLabel('선택한 사진에 별칭 외 개인정보·위치 정보가 드러나지 않는지 확인했어요.',{exact:true}).check();
    const pending=owner.waitForEvent('download');await owner.getByRole('button',{name:'PNG 저장',exact:true}).click();const download=await pending;
    assert.equal(download.suggestedFilename(),`our-adventure-${template}-${format}.png`);
    const file=`test-results/report-${template}-${format}.png`;await download.saveAs(file);const bytes=readFileSync(file),info=pngInfo(bytes);
    assert.deepEqual(info,{width:1080,height:format==='feed'?1350:1920});assert.equal(createHash('sha256').update(bytes).digest('hex'),preview.hash,'Preview and saved PNG must be the same binary');
    await owner.locator('#share-preview').screenshot({path:`test-results/report-${template}-${format}-preview.png`});
    await owner.waitForFunction(()=>document.querySelector('#share-status')?.textContent.startsWith('미리보기와 같은 PNG의 다운로드를 시작했어요') && !document.querySelector('[data-report="preview"]')?.disabled);
  }
  assert.equal(downloads,4);
  assert.equal(await owner.getByLabel('여행 이름 표시',{exact:true}).isChecked(),false);
  assert.equal(await owner.locator('#share-title-notice').isVisible(),false);
  const off=await request(owner,'configureShareImage',{groupId,tripId,requestId:crypto.randomUUID(),format:'feed',template:'grid',postIds:[report.photos[0].id]});
  assert.equal(off.includeTripTitle,false);assert.equal(Object.hasOwn(off,'tripTitle'),false);
  await owner.getByLabel('여행 이름 표시',{exact:true}).check();
  await owner.getByText('여행 이름이 이미지에 들어가요',{exact:true}).waitFor();
  assert.equal(await owner.locator('#share-preview img').count(),0);assert.equal(await owner.locator('[data-report="save"]').isDisabled(),true);
  const on=await request(owner,'configureShareImage',{groupId,tripId,requestId:crypto.randomUUID(),format:'story',template:'board',postIds:[report.photos[0].id],includeTripTitle:true,tripTitle:'UNTRUSTED_TITLE'});
  assert.equal(on.tripTitle,'PRIVATE_TRIP_REPORT');assert.equal(on.includeTripTitle,true);assert.doesNotMatch(JSON.stringify(on),/PRIVATE_LOCATION|PRIVATE_NOTE|UNTRUSTED_TITLE/);
  await owner.getByRole('button',{name:'미리보기 만들기',exact:true}).click();await owner.locator('#share-preview img').waitFor();
  const titleText=await owner.evaluate(()=>window.__exportTexts||[]);assert.ok(titleText.includes('PRIVATE_TRIP_REPORT'));assert.doesNotMatch(JSON.stringify(titleText),/PRIVATE_LOCATION|PRIVATE_NOTE|Made together/);
  const titleHash=await owner.locator('#share-preview img').evaluate(async img=>{await img.decode();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(img.src)).arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');});
  await owner.getByLabel('선택한 사진에 별칭 외 개인정보·위치 정보가 드러나지 않는지 확인했어요.',{exact:true}).check();
  const titlePending=owner.waitForEvent('download');await owner.getByRole('button',{name:'PNG 저장',exact:true}).click();const titleDownload=await titlePending;
  await titleDownload.saveAs('test-results/report-board-story-title.png');const titleBytes=readFileSync('test-results/report-board-story-title.png');pngInfo(titleBytes);assert.equal(createHash('sha256').update(titleBytes).digest('hex'),titleHash);
  await owner.waitForFunction(()=>document.querySelector('#share-status')?.textContent.startsWith('미리보기와 같은 PNG의 다운로드를 시작했어요') && !document.querySelector('[data-report="preview"]')?.disabled);
  await owner.screenshot({path:'test-results/report-title-option-mobile.png',fullPage:true});
  await owner.getByLabel('여행 이름 표시',{exact:true}).uncheck();assert.equal(await owner.locator('#share-title-notice').isVisible(),false);assert.equal(await owner.locator('#share-preview img').count(),0);
  await owner.getByRole('button',{name:'미리보기 만들기',exact:true}).click();await owner.locator('#share-preview img').waitFor();
  await owner.getByLabel('선택한 사진에 별칭 외 개인정보·위치 정보가 드러나지 않는지 확인했어요.',{exact:true}).check();
  console.log('PASS REPORT REVIEW: title defaults off, explicit opt-in notice, server-sourced title, on/off invalidation and title PNG matches preview');
  await owner.screenshot({path:'test-results/report-export-mobile.png',fullPage:true});
  console.log('PASS REPORT AC-6d: all four grid/board × feed/story PNG downloads match preview SHA-256 and exact dimensions; no EXIF/text metadata');
  // A stale leader screen must not download after its server role changes.
  const ownerUid=await owner.evaluate(async()=>{const a=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');return a.getAuth().currentUser.uid;});
  await db.doc(`groups/${groupId}/members/${ownerUid}`).update({role:'member'});
  await owner.getByRole('button',{name:'PNG 저장',exact:true}).click();await owner.getByText('저장하지 못했어요. 사진과 권한을 다시 확인하고 미리보기를 만들어주세요.',{exact:true}).waitFor();
  assert.equal(downloads,5);assert.equal(await owner.locator('[data-report="save"]').isDisabled(),true);assert.equal(await owner.locator('#share-preview img').count(),0);
  const events=[...await owner.evaluate(()=>window.__photoEvents||[]),...await peer.evaluate(()=>window.__photoEvents||[])].filter(e=>['report_view','share_image_create','share_image_save'].includes(e.name));
  assert.equal(events.filter(e=>e.name==='share_image_create').length,6);assert.equal(events.filter(e=>e.name==='share_image_save' && e.params.result==='ok').length,5);assert.equal(events.filter(e=>e.name==='share_image_save' && e.params.result==='error').length,1);assert.ok(events.some(e=>e.name==='report_view' && e.params.role==='member'));
  assert.doesNotMatch(JSON.stringify(events),/PRIVATE_|별빛|objectPath|postIds|email|uid/);assert.deepEqual(errors,[]);
  console.log('PASS REPORT AC-6a: stale leader export is re-authorized and rejected without a new download; safe GA success/failure sequence verified');
}catch(error){
  console.error('Report UI errors:',errors);if(browser){let i=0;for(const context of browser.contexts())for(const page of context.pages()){await page.screenshot({path:`test-results/report-failure-${i++}.png`,fullPage:true,timeout:5000}).catch(()=>{});console.error('Report status:',await page.evaluate(()=>({share:document.querySelector('#share-status')?.textContent,message:document.querySelector('#message')?.textContent})).catch(()=>({})));}}throw error;
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.terminate();await deleteApp(admin);}
