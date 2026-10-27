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
class HttpsError extends Error {constructor(code,message,details){super(message);this.code=code;this.details=details;}}
const projectId='demo-our-adventure-v2';
const auth=(uid,provider='anonymous')=>({uid,token:{firebase:{sign_in_provider:provider}}});
const owner=auth('v2-owner','google.com'),a=auth('v2-a'),b=auth('v2-b'),outsider=auth('v2-outside');
let app,db,env,service;
const reject=(promise,code)=>assert.rejects(promise,e=>e.code===code);
const group=()=>service.callables.createGroup({title:'테스트 그룹',requestId:randomUUID()},owner);
const trip=(g,changes={})=>service.callables.createTrip({groupId:g,requestId:randomUUID(),title:'새 여행',destination:'경주',startDate:'2026-10-27',endDate:'2026-10-28',places:[{name:'대릉원'},{name:'첨성대'}],...changes},owner);
// Independent T2 photo tests use a trusted fixture. T6 tests below use actual invite callables.
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

test('AC-3a: two simultaneous joins at nine members commit exactly one final seat',async()=>{
  const g=(await group()).groupId,{token}=await service.callables.createGroupInvite({groupId:g},owner);
  for(let i=0;i<8;i++)await service.callables.joinGroup({token,nickname:'멤버'},auth(`seat-${i}`));
  const contenders=[auth('seat-a'),auth('seat-b')];
  const results=await Promise.allSettled(contenders.map(user=>service.callables.joinGroup({token,nickname:'마지막 자리'},user)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const failure=results.find(r=>r.status==='rejected').reason;assert.equal(failure.code,'resource-exhausted');
  const saved=(await db.doc(`groups/${g}`).get()).data();
  assert.equal(saved.memberCount,10);assert.equal(saved.memberIds.length,10);assert.equal(new Set(saved.memberIds).size,10);
  assert.equal((await db.collection(`groups/${g}/members`).get()).size,10);
  const loser=contenders[results.findIndex(r=>r.status==='rejected')];
  assert.deepEqual(await service.callables.previewGroupInvite({token},loser),{state:'full'});
  await assertFails(getDoc(doc(env.authenticatedContext(loser.uid).firestore(),`groups/${g}`)));
});

test('AC-3b: concurrent duplicate reentry never increases membership or overwrites nickname, even when full',async()=>{
  const g=(await group()).groupId,{token}=await service.callables.createGroupInvite({groupId:g},owner),user=auth('returning-member');
  const results=await Promise.all(Array.from({length:5},()=>service.callables.joinGroup({token,nickname:'처음 별칭'},user)));
  assert.equal(results.filter(r=>!r.replayed).length,1);
  assert.equal((await db.doc(`groups/${g}`).get()).data().memberCount,2);
  for(let i=0;i<8;i++)await service.callables.joinGroup({token,nickname:'처음 별칭'},auth(`reentry-seat-${i}`));
  assert.deepEqual(await service.callables.previewGroupInvite({token},user),{state:'member',groupId:g});
  const retry=await service.callables.joinGroup({token,nickname:'바뀐 별칭',uid:outsider.uid,role:'owner'},user);
  assert.deepEqual(retry,{groupId:g,replayed:true});
  assert.equal((await db.doc(`groups/${g}`).get()).data().memberCount,10);
  assert.equal((await db.doc(`groups/${g}/members/${user.uid}`).get()).data().displayName,'처음 별칭');
  assert.equal((await db.doc(`groups/${g}/members/${user.uid}`).get()).data().role,'member');
});

test('AC-3c: invalid and full links reveal only state; raw invite and group secrets cannot be read or forged',async()=>{
  const g=(await group()).groupId,{token}=await service.callables.createGroupInvite({groupId:g},owner);
  assert.deepEqual(await service.callables.previewGroupInvite({token},a),{state:'ready',title:'테스트 그룹'});
  for(const invalid of ['',null,'../secret','x'.repeat(43),g]){
    assert.deepEqual(await service.callables.previewGroupInvite({token:invalid},outsider),{state:'invalid'});
    await reject(service.callables.joinGroup({token:invalid,nickname:'별칭'},outsider),'not-found');
  }
  const ownerDb=env.authenticatedContext(owner.uid).firestore();
  for(const name of ['v2Invites','v2GroupSecrets']){
    await assertFails(getDocs(collection(ownerDb,name)));
    await assertFails(setDoc(doc(ownerDb,`${name}/forged`),{groupId:g}));
  }
  await assertFails(getDoc(doc(ownerDb,`v2GroupSecrets/${g}`)));
  const invites=await db.collection('v2Invites').where('groupId','==',g).get();
  assert.equal(invites.size,1);assert.equal(JSON.stringify(invites.docs[0].data()).includes(token),false);
  await assertFails(getDoc(doc(ownerDb,`v2Invites/${invites.docs[0].id}`)));
});

test('only leader can regenerate links; old links are invalidated without removing members or old-trip access',async()=>{
  const g=(await group()).groupId,first=await service.callables.createGroupInvite({groupId:g},owner);
  await service.callables.joinGroup({token:first.token,nickname:'같은 별칭'},a);
  const t=(await trip(g)).tripId;
  await reject(service.callables.createGroupInvite({groupId:g},a),'permission-denied');
  await reject(service.callables.createGroupInvite({groupId:g},auth('other-leader','google.com')),'permission-denied');
  const second=await service.callables.createGroupInvite({groupId:g},owner);assert.notEqual(first.token,second.token);
  assert.deepEqual(await service.callables.previewGroupInvite({token:first.token},outsider),{state:'invalid'});
  await reject(service.callables.joinGroup({token:first.token,nickname:'별칭'},outsider),'not-found');
  assert.deepEqual(await service.callables.previewGroupInvite({token:second.token},a),{state:'member',groupId:g});
  await service.callables.joinGroup({token:second.token,nickname:'같은 별칭',groupId:'forged',ownerId:b.uid},b);
  const saved=(await db.doc(`groups/${g}`).get()).data();assert.equal(saved.memberCount,3);assert.equal(saved.ownerId,owner.uid);
  const memberDb=env.authenticatedContext(a.uid).firestore();
  await assertSucceeds(getDoc(doc(memberDb,`groups/${g}/trips/${t}`)));
  await assertSucceeds(getDocs(query(collection(memberDb,'groups'),where('memberIds','array-contains',a.uid))));
  const next=(await trip(g,{title:'다음 여행'})).tripId;
  await assertSucceeds(getDoc(doc(memberDb,`groups/${g}/trips/${next}`)));
});

test('AC-6a: endTrip rejects members and outsiders, and leader retries preserve one server closure',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId;
  for(const user of [a,auth('unrelated-leader','google.com')])await reject(service.callables.endTrip({groupId:g,tripId:t,ownerId:user.uid},user),'permission-denied');
  await reject(service.callables.endTrip({groupId:g,tripId:t},null),'unauthenticated');
  assert.equal((await db.doc(`groups/${g}/trips/${t}`).get()).data().status,'open');
  const results=await Promise.all(Array.from({length:3},()=>service.callables.endTrip({groupId:g,tripId:t,closedBy:a.uid},owner)));
  assert.equal(results.filter(r=>!r.replayed).length,1);
  const closed=(await db.doc(`groups/${g}/trips/${t}`).get()).data();
  assert.equal(closed.status,'closed');assert.equal(closed.closedBy,owner.uid);assert.ok(closed.closedAt?.seconds);
  await service.callables.endTrip({groupId:g,tripId:t},owner);
  assert.equal((await db.doc(`groups/${g}/trips/${t}`).get()).data().closedAt.toMillis(),closed.closedAt.toMillis());
  await reject(service.callables.endTrip({groupId:g,tripId:t},a),'permission-denied');
});

test('ended trip rejects new leader/member photo finalization, place writes and direct completion/reopen attempts while preserving reads',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId,p=(await places(g,t))[0];
  const original=await publish(g,t,p);await service.callables.endTrip({groupId:g,tripId:t},owner);
  for(const user of [owner,a]){
    await reject(publish(g,t,p,user),'failed-precondition');
    await reject(publish(g,t,null,user),'failed-precondition');
    const client=env.authenticatedContext(user.uid).firestore(),path=`groups/${g}/trips/${t}`;
    await assertFails(setDoc(doc(client,`${path}/posts/forged-after-close`),{uid:user.uid,status:'published'}));
    await assertFails(setDoc(doc(client,`${path}/completions/forged-after-close`),{uid:user.uid,placeId:p}));
    await assertFails(updateDoc(doc(client,path),{status:'open'}));
    await assertSucceeds(getDoc(doc(client,path)));await assertSucceeds(getDoc(doc(client,`${path}/posts/${original.postId}`)));
  }
  await reject(service.callables.addTripPlace({groupId:g,tripId:t,requestId:randomUUID(),place:{name:'종료 후 장소'}},owner),'failed-precondition');
  assert.equal((await db.doc(`groups/${g}/trips/${t}`).get()).data().postCount,1);
  assert.equal((await db.collection(`groups/${g}/trips/${t}/completions`).get()).size,1);
});

test('photo verification started before end cannot finalize after end commits',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId,p=(await places(g,t))[0];
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const slow=createGroupService(db,{HttpsError,FieldValue,verifyPhoto:async()=>{await gate;return {objectPath:`groups/${g}/trips/${t}/uploads/${a.uid}/late.jpg`,contentType:'image/jpeg',size:100};}});
  const pending=slow.finalizeVerifiedPost({groupId:g,tripId:t,placeId:p,requestId:randomUUID()},a);
  await service.callables.endTrip({groupId:g,tripId:t},owner);release();
  await reject(pending,'failed-precondition');
  assert.equal((await db.doc(`groups/${g}/trips/${t}`).get()).data().postCount,0);
  assert.equal((await db.collection(`groups/${g}/trips/${t}/completions`).get()).size,0);
});

test('concurrent end and photo commit serialize; no new write commits against an already closed trip',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId,p=(await places(g,t))[0];
  const result=await Promise.allSettled([service.callables.endTrip({groupId:g,tripId:t},owner),publish(g,t,p)]);
  assert.equal(result[0].status,'fulfilled');
  const saved=(await db.doc(`groups/${g}/trips/${t}`).get()).data();assert.equal(saved.status,'closed');
  if(result[1].status==='rejected'){assert.equal(result[1].reason.code,'failed-precondition');assert.equal(saved.postCount,0);}else assert.equal(saved.postCount,1);
  await reject(publish(g,t,p),'failed-precondition');
});

test('T10 report requires ended membership and derives deduplicated member stamps, representatives and lines from published photos',async()=>{
  const g=(await group()).groupId;await member(g,a);await member(g,b);const t=(await trip(g)).tripId,[p1,p2]=await places(g,t);
  const old=await publish(g,t,p1,a,{feeling:'삭제할 기록'}),latest=await publish(g,t,p1,a,{feeling:'멋진 발견'});await publish(g,t,p2,b);await publish(g,t,null,owner,{feeling:'자유 기록'});
  await service.callables.deletePost({groupId:g,tripId:t,postId:old.postId},a);
  await db.doc(`groups/${g}/members/${a.uid}`).update({email:'PRIVATE_EMAIL',phone:'PRIVATE_PHONE'});
  await db.doc(`groups/${g}/trips/${t}/posts/pending-report`).set({status:'pending',uid:a.uid,placeId:p2,feeling:'PRIVATE_PENDING'});
  await reject(service.callables.getTripReport({groupId:g,tripId:t},a),'failed-precondition');await service.callables.endTrip({groupId:g,tripId:t},owner);
  const report=await service.callables.getTripReport({groupId:g,tripId:t},a);assert.deepEqual(report,await service.callables.getTripReport({groupId:g,tripId:t},owner));
  assert.equal(report.days,2);assert.equal(report.placeCount,2);assert.equal(report.photoCount,3);assert.equal(report.stampCount,2);assert.equal(report.stampTotal,6);assert.equal(report.lines.length,2);assert.equal(report.places[0].representative.id,latest.postId);
  assert.equal(report.members.find(m=>m.uid===a.uid).stampCount,1);assert.equal(report.members.find(m=>m.uid===b.uid).stampCount,1);assert.doesNotMatch(JSON.stringify(report),/PRIVATE_EMAIL|PRIVATE_PHONE|PRIVATE_PENDING/);
  await reject(service.callables.getTripReport({groupId:g,tripId:t},outsider),'permission-denied');await reject(service.callables.getTripReport({groupId:g,tripId:t},null),'unauthenticated');
});
test('T11 AC-6a: only ended-trip leader can configure results; no direct config writes or another member overrides',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId,p=(await places(g,t))[0],post=await publish(g,t,p,a);
  const input={groupId:g,tripId:t,requestId:randomUUID(),format:'feed',template:'grid',postIds:[post.postId],ownerId:a.uid,uid:owner.uid};
  await reject(service.callables.configureShareImage(input,owner),'failed-precondition');await service.callables.endTrip({groupId:g,tripId:t},owner);
  for(const user of [a,outsider])await reject(service.callables.configureShareImage(input,user),'permission-denied');await reject(service.callables.configureShareImage(input,null),'unauthenticated');
  assert.equal((await db.collection(`groups/${g}/trips/${t}/shareImages`).get()).size,0);
  await assertFails(setDoc(doc(env.authenticatedContext(a.uid).firestore(),`groups/${g}/trips/${t}/shareImages/forged`),{uid:a.uid,format:'feed'}));
});
test('T11 configurations freeze export-only fields, deduplicate retries and reject zero/duplicate/missing/pending selections',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId,p=(await places(g,t))[0],post=await publish(g,t,p,a,{feeling:'PRIVATE_LINE'});await service.callables.endTrip({groupId:g,tripId:t},owner);
  const input={groupId:g,tripId:t,requestId:randomUUID(),format:'story',template:'board',postIds:[post.postId]};
  const results=await Promise.all([service.callables.configureShareImage(input,owner),service.callables.configureShareImage(input,owner)]);assert.equal(new Set(results.map(r=>r.configId)).size,1);assert.equal(results.filter(r=>!r.replayed).length,1);
  assert.equal(results[0].width,1080);assert.equal(results[0].height,1920);assert.doesNotMatch(JSON.stringify(results),/PRIVATE_LINE|대릉원|첨성대|새 여행|destination|email|displayName/);
  assert.equal(results[0].includeTripTitle,false);assert.equal(Object.hasOwn(results[0],'tripTitle'),false);
  await reject(service.callables.configureShareImage({...input,includeTripTitle:true},owner),'failed-precondition');
  const namedInput={...input,requestId:randomUUID(),includeTripTitle:true,tripTitle:'UNTRUSTED_TITLE'};
  const named=await service.callables.configureShareImage(namedInput,owner);
  assert.equal(named.includeTripTitle,true);assert.equal(named.tripTitle,(await db.doc(`groups/${g}/trips/${t}`).get()).data().title);
  assert.doesNotMatch(JSON.stringify(named),/UNTRUSTED_TITLE|PRIVATE_LINE|대릉원|첨성대|destination|email|displayName/);
  assert.equal((await service.callables.configureShareImage(namedInput,owner)).configId,named.configId);
  await reject(service.callables.configureShareImage({...namedInput,includeTripTitle:false},owner),'failed-precondition');
  for(const includeTripTitle of ['true',1,null])await reject(service.callables.configureShareImage({...input,requestId:randomUUID(),includeTripTitle},owner),'invalid-argument');
  await reject(service.callables.configureShareImage({...namedInput,requestId:randomUUID()},a),'permission-denied');
  await reject(service.callables.configureShareImage({...input,template:'grid'},owner),'failed-precondition');
  for(const changes of [{postIds:[]},{postIds:[post.postId,post.postId]},{postIds:Array(7).fill(post.postId)},{format:'__proto__'},{template:'unknown'}])await reject(service.callables.configureShareImage({...input,...changes,requestId:randomUUID()},owner),'invalid-argument');
  await reject(service.callables.configureShareImage({...input,postIds:['missing'],requestId:randomUUID()},owner),'failed-precondition');
  await db.doc(`groups/${g}/trips/${t}/posts/unfinished`).set({status:'pending',uid:a.uid});await reject(service.callables.configureShareImage({...input,postIds:['unfinished'],requestId:randomUUID()},owner),'failed-precondition');
  // Replays still check current ownership and membership, rather than trusting a prior config.
  await db.doc(`groups/${g}/members/${owner.uid}`).update({role:'member'});await reject(service.callables.configureShareImage(input,owner),'permission-denied');
});
test('T10/T11 zero-place and zero-photo ended report remains readable but cannot create a blank image',async()=>{
  const g=(await group()).groupId;const t=(await trip(g,{places:[]})).tripId;await service.callables.endTrip({groupId:g,tripId:t},owner);
  const report=await service.callables.getTripReport({groupId:g,tripId:t},owner);assert.equal(report.placeCount,0);assert.equal(report.photoCount,0);assert.equal(report.stampCount,0);assert.equal(report.stampTotal,0);assert.deepEqual(report.lines,[]);
  await reject(service.callables.configureShareImage({groupId:g,tripId:t,requestId:randomUUID(),format:'feed',template:'grid',postIds:[]},owner),'invalid-argument');
});

test('T15 empty place removal is leader-only, idempotent, server-authorized and blocked after closure',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId,[p,q]=await places(g,t),input={groupId:g,tripId:t,placeId:p};
  for(const method of ['previewTripPlaceRemoval','removeTripPlace']){
    for(const user of [a,outsider])await reject(service.callables[method]({...input,ownerId:a.uid,confirmationToken:'forged'},user),'permission-denied');
    await reject(service.callables[method](input,null),'unauthenticated');
  }
  const preview=await service.callables.previewTripPlaceRemoval(input,owner);assert.equal(preview.photoCount,0);assert.equal(preview.memberCount,0);
  const results=await Promise.all([service.callables.removeTripPlace(input,owner),service.callables.removeTripPlace(input,owner)]);
  assert.equal(results.filter(r=>!r.replayed).length,1);assert.deepEqual(await places(g,t),[q]);
  assert.equal((await db.doc(`groups/${g}/trips/${t}`).get()).data().placeCount,1);
  await assertFails(updateDoc(doc(env.authenticatedContext(owner.uid).firestore(),`groups/${g}/trips/${t}/places/${q}`),{status:'deleted'}));
  await service.callables.endTrip({groupId:g,tripId:t},owner);
  for(const method of ['previewTripPlaceRemoval','removeTripPlace'])await reject(service.callables[method]({...input,placeId:q},owner),'failed-precondition');
});

test('T15 AC-2d impact uses distinct authors and published photos; stale or absent confirmation cannot remove a photographed place',async()=>{
  const g=(await group()).groupId;await member(g,a);await member(g,b);const t=(await trip(g)).tripId,[p,q]=await places(g,t),root=`groups/${g}/trips/${t}`,input={groupId:g,tripId:t,placeId:p};
  await publish(g,t,p,a);await publish(g,t,p,a);await publish(g,t,p,b);await publish(g,t,q,a);
  await db.doc(root+'/posts/pending-impact').set({uid:b.uid,placeId:p,status:'pending'});
  const preview=await service.callables.previewTripPlaceRemoval(input,owner);assert.equal(preview.memberCount,2);assert.equal(preview.photoCount,3);
  for(const confirmationToken of [undefined,'forged'])await reject(service.callables.removeTripPlace({...input,confirmationToken},owner),'failed-precondition');
  await publish(g,t,p,b);
  await reject(service.callables.removeTripPlace({...input,confirmationToken:preview.confirmationToken},owner),'failed-precondition');
  const beforePosts=(await db.collection(root+'/posts').get()).docs.map(d=>({id:d.id,...d.data()}));
  const beforeStamps=(await db.collection(root+'/completions').get()).docs.map(d=>({id:d.id,...d.data()}));
  const latest=await service.callables.previewTripPlaceRemoval(input,owner);assert.equal(latest.photoCount,4);
  await service.callables.removeTripPlace({...input,confirmationToken:latest.confirmationToken},owner);
  assert.deepEqual((await db.collection(root+'/posts').get()).docs.map(d=>({id:d.id,...d.data()})),beforePosts);
  assert.deepEqual((await db.collection(root+'/completions').get()).docs.map(d=>({id:d.id,...d.data()})),beforeStamps);
  assert.deepEqual(await places(g,t),[q]);await reject(publish(g,t,p,a),'invalid-argument');
  const afterRemoval=await publish(g,t,q,b);assert.equal(afterRemoval.stampsDone,1);assert.equal(afterRemoval.stampsTotal,1);
  await service.callables.endTrip({groupId:g,tripId:t},owner);
  const report=await service.callables.getTripReport({groupId:g,tripId:t},a);assert.equal(report.photoCount,6);assert.equal(report.placeCount,1);assert.equal(report.stampCount,2);
});

test('T15 concurrent photo finalization and removal serialize without silently accepting an outdated impact',async()=>{
  const g=(await group()).groupId;await member(g,a);const t=(await trip(g)).tripId,p=(await places(g,t))[0],input={groupId:g,tripId:t,placeId:p};await publish(g,t,p,a);
  const preview=await service.callables.previewTripPlaceRemoval(input,owner);
  const results=await Promise.allSettled([service.callables.removeTripPlace({...input,confirmationToken:preview.confirmationToken},owner),publish(g,t,p,a)]);
  assert.ok(results.some(r=>r.status==='rejected'));
  if(results[0].status==='fulfilled'){assert.equal(results[1].reason.code,'invalid-argument');assert.equal((await places(g,t)).includes(p),false);}
  else{assert.equal(results[0].reason.code,'failed-precondition');assert.equal(results[1].status,'fulfilled');assert.equal((await places(g,t)).includes(p),true);}
});
