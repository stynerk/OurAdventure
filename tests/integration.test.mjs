import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,collection,getDocs,query,where} from 'firebase/firestore';
const require=createRequire(import.meta.url);
const {createService}=require('../functions/service.cjs');
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const projectId='demo-our-adventure';
let admin,db,env,service;
const auth=(uid,provider='anonymous')=>({uid,token:{firebase:{sign_in_provider:provider}}});
const owner=auth('leader','google.com'), a=auth('member-a'), b=auth('member-b');
const rejectCode=(promise,code)=>assert.rejects(promise,e=>e.code===code);
const create=mode=>service.createRoom({courseId:'gyeongju-v1',title:'테스트 탐험방',mode},owner);
const join=(room,user=a)=>service.joinRoom({token:room.token,nickname:'같은 별칭',participantCode:'TEST'},user);
before(async()=>{
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Tests must never use production');
  admin=initializeApp({projectId},'test-admin');db=getFirestore(admin);
  env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8085,rules:readFileSync('firestore.rules','utf8')}});
  await env.clearFirestore();service=createService(db,{HttpsError,FieldValue,allowIndividual:true});
});
after(async()=>{await env?.cleanup();await db?.terminate();if(admin)await deleteApp(admin);});
test('Google provider required; client cannot choose another owner or course',async()=>{
  await rejectCode(service.createRoom({title:'x',mode:'shared',courseId:'gyeongju-v1'},a),'permission-denied');
  await rejectCode(service.createRoom({title:'x',mode:'shared',courseId:'invented'},owner),'invalid-argument');
  await rejectCode(service.createRoom({},null),'unauthenticated');
});
test('production default blocks individual pilot and includes owner in the ten-member cap',async()=>{
  const defaults=createService(db,{HttpsError,FieldValue});
  await rejectCode(defaults.createRoom({title:'학교 후속',mode:'individual',courseId:'gyeongju-v1'},owner),'failed-precondition');
  const r=await create('shared');
  assert.equal((await db.doc(`rooms/${r.roomId}`).get()).data().capacity,10);
  for(let i=0;i<8;i++)await join(r,auth(`limit-${i}`));
  const result=await Promise.allSettled([join(r,auth('limit-final-a')),join(r,auth('limit-final-b'))]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((await db.doc(`rooms/${r.roomId}`).get()).data().memberCount,10);
});
test('invite preview reveals only safe room summary, invalid and path-injection inputs fail',async()=>{
  const r=await create('shared'), summary=await service.previewInvite({token:r.token});
  assert.deepEqual(Object.keys(summary).sort(),['mode','questCount','roomId','title']);
  assert.equal(summary.questCount,9);
  await rejectCode(service.previewInvite({token:'wrong'}),'invalid-argument');
  await rejectCode(service.completeQuest({roomId:'../../rooms/x',questId:'museum'},a),'invalid-argument');
});
test('joining twice preserves role, nickname, progress and unique member count',async()=>{
  const r=await create('individual');await join(r);await join(r);
  await service.completeQuest({roomId:r.roomId,questId:'museum'},a);
  await service.joinRoom({token:r.token,nickname:'overwritten'},a);
  await service.joinRoom({token:r.token,nickname:'owner overwrite'},owner);
  const room=(await db.doc(`rooms/${r.roomId}`).get()).data();
  const member=(await db.doc(`rooms/${r.roomId}/members/member-a`).get()).data();
  assert.equal(room.memberCount,2);assert.equal(member.displayName,'같은 별칭');assert.deepEqual(member.done,['museum']);
  assert.equal((await db.doc(`rooms/${r.roomId}/members/leader`).get()).data().role,'owner');
});
test('shared concurrent completion yields one stamp and one audit event',async()=>{
  const r=await create('shared');await join(r,a);await join(r,b);
  await Promise.all([a,b,a,b].map(u=>service.completeQuest({roomId:r.roomId,questId:'museum'},u)));
  assert.deepEqual((await db.doc(`rooms/${r.roomId}`).get()).data().sharedDone,['museum']);
  const events=await db.collection(`rooms/${r.roomId}/activity`).where('type','==','quest-completed').get();
  assert.equal(events.size,1);
  await rejectCode(service.submit({roomId:r.roomId},a),'failed-precondition');
});
test('individual progress isolated, server rejects early submission and deduplicates final submit',async()=>{
  const r=await create('individual');await join(r,a);await join(r,b);
  await service.completeQuest({roomId:r.roomId,questId:'museum',uid:b.uid},a);
  assert.deepEqual((await db.doc(`rooms/${r.roomId}/members/member-b`).get()).data().done,[]);
  await rejectCode(service.submit({roomId:r.roomId},a),'failed-precondition');
  await rejectCode(service.completeQuest({roomId:r.roomId,questId:'fake'},a),'invalid-argument');
  const {questIds}=(await db.doc(`rooms/${r.roomId}`).get()).data();
  for(const questId of questIds)await service.completeQuest({roomId:r.roomId,questId},a);
  await Promise.all([service.submit({roomId:r.roomId},a),service.submit({roomId:r.roomId},a)]);
  assert.ok((await db.doc(`rooms/${r.roomId}/members/member-a`).get()).data().submittedAt);
  assert.equal((await db.collection(`rooms/${r.roomId}/activity`).where('type','==','submitted').get()).size,1);
});
test('only owner rotates invites; old invite revoked without removing existing members',async()=>{
  const r=await create('shared');await join(r);
  await rejectCode(service.rotateInvite({roomId:r.roomId},a),'permission-denied');
  const next=await service.rotateInvite({roomId:r.roomId},owner);
  await rejectCode(service.previewInvite({token:r.token}),'not-found');
  await rejectCode(join(r,b),'not-found');
  await join({...r,token:next.token},b);
  await service.completeQuest({roomId:r.roomId,questId:'museum'},a);
});
test('room closure blocks all future progress, submissions, joins, and rotation; close is idempotent',async()=>{
  const r=await create('individual');await join(r);
  await rejectCode(service.closeRoom({roomId:r.roomId},a),'permission-denied');
  await service.closeRoom({roomId:r.roomId},owner);await service.closeRoom({roomId:r.roomId},owner);
  await rejectCode(service.completeQuest({roomId:r.roomId,questId:'museum'},a),'failed-precondition');
  await rejectCode(service.submit({roomId:r.roomId},a),'failed-precondition');
  await rejectCode(join(r,b),'failed-precondition');
  await rejectCode(service.rotateInvite({roomId:r.roomId},owner),'failed-precondition');
  await rejectCode(service.previewInvite({token:r.token}),'failed-precondition');
});
test('capacity enforced transactionally and empty or excessive nickname rejected',async()=>{
  const r=await create('shared');await db.doc(`rooms/${r.roomId}`).update({capacity:2});
  const results=await Promise.allSettled([join(r,a),join(r,b)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((await db.doc(`rooms/${r.roomId}`).get()).data().memberCount,2);
  await rejectCode(service.joinRoom({token:r.token,nickname:' '},a),'invalid-argument');
  await rejectCode(service.joinRoom({token:r.token,nickname:'x'.repeat(25)},a),'invalid-argument');
});
test('nonmembers cannot mutate or manage any known room ID',async()=>{
  const r=await create('shared');
  for(const name of ['completeQuest','submit','closeRoom','rotateInvite'])await rejectCode(service[name]({roomId:r.roomId,questId:'museum'},a),'permission-denied');
});
test('Firestore rules deny unauthenticated, nonmember, peer, invite and all direct writes',async()=>{
  const r=await create('individual');await join(r,a);await join(r,b);
  const guest=env.unauthenticatedContext().firestore(), outsider=env.authenticatedContext('outsider').firestore();
  const member=env.authenticatedContext(a.uid).firestore(), leader=env.authenticatedContext(owner.uid).firestore();
  const roomPath=`rooms/${r.roomId}`, ownPath=`${roomPath}/members/${a.uid}`;
  await assertFails(getDoc(doc(guest,roomPath)));await assertFails(getDoc(doc(outsider,roomPath)));
  await assertSucceeds(getDoc(doc(member,roomPath)));await assertSucceeds(getDoc(doc(member,ownPath)));
  await assertFails(getDoc(doc(member,`${roomPath}/members/${b.uid}`)));
  await assertFails(getDocs(collection(member,`${roomPath}/members`)));
  await assertSucceeds(getDocs(collection(leader,`${roomPath}/members`)));
  await assertSucceeds(getDocs(query(collection(leader,'rooms'),where('ownerId','==',owner.uid))));
  await assertFails(getDocs(collection(member,'rooms')));
  await assertFails(updateDoc(doc(member,ownPath),{role:'owner',done:['museum']}));
  await assertFails(updateDoc(doc(leader,roomPath),{status:'open',ownerId:a.uid}));
  await assertFails(setDoc(doc(member,'rooms/injected'),{ownerId:a.uid}));
  await assertFails(getDocs(collection(leader,'invites')));
  await assertFails(getDoc(doc(leader,`roomSecrets/${r.roomId}`)));
  await assertFails(getDocs(collection(member,`${roomPath}/activity`)));
});
