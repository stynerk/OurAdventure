// Run against demo Auth + Firestore + Functions emulators only.
import {chromium} from 'playwright';
import {writeFileSync,unlinkSync,existsSync,mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const configPath='next/firebase-config.js';
if(existsSync(configPath))throw new Error('Move existing local Firebase config aside before browser tests.');
const server=spawn('python3',['-m','http.server','8080'],{stdio:'ignore'});
let browser;
const origin='http://127.0.0.1:8080/next/';
const waitCount=(page,n)=>page.waitForFunction(n=>document.querySelector('.stamp-count')?.textContent.endsWith(`${n}/9`),n);
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}:undefined});
  const leader=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true}), familyA=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true}), familyB=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true});
  const owner=await leader.newPage(), a=await familyA.newPage(), b=await familyB.newPage();
  owner.on('dialog',dialog=>dialog.accept());
  owner.on('pageerror',error=>console.log('Browser page error:',error.message));
  owner.on('requestfailed',request=>console.log('Browser request failed:',request.url().split('?')[0],request.failure()?.errorText));
  await owner.goto(origin);
  await owner.getByRole('heading',{name:'함께하는 탐험을 준비하고 있어요'}).waitFor();
  console.log('PASS: missing Firebase configuration has a usable fallback');
  writeFileSync(configPath,`export const firebaseConfig={apiKey:'demo-key',authDomain:'demo-our-adventure.firebaseapp.com',projectId:'demo-our-adventure',appId:'demo-app'};export const useEmulators=true;export const enableIndividualPilot=true;`);
  await owner.reload();await owner.getByRole('link',{name:'탐험방 만들기',exact:true}).waitFor();
  // Fake Google credential is accepted only by the Auth emulator; no real account/login.
  await owner.evaluate(async()=>{
    const sdk=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');
    const encode=data=>btoa(JSON.stringify(data)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const token=encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://accounts.google.com',sub:'e2e-google-leader',aud:'demo',email:'leader@example.test',email_verified:true})+'.';
    await sdk.signInWithCredential(sdk.getAuth(),sdk.GoogleAuthProvider.credential(token));
  });
  async function create(title,mode){
    await owner.goto(origin+'#create');await owner.getByLabel('탐험방 이름').fill(title);
    await owner.locator(`input[value="${mode}"]`).check();await owner.getByRole('button',{name:'탐험방 만들기',exact:true}).click();
    await owner.getByRole('heading',{name:title,exact:true}).waitFor();
    return owner.locator('.invite').textContent();
  }
  async function join(page,url){
    await page.goto(url);await page.getByLabel('탐험가 별칭').fill('같은 별칭');await page.getByRole('button',{name:'탐험 시작',exact:true}).click();await waitCount(page,0);
    assert.equal(await page.getByRole('button',{name:/Google/}).count(),0);
    assert.equal(await page.getByRole('heading',{name:'방장 관리'}).count(),0);
  }
  let url=await create('가족 공동 테스트','shared');await join(a,url);await join(b,url);
  await a.locator('details').last().locator('summary').click();await a.locator('details').last().getByRole('button').click();
  await Promise.all([waitCount(owner,1),waitCount(a,1),waitCount(b,1)]);
  await b.reload();await waitCount(b,1);
  assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
  mkdirSync('test-results',{recursive:true});await a.screenshot({path:'test-results/shared-mobile.png',fullPage:true});
  await owner.getByRole('button',{name:'탐험방 종료',exact:true}).click();
  await a.getByText('종료된 탐험방이에요. 기록은 읽기만 할 수 있어요.').waitFor();
  assert.equal(await a.locator('details button:not(:disabled)').count(),0);
  console.log('PASS: shared stamp sync across three browser sessions, refresh persistence, closed-room UI, mobile width');
  url=await create('개인별 제출 테스트','individual');await join(a,url);await join(b,url);
  assert.equal(await a.getByRole('button',{name:'필수 미션을 완료하면 제출할 수 있어요'}).isDisabled(),true);
  for(let i=0;i<9;i++){
    const quest=a.locator('details').nth(i);await quest.locator('summary').click();await quest.getByRole('button').click();await waitCount(a,i+1);
  }
  await waitCount(b,0);await a.getByRole('button',{name:'완료 결과 제출',exact:true}).click();await a.getByRole('button',{name:'제출 완료',exact:true}).waitFor();
  await owner.getByText('제출 1/2명 (참여자 기준)',{exact:true}).waitFor();
  await a.reload();await waitCount(a,9);await a.getByRole('button',{name:'제출 완료',exact:true}).waitFor();
  await owner.screenshot({path:'test-results/manage-mobile.png',fullPage:true});
  console.log('PASS: individual progress isolation, all-nine completion, final submission, management summary, session restoration');
  console.log('Real Google popup, production Firebase, physical iOS/Android and cross-device latency remain untested.');
}catch(error){for(const context of browser?.contexts() || [])for(const page of context.pages())console.log('Browser failure state:',await page.locator('body').innerText().catch(()=>''));throw error;}finally{
  await browser?.close();server.kill();if(existsSync(configPath))unlinkSync(configPath);
}
