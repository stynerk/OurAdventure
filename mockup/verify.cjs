const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const nodes = new Map();
const node = selector => {
  if (!nodes.has(selector)) nodes.set(selector, {innerHTML:'',textContent:'',disabled:false,hidden:false});
  return nodes.get(selector);
};
const listeners = {};
const storage = new Map();
storage.set('gj-family-quest', '{"existing":"preserved"}');
storage.set('gj-family-diary-template', '{"existing":"preserved"}');
let failStorage = false;
const sandbox = {
  console, URL, Date, Math, Set, Map,
  crypto: {randomUUID: require('node:crypto').randomUUID},
  localStorage: {
    getItem: k => storage.get(k) || null,
    setItem: (k,v) => {if(failStorage) throw Error('quota'); storage.set(k,v);}
  },
  document: { querySelector: node, addEventListener: (type,fn)=>listeners[type]=fn },
  location: {href:'http://127.0.0.1:4173/',hash:'',pathname:'/',search:''},
  history: {replaceState(){}},
  window: {scrollTo(){}},
  setTimeout: ()=>0, clearTimeout(){},
  FormData: class {constructor(form){this.values=form.values;}get(key){return this.values[key];}}
};
const ctx = vm.createContext(sandbox);
vm.runInContext(script, ctx);
const run = code => vm.runInContext(code, ctx);
async function submit(id, values){await listeners.submit({preventDefault(){},target:{id,values}});}
(async()=>{
  assert.match(node('#app').innerHTML, /체험 로그인/);
  run("change(d=>d.logged=true); go('groups');");
  assert.match(node('#app').innerHTML, /우리 가족 탐험대/);
  await submit('trip-form',{name:'부산 여행',date:'2026-10-26',places:'해운대\n광안리'});
  assert.equal(run('trip().places.length'),2);
  assert.equal(run('view'),'invite');
  const tripId = run('tripId');
  await submit('join-form',{alias:'친구'});
  assert.equal(run('view'),'travel');
  const friend = run('db.user');
  assert.equal(run('owner()'),false);
  assert.equal(run('completed()'),0);
  run("capturePlace=trip().places[0].id; photo='data:image/jpeg;base64,dGVzdA=='; view='capture';");
  await submit('capture-form',{feeling:''});
  assert.equal(run('completed()'),1);
  assert.equal(run("completed(trip(),'me')"),0);
  assert.equal(run('trip().records[0].feeling'),'');
  run("photo='data:image/jpeg;base64,dGVzdDI='; view='capture';");
  await submit('capture-form',{feeling:'바다가 좋아'});
  assert.equal(run('trip().records.length'),1);
  assert.equal(run('completed()'),1);
  failStorage=true;
  run("photo='data:image/jpeg;base64,dGVzdDM='; view='capture';");
  await submit('capture-form',{feeling:'저장 실패'});
  assert.equal(run('trip().records[0].feeling'),'바다가 좋아');
  assert.equal(run('view'),'capture');
  failStorage=false;
  run("db.user='me'; view='group';");
  await submit('trip-form',{name:'두 번째 여행',date:'2026-11-01',places:'서울숲'});
  assert.notEqual(run('tripId'),tripId);
  assert.equal(run(`completed(trip(),${JSON.stringify(friend)})`),0);
  assert.equal(run("db.trips.filter(t=>t.group===groupId).length"),3);
  assert.equal(storage.get('gj-family-quest'),'{"existing":"preserved"}');
  assert.equal(storage.get('gj-family-diary-template'),'{"existing":"preserved"}');
  console.log('PASS: syntax, group reuse, course generation, invite, personal completion, optional feeling, duplicate prevention, storage failure, trip isolation, legacy data preservation');
})().catch(error=>{console.error(error);process.exitCode=1;});
