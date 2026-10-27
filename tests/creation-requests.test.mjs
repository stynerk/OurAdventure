import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRequest,readPending,finishRequest} from '../next/creation-requests.mjs';
const makeStore=()=>{const map=new Map([['gj-family-quest','legacy'],['gj-family-diary-template','diary']]);return {map,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const id='request_0123456789';
test('lost-response retries reuse one creation identity; changed input requires resolving the old request',()=>{
  const storage=makeStore(),payload={title:'그룹'};
  const first=prepareRequest(storage,'owner','group','',payload,()=>id);
  assert.deepEqual(prepareRequest(storage,'owner','group','',{...payload},()=>{throw Error('no new id');}),first);
  assert.throws(()=>prepareRequest(storage,'owner','group','',{title:'다른 그룹'},()=>id),/이전 요청 확인/);
  assert.equal(readPending(storage,'owner','group','').requestId,id);
});
test('account, group and creation type are isolated; completing a request never touches legacy data',()=>{
  const storage=makeStore(),pending=prepareRequest(storage,'a','trip','g',{title:'여행'},()=>id);
  for(const [uid,kind,group] of [['b','trip','g'],['a','trip','other'],['a','group','']])assert.equal(readPending(storage,uid,kind,group),null);
  finishRequest(storage,{...pending,requestId:'other_request_01234'});assert.ok(readPending(storage,'a','trip','g'));
  finishRequest(storage,pending);assert.equal(readPending(storage,'a','trip','g'),null);
  assert.equal(storage.map.get('gj-family-quest'),'legacy');assert.equal(storage.map.get('gj-family-diary-template'),'diary');
});
test('storage failure and damaged pending requests block new creation before another ID can be used',()=>{
  assert.throws(()=>prepareRequest({getItem:()=>null,setItem:()=>{throw Error('quota');}},'a','group','',{},()=>id),/quota/);
  const storage=makeStore();prepareRequest(storage,'a','group','',{title:'기존'},()=>id);
  const key=[...storage.map.keys()].find(k=>k.startsWith('oa-v2-'));storage.map.set(key,'broken');
  assert.throws(()=>prepareRequest(storage,'a','group','',{title:'새 그룹'},()=>{throw Error('must not create');}),/생성 요청/);
});
