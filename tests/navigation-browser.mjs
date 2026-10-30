import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Demo emulators required');
const root=process.cwd(),origin='http://127.0.0.1:8080/next/';
const server=createServer((req,res)=>{
 const name=new URL(req.url,origin).pathname.replace(/^\/next\//,'')||'index.html';
 if(name==='firebase-config.js'){res.setHeader('Content-Type','text/javascript');res.end("export const firebaseConfig={apiKey:'demo-key',authDomain:'demo-our-adventure.firebaseapp.com',projectId:'demo-our-adventure',appId:'demo-app'};export const useEmulators=true;");return;}
 if(!/^[a-z0-9./_-]+$/i.test(name)||name.includes('..')){res.writeHead(404).end();return;}
 try{const body=readFileSync(resolve(root,'next',name));res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf'})[extname(name)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404).end();}
}).listen(8080,'127.0.0.1');await once(server,'listening');
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--disable-gpu','--renderer-process-limit=2']});const context=await browser.newContext({viewport:{width:390,height:844}});
 if(process.env.FIREBASE_BROWSER_SDK_CACHE)await context.route('https://www.gstatic.com/firebasejs/13.0.0/*.js',route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);return route.fulfill({status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:readFileSync(resolve(process.env.FIREBASE_BROWSER_SDK_CACHE,name))});});
 const page=await context.newPage();page.setDefaultTimeout(20000);let navigations=0;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())navigations++;});
 await page.goto(origin);await page.getByRole('button',{name:'Google로 시작하기',exact:true}).waitFor();
 const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Google로 시작하기',exact:true}).click();const popup=await popupPromise;
 await popup.waitForLoadState('domcontentloaded');
 mkdirSync('test-results',{recursive:true});await popup.screenshot({path:'test-results/navigation-auth-popup.png'});
 // Complete the emulator's real popup flow, using only a synthetic account.
 const add=popup.getByRole('button',{name:/Add.*account/i});await add.click();
 await popup.getByLabel('Email',{exact:true}).fill('navigation-owner@example.test');
 await popup.getByRole('button',{name:'Sign in with Google.com',exact:true}).click();
 await page.getByRole('heading',{name:'내 그룹',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'로그아웃',exact:true}).isEnabled(),true);
 console.log('PASS: actual Google popup login button completes and opens groups without reload');
 await page.getByRole('link',{name:'새 그룹 만들기',exact:true}).click();
 await page.getByLabel('그룹 이름',{exact:true}).fill('로딩 전환 QA');await page.getByRole('button',{name:'그룹 만들기',exact:true}).click();
 await page.getByRole('heading',{name:'로딩 전환 QA',exact:true}).waitFor();
 const groupId=await page.evaluate(()=>location.hash.split('/')[1]);
 await page.getByRole('link',{name:'새 여행 만들기',exact:true}).click();
 await page.getByLabel('여행 이름',{exact:true}).fill('새로고침 없는 여행');await page.getByLabel('목적지',{exact:true}).fill('제주');
 await page.getByLabel('시작 날짜',{exact:true}).fill('2026-11-01');await page.getByLabel('종료 날짜',{exact:true}).fill('2026-11-02');
 await page.getByLabel('방문 장소',{exact:false}).fill('성산일출봉');await page.getByRole('button',{name:'여행 만들기',exact:true}).click();
 await page.getByRole('heading',{name:'새로고침 없는 여행',exact:true}).waitFor();
 await page.getByRole('link',{name:'코스',exact:true}).click();
 await page.getByRole('button',{name:'장소 추가',exact:true}).click();await page.getByLabel('장소 이름',{exact:true}).fill('섭지코지');
 await page.getByRole('button',{name:'장소 추가하기',exact:true}).click();await page.getByRole('heading',{name:'섭지코지',exact:true}).waitFor();
 assert.equal(navigations,1,'all transitions must complete in the same document without reload');
 await page.screenshot({path:'test-results/navigation-course-without-reload.png',fullPage:true});
 console.log('PASS: popup login -> group -> trip -> course -> place add completes with one document load');
 // Buffer Firestore responses to reproduce a read that never settles. Both attempts
 // must finish in an error state with a usable in-app retry, then recover in place.
 const blocked=new Set();let blocking=true;
 await context.route('**/google.firestore.v1.Firestore/Listen/channel**',async route=>{if(blocking){blocked.add(route);return;}await route.continue();});
 await page.evaluate(async()=>{const sdk=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js');await sdk.disableNetwork(sdk.getFirestore());await sdk.enableNetwork(sdk.getFirestore());});
 await page.evaluate(g=>{location.hash='group/'+g;},groupId);
 await page.getByRole('heading',{name:'목록이나 여행을 불러오지 못했어요',exact:true}).waitFor({timeout:45000});
 assert.equal(await page.getByRole('button',{name:'다시 확인',exact:true}).isEnabled(),true);
 blocking=false;for(const route of blocked)await route.abort().catch(()=>{});
 await context.unroute('**/google.firestore.v1.Firestore/Listen/channel**');
 await page.getByRole('button',{name:'다시 확인',exact:true}).click();await page.getByRole('heading',{name:'로딩 전환 QA',exact:true}).waitFor({timeout:30000});
 assert.equal(navigations,1);assert.deepEqual(errors,[]);
 console.log('PASS: stalled Firestore response exits loading; in-app retry recovers without reload');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
