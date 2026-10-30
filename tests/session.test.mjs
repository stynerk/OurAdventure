import test from 'node:test';
import assert from 'node:assert/strict';
import {readRoomIds,rememberRoom,readCreateRequest,getCreateRequest,clearCreateRequest,loadAccessibleRooms,createServerReads} from '../next/session.mjs';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const payload={title:' 우리 가족 ',mode:'shared',courseId:'gyeongju-v1'};
test('hung server reads reconnect once and finish without page reload',async()=>{
  let calls=0,reconnects=0;
  const read=async ref=>++calls===1?new Promise(()=>{}):{id:ref,confirmed:true};
  const api=createServerReads({getDocFromServer:read,getDocsFromServer:read,reconnect:async()=>{reconnects++;},timeoutMs:10});
  assert.deepEqual(await api.getDocFromServer('trip'),{id:'trip',confirmed:true});
  assert.equal(calls,2);assert.equal(reconnects,1);
});
test('concurrent stalled reads share recovery and permission denials are not retried',async()=>{
  let recovered=false,reconnects=0;
  const read=ref=>recovered?Promise.resolve(ref):new Promise(()=>{});
  const api=createServerReads({getDocFromServer:read,getDocsFromServer:read,reconnect:async()=>{reconnects++;await new Promise(r=>setTimeout(r,5));recovered=true;},timeoutMs:20});
  assert.deepEqual(await Promise.all([api.getDocFromServer('group'),api.getDocsFromServer('members')]),['group','members']);assert.equal(reconnects,1);
  const denied=Object.assign(new Error('denied'),{code:'permission-denied'});
  const blocked=createServerReads({getDocFromServer:async()=>{throw denied;},reconnect:async()=>{throw Error('must not reconnect');}});
  await assert.rejects(blocked.getDocFromServer('private'),e=>e===denied);
});
test('persistent read or reconnect stalls reject instead of leaving loading indefinitely',async()=>{
  for(const reconnect of [async()=>{},()=>new Promise(()=>{})]){
    const api=createServerReads({getDocsFromServer:()=>new Promise(()=>{}),reconnect,timeoutMs:10});
    await assert.rejects(api.getDocsFromServer('trips'),{code:'app/read-timeout'});
  }
});
test('creation retries and a refreshed caller reuse the retained request identity',()=>{
  const s=storage();let generated=0;
  const make=()=>`request-${String(++generated).padStart(16,'0')}`;
  const first=getCreateRequest(s,'alice',payload,make);
  assert.equal(first.title,'우리 가족');
  assert.deepEqual(getCreateRequest(s,'alice',{...payload},make),first);
  assert.deepEqual(readCreateRequest(s,'alice'),first);assert.equal(generated,1);
  assert.throws(()=>getCreateRequest(s,'alice',{...payload,title:'다른 여행'},make),/원래 이름/);
  clearCreateRequest(s,'alice','different-request');assert.deepEqual(readCreateRequest(s,'alice'),first);
  clearCreateRequest(s,'alice',first.requestId);assert.equal(readCreateRequest(s,'alice'),null);
  assert.notEqual(getCreateRequest(s,'alice',payload,make).requestId,first.requestId);
});
test('room hints and pending requests are isolated by uid and never touch legacy keys',()=>{
  const s=storage();s.setItem('gj-family-quest','legacy-photo');s.setItem('gj-family-diary-template','legacy-diary');
  rememberRoom(s,'alice','room-a');rememberRoom(s,'alice','room-a');rememberRoom(s,'bob','room-b');
  rememberRoom(s,'alice','../../injected');
  assert.deepEqual(readRoomIds(s,'alice'),['room-a']);assert.deepEqual(readRoomIds(s,'bob'),['room-b']);
  assert.deepEqual(readRoomIds(s,null),[]);
  getCreateRequest(s,'alice',payload,()=> 'request-1234567890');assert.equal(readCreateRequest(s,'bob'),null);
  assert.equal(s.getItem('gj-family-quest'),'legacy-photo');assert.equal(s.getItem('gj-family-diary-template'),'legacy-diary');
});
test('storage failure blocks creation before a retry identity can be lost',()=>{
  const denied={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('quota');}};
  assert.deepEqual(readRoomIds(denied,'alice'),[]);assert.equal(rememberRoom(denied,'alice','room-a'),false);
  assert.throws(()=>getCreateRequest(denied,'alice',payload,()=> 'request-1234567890'),/quota/);
});
test('malformed local hints are rejected and unavailable memberships never produce a room card',async()=>{
  const s=storage();s.setItem('oa-next-rooms-v1:alice','{"bad":true}');assert.deepEqual(readRoomIds(s,'alice'),[]);
  s.setItem('oa-next-rooms-v1:alice','["good","../bad","good",null]');assert.deepEqual(readRoomIds(s,'alice'),['good']);
  const seen=[];
  const result=await loadAccessibleRooms(['good','denied','missing','good','../bad'],async id=>{
    seen.push(id);if(id==='denied')throw Error('permission-denied');
    return id==='missing'?null:{id,title:'검증된 여행'};
  });
  assert.deepEqual(seen,['good','denied','missing']);assert.deepEqual(result.rooms,[{id:'good',title:'검증된 여행'}]);assert.equal(result.failed,1);
});
