import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,getDocs,query,collection,where} from 'firebase/firestore';
const require=createRequire(import.meta.url);
const {createGroupService}=require('../functions/group-service.cjs');
class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
const projectId='demo-our-adventure-v2';
const auth=(uid,provider='anonymous')=>({uid,token:{firebase:{sign_in_provider:provider}}});
const owner=auth('v2-owner','google.com'),a=auth('v2-a'),b=auth('v2-b'),outsider=auth('v2-outside');
let app,db,env,service;
const reject=(promise,code)=>assert.rejects(promise,e=>e.code===code);
const group=()=>service.callables.createGroup({title:'테스트 그룹',requestId:randomUUID()},owner);
const trip=(g,changes={})=>service.callables.createTrip({groupId:g,requestId:randomUUID(),title:'새 여행',destination:'경주',startDate:'2026-10-27',endDate:'2026-10-28',places:[{name:'대릉원'},{name:'첨성대'}],...changes},owner);
// T6 invite flow is not implemented here; membership is a trusted test fixture.
async function member(g,user) {
  await db.runTransaction(async tx=>{
    const ref=db.doc(`groups/${g}`),snap=await tx.get(ref);
    tx.create(ref.collection('members').doc(user.uid),{role:'member',displayName:'같은 별칭',joinedAt:FieldValue.serverTimestamp()});
    tx.update(ref,{memberIds:[...snap.data().memberIds,user.uid],memberCount:snap.data().memberCount+1});
  });
}
async function publish(g,t,p,user=a,changes={}) {
  return service.finalizeVerifiedPost({groupId:g,tripId:t,placeId:p,requestId:randomUUID(),uploadId:randomUUID(),feeling:'',...changes},user);
}
async function places(g,t){return (await db.doc(`groups/${g}/trips/${t}`).get()).data().placeIds;}
before(async()=>{
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Production must never be used');
  app=initializeApp({projectId},'v2-model-admin');db=getFirestore(app);
  env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8085,rules:readFileSync('firestore.rules','utf8')}});
  await env.clearFirestore();
  service=createGroupService(db,{HttpsError,FieldValue,verifyPhoto:async({groupId,tripId,uid,uploadId})=>({
    objectPath:`groups/${groupId}/trips/${tripId}/uploads/${uid}/${uploadId}.jpg`,contentType:'image/jpeg',size:100
  })});
});
after(async()=>{await env?.cleanup();await db?.terminate();if(app)await deleteApp(app);});

test('only Google auth can create groups and trips; client ownership is ignored',async()=>{
  await reject(service.callables.createGroup({title:'그룹',requestId:randomUUID()},a),'permission-denied');
  const g=await service.callables.createGroup({title:'그룹',requestId:randomUUID(),ownerId:outsider.uid,memberIds:[outsider.uid]},owner);
  const saved=(await db.doc(`groups/${g.groupId}`).get()).data();
  assert.equal(saved.ownerId,owner.uid);assert.deepEqual(saved.memberIds,[owner.uid]);assert.equal(saved.memberCount,1);assert.equal(saved.capacity,10);
  await reject(service.callables.createTrip({groupId:g.groupId},a),'permission-denied');
});
test('concurrent group retries are idempotent; request ID cannot change its content',async()=>{
  const data={title:'한 그룹',requestId:randomUUID()};
  const rows=await Promise.all(Array.from({length:4},()=>service.callables.createGroup(data,owner)));
  assert.equal(new Set(rows.map(x=>x.groupId)).size,1);
  assert.equal(rows.filter(x=>!x.replayed).length,1);
  await reject(service.callables.createGroup({...data,title:'다른 그룹'},owner),'failed-precondition');
});
test('group is reusable; new trips have no posts or completions and can have zero places',async()=>{
  const g=(await group()).groupId;await member(g,a);
  const first=(await trip(g)).tripId,p=(await places(g,first))[0];await publish(g,first,p);
  const second=(await trip(g,{places:[]})).tripId;
  assert.notEqual(first,second);
  const saved=(await db.doc(`groups/${g}/trips/${second}`).get()).data();
  assert.equal(saved.postCount,0);assert.equal(saved.placeCount,0);assert.deepEqual(saved.placeIds,[]);
  for(const name of ['posts','completions'])assert.equal((await db.collection(`groups/${g}/trips/${second}/${name}`).get()).size,0);
  assert.equal((await db.doc(`groups/${g}/members/${a.uid}`).get()).exists,true);
  assert.equal((await db.collection(`groups/${g}/trips/${first}/posts`).get()).size,1);
});
test('concurrent trip creation keeps one trip and preserves retry content identity',async()=>{
  const g=(await group()).groupId,requestId=randomUUID();
  const rows=await Promise.all(Array.from({length:4},()=>trip(g,{requestId})));
  assert.equal(new Set(rows.map(x=>x.tripId)).size,1);
  assert.equal((await db.collection(`groups/${g}/trips`).get()).size,1);
  await reject(trip(g,{requestId,title:'변경'}),'failed-precondition');
});
test('same nickname does not share completion; trips and groups are isolated',async()=>{
  const g=(await group()).groupId;await member(g,a);await member(g,b);
  const t=(await trip(g)).tripId,p=(await places(g,t))[0];
  await publish(g,t,p,a,{uid:b.uid,completed:true});
  const done=await db.collection(`groups/${g}/trips/${t}/completions`).get();
  assert.equal(done.size,1);assert.equal(done.docs[0].data().uid,a.uid);
  const other=(await trip(g)).tripId;
  await reject(publish(g,other,p,a),'invalid-argument');
  const otherGroup=(await group()).groupId;
  await reject(publish(otherGroup,(await trip(otherGroup)).tripId,p,a),'permission-denied');
});
test('same request and same photo cannot duplicate completion or photo counts',async()=>{
  const g=(await group()).groupId;await member(g,a);
  const t=(await trip(g)).tripId,p=(await places(g,t))[0],requestId=randomUUID(),uploadId=randomUUID();
  const rows=await Promise.all(Array.from({length:4},()=>publish(g,t,p,a,{requestId,uploadId})));
  assert.equal(new Set(rows.map(x=>x.postId)).size,1);
  let done=(await db.collection(`groups/${g}/trips/${t}/completions`).get()).docs[0].data();
  assert.equal(done.photoCount,1);
  await reject(publish(g,t,p,a,{uploadId}),'already-exists');
  await publish(g,t,p,a);
  const completions=await db.collection(`groups/${g}/trips/${t}/completions`).get();
  assert.equal(completions.size,1);assert.equal(completions.docs[0].data().photoCount,2);
});
test('free photos are posts but never create a stamp; feeling may be omitted',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g,{places:[]})).tripId;
  const result=await publish(g,t,null,a,{feeling:undefined});
  assert.equal(result.completed,false);
  assert.equal((await db.collection(`groups/${g}/trips/${t}/completions`).get()).size,0);
  assert.equal((await db.doc(`groups/${g}/trips/${t}/posts/${result.postId}`).get()).data().feeling,'');
});
test('photo verifier failure or missing media never changes posts and completion',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId,p=(await places(g,t))[0];
  const blocked=createGroupService(db,{HttpsError,FieldValue});
  await reject(blocked.finalizeVerifiedPost({groupId:g,tripId:t,placeId:p,requestId:randomUUID(),verified:true},a),'failed-precondition');
  const invalid=createGroupService(db,{HttpsError,FieldValue,verifyPhoto:async()=>({objectPath:'groups/wrong/photo.jpg',contentType:'image/jpeg',size:1})});
  await reject(invalid.finalizeVerifiedPost({groupId:g,tripId:t,placeId:p,requestId:randomUUID()},a),'failed-precondition');
  assert.equal((await db.doc(`groups/${g}/trips/${t}`).get()).data().postCount,0);
  assert.equal((await db.collection(`groups/${g}/trips/${t}/completions`).get()).size,0);
});
test('adding a place preserves prior individual completion and is retry safe',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId,p=(await places(g,t))[0];await publish(g,t,p);
  const data={groupId:g,tripId:t,requestId:randomUUID(),place:{name:'월정교'}};
  const rows=await Promise.all([service.callables.addTripPlace(data,owner),service.callables.addTripPlace(data,owner)]);
  assert.equal(rows[0].placeId,rows[1].placeId);assert.equal((await places(g,t)).length,3);
  assert.equal((await db.collection(`groups/${g}/trips/${t}/completions`).get()).size,1);
  await reject(service.callables.addTripPlace({...data,requestId:randomUUID()},a),'permission-denied');
});
test('closed trip remains readable but cannot accept new places or photos',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId,p=(await places(g,t))[0];
  const prior=await publish(g,t,p,a,{requestId:'closed_retry_012345',uploadId:'closed-photo'});
  await db.doc(`groups/${g}/trips/${t}`).update({status:'closed',closedAt:FieldValue.serverTimestamp()});
  await reject(publish(g,t,p),'failed-precondition');
  await reject(service.callables.addTripPlace({groupId:g,tripId:t,requestId:randomUUID(),place:{name:'새 장소'}},owner),'failed-precondition');
  const retry=await publish(g,t,p,a,{requestId:'closed_retry_012345',uploadId:'closed-photo'});
  assert.equal(retry.postId,prior.postId);
  await assertSucceeds(getDoc(doc(env.authenticatedContext(a.uid).firestore(),`groups/${g}/trips/${t}`)));
});
test('rules deny outsiders, role escalation, completion forgery and peer post mutation',async()=>{
  const g=(await group()).groupId;await member(g,a);await member(g,b);const t=(await trip(g)).tripId,p=(await places(g,t))[0];
  const record=await publish(g,t,p,a),path=`groups/${g}/trips/${t}`;
  const memberDb=env.authenticatedContext(b.uid).firestore(),leaderDb=env.authenticatedContext(owner.uid).firestore();
  const strangerDb=env.authenticatedContext(outsider.uid).firestore(),guestDb=env.unauthenticatedContext().firestore();
  for(const client of [strangerDb,guestDb]) {
    for(const target of [`groups/${g}`,path,`${path}/places/${p}`,`${path}/posts/${record.postId}`])await assertFails(getDoc(doc(client,target)));
  }
  await assertSucceeds(getDoc(doc(memberDb,`${path}/posts/${record.postId}`)));
  await assertFails(updateDoc(doc(memberDb,`${path}/posts/${record.postId}`),{feeling:'타인 기록 수정'}));
  await assertFails(updateDoc(doc(leaderDb,`${path}/posts/${record.postId}`),{feeling:'리더도 수정 불가'}));
  await assertFails(updateDoc(doc(memberDb,`groups/${g}/members/${b.uid}`),{role:'owner'}));
  await assertFails(setDoc(doc(memberDb,`${path}/completions/forged`),{uid:b.uid,placeId:p}));
  await assertFails(setDoc(doc(leaderDb,'groups/forged'),{ownerId:owner.uid,memberIds:[owner.uid]}));
  await assertFails(getDocs(collection(leaderDb,'v2Requests')));
  await assertFails(getDocs(collection(leaderDb,'v2MediaClaims')));
  await assertSucceeds(getDocs(query(collection(memberDb,'groups'),where('memberIds','array-contains',b.uid))));
  await assertFails(getDocs(collection(memberDb,'groups')));
});
test('only published posts are readable and membership loss also removes old-trip access',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId,path=`groups/${g}/trips/${t}`;
  await db.doc(`${path}/posts/draft`).set({uid:a.uid,status:'uploading'});
  const memberDb=env.authenticatedContext(a.uid).firestore();
  await assertFails(getDoc(doc(memberDb,`${path}/posts/draft`)));
  await assertSucceeds(getDocs(query(collection(memberDb,`${path}/posts`),where('status','==','published'))));
  await db.doc(`groups/${g}/members/${a.uid}`).delete();
  await assertFails(getDoc(doc(memberDb,path)));
  await reject(publish(g,t,null,a),'permission-denied');
});
