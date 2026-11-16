const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateCourse, validateCourse, createServer } = require('./ai-course.cjs');
const sample = {title:'부산 산책',places:[{name:'해운대',day:1,reason:'바다 산책',icon:'🌊'}]};
const output = value => ({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})});
test('real provider request uses structured output; records never enter generation', async()=>{
  let sent;
  const result=await generateCourse({destination:' 부산 ',days:1,records:['private']},{apiKey:'test-only',model:'test-model',fetchImpl:async(url,request)=>{sent=JSON.parse(request.body);assert.equal(url,'https://api.openai.com/v1/responses');return output(sample);}});
  assert.deepEqual(JSON.parse(sent.input),{destination:'부산',days:1});
  assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);
  assert.equal(result.source,'ai');assert.equal(result.verified,false);
  assert.equal(result.destination,'부산');assert.equal(result.records,undefined);
});
test('missing key is explicit and does not return fake AI results',async()=>{
  await assert.rejects(generateCourse({destination:'부산'},{apiKey:''}),e=>e.status===503);
});
test('model must be selected explicitly before any paid provider request',async()=>{
  await assert.rejects(generateCourse({destination:'부산'},{apiKey:'test',model:'',fetchImpl:()=>{throw Error('must not call');}}),e=>e.status===503);
});
test('invalid destination and period do not call provider',async()=>{
  for(const body of [{destination:''},{destination:'부산',days:8},{destination:'부산',days:1.5}])
    await assert.rejects(generateCourse(body,{apiKey:'test',fetchImpl:()=>{throw Error('must not call');}}),e=>e.status===400);
});
test('duplicate and invalid places are rejected',()=>{
  assert.throws(()=>validateCourse({...sample,places:[...sample.places,...sample.places]},1),e=>e.status===502);
  assert.throws(()=>validateCourse({...sample,places:[{...sample.places[0],day:2}]},1),e=>e.status===502);
  assert.throws(()=>validateCourse({...sample,places:[]},1),e=>e.status===502);
});
test('provider timeout, refusal, incomplete and rate limit are explained',async()=>{
  await assert.rejects(generateCourse({destination:'부산'},{apiKey:'test',model:'test-model',fetchImpl:async()=>{throw Error('timeout');}}),e=>e.status===504);
  for(const result of [{status:'incomplete'},{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}])
    await assert.rejects(generateCourse({destination:'부산'},{apiKey:'test',model:'test-model',fetchImpl:async()=>({ok:true,json:async()=>result})}),e=>e.status===502);
  await assert.rejects(generateCourse({destination:'부산'},{apiKey:'test',model:'test-model',fetchImpl:async()=>({ok:false,status:429})}),e=>e.status===429);
});
test('local HTTP API blocks external origins and reports missing AI configuration',async()=>{
  const server=createServer({apiKey:''});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  try {
    const headers={'content-type':'application/json',origin:'https://external.invalid'};
    assert.equal((await fetch(url+'/api/courses/generate',{method:'POST',headers,body:'{}'})).status,403);
    headers.origin=url;
    const response=await fetch(url+'/api/courses/generate',{method:'POST',headers,body:JSON.stringify({destination:'부산'})});
    assert.equal(response.status,503);assert.match((await response.json()).error,/AI 연결 설정/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('development page JavaScript parses',()=>{
  const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'course.html'),'utf8');
  new (require('node:vm').Script)(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
