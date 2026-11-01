import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {parseItinerary,groupItinerary} from '../next/itinerary-editor.mjs';
const require=createRequire(import.meta.url),{normalizeStop}=require('../functions/itinerary.cjs'),{analyzeDocument,lookupPlace}=require('../functions/itinerary-analysis.cjs');
const trip={startDate:'2026-11-01',endDate:'2026-11-03'};
test('pasted timetable preserves days, times, order and uncertain time warning',()=>{
 const parsed=parseItinerary('1일차\n13:35~14:10 부산역 | 짐 보관\n16:00~16:00 흰여울문화마을\n2일차\n09:00 해동용궁사\n3일차\n10:00 부산역 카페',trip);
 assert.equal(parsed.entries.length,4);assert.deepEqual(parsed.entries.map(p=>p.day),[1,1,2,3]);assert.equal(parsed.entries[0].startTime,'13:35');assert.equal(parsed.entries[0].endTime,'14:10');assert.equal(parsed.entries[1].endTime,'');assert.ok(parsed.warnings.some(w=>w.includes('종료 시간')));
});
test('CSV quoted commas, nested JSON and legacy unscheduled places are preserved',()=>{
 const csv=parseItinerary('일차,시작,장소,메모\n2,09:00,"바다, 카페","아침, 휴식"',trip);assert.equal(csv.entries[0].name,'바다, 카페');assert.equal(csv.entries[0].day,2);
 assert.equal(parseItinerary('{"days":[{"day":3,"places":[{"name":"부산역"}]}]}',trip).entries[0].day,3);
 const days=groupItinerary([{id:'old',name:'기존 장소'},{id:'unknown',name:'일정 미정',day:null},{id:'new',name:'새 장소',day:2,startTime:'10:00'}],trip);
 assert.equal(days.length,4);assert.equal(days[0].label,'1일차 · 11/01');assert.equal(days[1].label,'2일차 · 11/02');assert.equal(days.at(-1).day,null);assert.equal(days[1].places[0].id,'new');assert.equal(days[0].places[0].id,'old');assert.equal(days.at(-1).places[0].id,'unknown');
});
test('server rejects out-of-range days and invalid times without silently correcting them',()=>{
 for(const p of [{day:4},{day:-1},{day:1.5},{startTime:'25:00'},{startTime:'16:00',endTime:'16:00'}])assert.throws(()=>normalizeStop({name:'장소',...p},trip));
 assert.equal(normalizeStop({name:'장소',sourceUrl:'https://evil.test'},trip).sourceUrl,'');
 assert.equal(normalizeStop({name:'장소',day:3,description:'설명'},trip).description,'설명');
 assert.throws(()=>parseItinerary(Array(61).fill('장소').join('\n'),trip),/60/);
});
test('AI import refuses missing configuration, sends PDF through bounded non-storing file input and validates result',async()=>{
 await assert.rejects(analyzeDocument({text:'일정'},{apiKey:'',model:''}),e=>e.code==='failed-precondition');
 let body;const output={entries:[{name:'해운대',day:2,startTime:'09:00',endTime:'10:00'}],warnings:[],...trip};
 const r=await analyzeDocument({text:'',...trip,file:{name:'trip.pdf',type:'application/pdf',base64:Buffer.from('%PDF-test').toString('base64')}},{apiKey:'test-only',model:'test-vision-model',fetchImpl:async(_url,o)=>{body=JSON.parse(o.body);return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]})};}});
 assert.equal(body.store,false);assert.equal(body.input[0].content[1].type,'input_file');assert.equal(r.entries[0].day,2);
 await assert.rejects(analyzeDocument({text:'x'},{apiKey:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[]})})}));
});
test('place introduction only uses matching Google Places results and reference content is not stored as editable description',async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({places:[{id:'test-place-id',displayName:{text:'부산역'},editorialSummary:{text:'부산역 설명'},googleMapsUri:'https://maps.google.com/maps?cid=123'}]})});
 const result=await lookupPlace('부산역','부산',{apiKey:'test',fetchImpl});assert.equal(result.referenceSummary,'부산역 설명');assert.equal(result.description,undefined);assert.equal(result.placeId,'test-place-id');
 assert.equal((await lookupPlace('숙소 미정','부산',{apiKey:'test',fetchImpl})).state,'not-found');
 assert.equal((await lookupPlace('부산역','부산',{apiKey:'',fetchImpl})).state,'unconfigured');
});
