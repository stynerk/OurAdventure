import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';
import {initializeApp,deleteApp} from 'firebase-admin/app';import {getFirestore,FieldValue} from 'firebase-admin/firestore';import {getStorage as adminStorage} from 'firebase-admin/storage';
import {getDoc,getDocs,query,collection,where,orderBy,documentId,limit,startAfter,updateDoc,deleteDoc} from 'firebase/firestore';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,uploadBytes,getMetadata,getBytes,deleteObject,updateMetadata} from 'firebase/storage';import {doc,setDoc} from 'firebase/firestore';
const require=createRequire(import.meta.url),{createGroupService}=require('../functions/group-service.cjs'),{createPhotoVerifier}=require('../functions/photo-verifier.cjs');
class HttpsError extends Error{constructor(code,message,details){super(message);this.code=code;this.details=details;}}
const projectId='demo-our-adventure',bucketName=projectId+'.firebasestorage.app',png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
const auth=(uid,provider='anonymous')=>({uid,token:{firebase:{sign_in_provider:provider}}}),owner=auth('photo-owner','google.com'),a=auth('photo-a'),b=auth('photo-b');let app,db,bucket,env,service;
before(async()=>{assert.ok(process.env.FIREBASE_STORAGE_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST,'Demo emulators required');app=initializeApp({projectId,storageBucket:bucketName},'photo-admin');db=getFirestore(app);bucket=adminStorage(app).bucket();env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8085,rules:readFileSync('firestore.rules','utf8')},storage:{host:'127.0.0.1',port:9199,rules:readFileSync('storage.rules','utf8')}});service=createGroupService(db,{HttpsError,FieldValue,verifyPhoto:createPhotoVerifier(bucket,{HttpsError}),deletePhoto:photo=>bucket.file(photo.objectPath).delete({ignoreNotFound:true})});});
after(async()=>{await env?.cleanup();await db?.terminate();if(app)await deleteApp(app);});
const client=user=>env.authenticatedContext(user.uid).storage('gs://'+bucketName);
async function setup(){const g=(await service.callables.createGroup({title:'사진 테스트 그룹',requestId:randomUUID()},owner)).groupId,{token}=await service.callables.createGroupInvite({groupId:g},owner);for(const user of [a,b])await service.callables.joinGroup({token,nickname:'같은 별칭'},user);const t=(await service.callables.createTrip({groupId:g,title:'사진 여행',destination:'경주',startDate:'2026-10-28',endDate:'2026-10-29',places:[{name:'첫 장소'}],requestId:randomUUID()},owner)).tripId,p=(await db.doc(`groups/${g}/trips/${t}`).get()).data().placeIds[0];return {g,t,p};}
const path=(c,u,id)=>`groups/${c.g}/trips/${c.t}/uploads/${u.uid}/${id}`;
const finalize=(c,id,requestId=randomUUID(),user=a,feeling='')=>service.callables.finalizePhoto({groupId:c.g,tripId:c.t,placeId:c.p,uploadId:id,requestId,feeling,uid:b.uid,verified:true},user);
const rejects=(promise,code)=>assert.rejects(promise,e=>e.code===code);
test('Storage allows only member-owned creates with bounded size/type and rejects overwrite/delete/outsiders',async()=>{
  const c=await setup(),id=randomUUID(),target=ref(client(a),path(c,a,id));await assertSucceeds(uploadBytes(target,png,{contentType:'image/png'}));
  await assertFails(uploadBytes(target,png,{contentType:'image/png'}));await assertFails(deleteObject(target));await assertFails(updateMetadata(target,{customMetadata:{firebaseStorageDownloadTokens:'forged'}}));
  await assertFails(uploadBytes(ref(client(b),path(c,a,randomUUID())),png,{contentType:'image/png'}));
  await assertFails(uploadBytes(ref(client(auth('outsider')),path(c,auth('outsider'),randomUUID())),png,{contentType:'image/png'}));
  await assertFails(getMetadata(ref(env.unauthenticatedContext().storage('gs://'+bucketName),path(c,a,id))));
  for(const [bytes,type] of [[png,'image/svg+xml'],[new Uint8Array(5*1024*1024+1),'image/png'],[new Uint8Array(0),'image/png']])await assertFails(uploadBytes(ref(client(a),path(c,a,randomUUID())),bytes,{contentType:type}));
});
test('AC-4a/4b/4c/4f/5b: pending bytes private; optional-line finalize publishes one photo and only own completion; retries deduplicate',async()=>{
  const c=await setup(),id=randomUUID(),requestId=randomUUID(),target=ref(client(a),path(c,a,id));await uploadBytes(target,png,{contentType:'image/png'});
  await assertSucceeds(getMetadata(target));await assertFails(getMetadata(ref(client(b),path(c,a,id))));await assertFails(getBytes(ref(client(b),path(c,a,id))));
  assert.equal((await db.collection(`groups/${c.g}/trips/${c.t}/completions`).get()).size,0);
  const results=await Promise.all(Array.from({length:3},()=>finalize(c,id,requestId)));assert.equal(new Set(results.map(r=>r.postId)).size,1);
  const done=await db.collection(`groups/${c.g}/trips/${c.t}/completions`).get();assert.equal(done.size,1);assert.equal(done.docs[0].data().uid,a.uid);assert.equal(done.docs[0].data().photoCount,1);
  const posts=await db.collection(`groups/${c.g}/trips/${c.t}/posts`).get();assert.equal(posts.size,1);assert.equal(posts.docs[0].data().feeling,'');
  await assertSucceeds(getMetadata(ref(client(b),path(c,a,id))));await assertSucceeds(getBytes(ref(client(b),path(c,a,id))));await assertFails(getMetadata(ref(client(auth('outsider')),path(c,a,id))));
  assert.doesNotMatch(JSON.stringify(results),/downloadTokens|https?:/);
  await rejects(finalize(c,id,randomUUID()),'already-exists');
});
test('missing upload, mismatched signature and excessive line never publish or reveal photo',async()=>{
  const c=await setup();await rejects(finalize(c,randomUUID()),'failed-precondition');const id=randomUUID();
  await uploadBytes(ref(client(a),path(c,a,id)),Buffer.from('not a real png image'),{contentType:'image/png'});
  await rejects(finalize(c,id),'invalid-argument');await assertFails(getMetadata(ref(client(b),path(c,a,id))));
  const valid=randomUUID();await uploadBytes(ref(client(a),path(c,a,valid)),png,{contentType:'image/png'});await rejects(finalize(c,valid,randomUUID(),a,'가'.repeat(61)),'invalid-argument');
  await assertFails(setDoc(doc(env.authenticatedContext(a.uid).firestore(),`groups/${c.g}/trips/${c.t}/uploads/${a.uid}/items/${id}`),{status:'published'}));
  assert.equal((await db.collection(`groups/${c.g}/trips/${c.t}/posts`).get()).size,0);
});
test('ended trip denies new Storage uploads and unfinished-photo finalization while published photos remain member readable',async()=>{
  const c=await setup(),saved=randomUUID(),pending=randomUUID();for(const id of [saved,pending])await uploadBytes(ref(client(a),path(c,a,id)),png,{contentType:'image/png'});
  await finalize(c,saved);await service.callables.endTrip({groupId:c.g,tripId:c.t},owner);
  await assertFails(uploadBytes(ref(client(a),path(c,a,randomUUID())),png,{contentType:'image/png'}));await rejects(finalize(c,pending),'failed-precondition');
  await assertFails(getMetadata(ref(client(b),path(c,a,pending))));await assertSucceeds(getBytes(ref(client(b),path(c,a,saved))));
});

async function publish(c,user=a,{place=c.p,feeling=''}={}){
  const uploadId=randomUUID(),requestId=randomUUID();await uploadBytes(ref(client(user),path(c,user,uploadId)),png,{contentType:'image/png'});
  const data={groupId:c.g,tripId:c.t,placeId:place,uploadId,requestId,feeling};
  const result=await service.callables.finalizePhoto(data,user);return {...result,data,objectPath:path(c,user,uploadId)};
}
test('QA D7: exactly sixty Unicode characters publish, sixty-one rejects without an extra post',async()=>{
  const c=await setup(),post=await publish(c,a,{feeling:'가'.repeat(60)});
  assert.equal((await db.doc(`groups/${c.g}/trips/${c.t}/posts/${post.postId}`).get()).data().feeling.length,60);
  const pending=randomUUID();await uploadBytes(ref(client(a),path(c,a,pending)),png,{contentType:'image/png'});
  await rejects(finalize(c,pending,randomUUID(),a,'가'.repeat(61)),'invalid-argument');
  assert.equal((await db.collection(`groups/${c.g}/trips/${c.t}/posts`).get()).size,1);
  await assertFails(getBytes(ref(client(b),path(c,a,pending))));
});
const edit=(c,post,user,more={})=>service.callables.editPost({groupId:c.g,tripId:c.t,postId:post.postId,feeling:'수정한 느낌',revision:0,requestId:randomUUID(),...more},user);
const remove=(c,post,user)=>service.callables.deletePost({groupId:c.g,tripId:c.t,postId:post.postId,uid:a.uid},user);
test('T9 AC-5a/5b: member-only published feed, stable newest pagination and combined filters exclude unconfirmed records',async()=>{
  const c=await setup(),one=await publish(c,a),two=await publish(c,b,{place:null,feeling:'자유 기록'}),root=`groups/${c.g}/trips/${c.t}/posts`;
  await db.doc(`${root}/unconfirmed`).set({uid:a.uid,status:'pending',createdAt:FieldValue.serverTimestamp(),feeling:'보이면 안 되는 기록'});
  const pending=randomUUID();await uploadBytes(ref(client(a),path(c,a,pending)),png,{contentType:'image/png'});
  const store=env.authenticatedContext(b.uid).firestore(),base=collection(store,root),ordered=[where('status','==','published'),orderBy('createdAt','desc'),orderBy(documentId(),'desc')];
  const first=await getDocs(query(base,...ordered,limit(1)));assert.equal(first.docs[0].id,two.postId);
  const second=await getDocs(query(base,...ordered,startAfter(first.docs[0]),limit(1)));assert.equal(second.docs[0].id,one.postId);
  const filtered=await getDocs(query(base,where('status','==','published'),where('uid','==',b.uid),where('placeId','==',null),orderBy('createdAt','desc')));assert.equal(filtered.size,1);assert.equal(filtered.docs[0].id,two.postId);
  await assertFails(getDoc(doc(store,root+'/unconfirmed')));await assertFails(getDocs(base));
  const outsider=env.authenticatedContext('non-member').firestore();await assertFails(getDocs(query(collection(outsider,root),where('status','==','published'))));await assertFails(getDoc(doc(outsider,root+'/'+one.postId)));
  await assertFails(getBytes(ref(client(b),path(c,a,pending))));
  assert.equal((await db.collection(`groups/${c.g}/trips/${c.t}/completions`).get()).size,1);
});
test('T9 AC-5c: other member, leader, outsider and unauthenticated caller cannot edit/delete another author; direct writes denied',async()=>{
  const c=await setup(),post=await publish(c,a);
  for(const user of [b,owner,auth('outsider')]){await rejects(edit(c,post,user),'permission-denied');await rejects(remove(c,post,user),'permission-denied');}
  await rejects(edit(c,post,null),'unauthenticated');await rejects(remove(c,post,null),'unauthenticated');
  const target=doc(env.authenticatedContext(a.uid).firestore(),`groups/${c.g}/trips/${c.t}/posts/${post.postId}`);
  await assertFails(updateDoc(target,{feeling:'직접 변경'}));await assertFails(deleteDoc(target));
  assert.equal((await db.doc(`groups/${c.g}/trips/${c.t}/posts/${post.postId}`).get()).data().status,'published');
});
test('T9 own optional feeling edit validates sixty Unicode characters, deduplicates lost-response retries and rejects stale edits',async()=>{
  const c=await setup(),post=await publish(c,a),requestId=randomUUID();
  const results=await Promise.all([edit(c,post,a,{requestId}),edit(c,post,a,{requestId})]);assert.deepEqual(results.map(r=>r.revision),[1,1]);
  await rejects(edit(c,post,a,{requestId,feeling:'다른 내용'}),'failed-precondition');await rejects(edit(c,post,a),'aborted');
  await rejects(edit(c,post,a,{revision:1,feeling:'가'.repeat(61)}),'invalid-argument');
  await edit(c,post,a,{revision:1,feeling:''});const saved=(await db.doc(`groups/${c.g}/trips/${c.t}/posts/${post.postId}`).get()).data();
  assert.equal(saved.feeling,'');assert.equal(saved.revision,2);assert.equal(saved.uid,a.uid);assert.equal(saved.placeId,c.p);
  assert.equal((await db.doc(`groups/${c.g}/trips/${c.t}`).get()).data().postCount,1);
});
test('T9 concurrent own deletion/retry removes only own last stamp, decrements counts once and revokes photo reads for everyone',async()=>{
  const c=await setup(),a1=await publish(c,a),a2=await publish(c,a),b1=await publish(c,b);
  const first=await Promise.all([remove(c,a1,a),remove(c,a1,a)]);assert.ok(first.every(r=>!r.stampRemoved));
  assert.equal((await db.collection(`groups/${c.g}/trips/${c.t}/completions`).get()).docs.find(d=>d.data().uid===a.uid).data().photoCount,1);
  const last=await remove(c,a2,a);assert.equal(last.stampRemoved,true);assert.equal(last.postCount,1);
  await remove(c,a2,a);const done=await db.collection(`groups/${c.g}/trips/${c.t}/completions`).get();assert.equal(done.size,1);assert.equal(done.docs[0].data().uid,b.uid);
  assert.equal((await db.doc(`groups/${c.g}/trips/${c.t}/places/${c.p}`).get()).data().postCount,1);
  assert.equal((await bucket.file(a2.objectPath).exists())[0],false);await assertFails(getBytes(ref(client(a),a2.objectPath)));await assertFails(getBytes(ref(client(b),a2.objectPath)));
  await assertSucceeds(getBytes(ref(client(a),b1.objectPath)));
});
test('T9 free record deletion never changes stamps; failed physical cleanup remains private and retries safely',async()=>{
  const c=await setup(),post=await publish(c,a,{place:null,feeling:'자유 기록'});let fail=true;
  const flaky=createGroupService(db,{HttpsError,FieldValue,verifyPhoto:createPhotoVerifier(bucket,{HttpsError}),deletePhoto:async photo=>{if(fail)throw Error('temporary Storage failure');await bucket.file(photo.objectPath).delete({ignoreNotFound:true});}});
  const data={groupId:c.g,tripId:c.t,postId:post.postId};const result=await flaky.callables.deletePost(data,a);assert.equal(result.cleanupPending,true);assert.equal(result.wasStamp,false);
  assert.equal((await bucket.file(post.objectPath).exists())[0],true);await assertFails(getBytes(ref(client(a),post.objectPath)));await assertFails(getBytes(ref(client(b),post.objectPath)));
  await rejects(service.callables.finalizePhoto(post.data,a),'failed-precondition');
  fail=false;const retry=await flaky.callables.deletePost(data,a);assert.equal(retry.replayed,true);assert.equal(retry.cleanupPending,false);assert.equal(retry.postCount,0);
  assert.equal((await db.collection(`groups/${c.g}/trips/${c.t}/completions`).get()).size,0);assert.equal((await bucket.file(post.objectPath).exists())[0],false);
});
test('T9 closed trip rejects own edit/delete/free create and pending finalize; ended published feed stays readable',async()=>{
  const c=await setup(),post=await publish(c,a),pending=randomUUID();await uploadBytes(ref(client(a),path(c,a,pending)),png,{contentType:'image/png'});
  await service.callables.endTrip({groupId:c.g,tripId:c.t},owner);
  await rejects(edit(c,post,a),'failed-precondition');await rejects(remove(c,post,a),'failed-precondition');
  await rejects(service.callables.finalizePhoto({groupId:c.g,tripId:c.t,placeId:null,uploadId:pending,requestId:randomUUID(),feeling:''},a),'failed-precondition');
  await assertSucceeds(getDoc(doc(env.authenticatedContext(b.uid).firestore(),`groups/${c.g}/trips/${c.t}/posts/${post.postId}`)));await assertSucceeds(getBytes(ref(client(b),post.objectPath)));
});

test('T15 removed place retains member-readable photos and author-only edit/delete; unfinished uploads cannot create removed-place stamps',async()=>{
  const c=await setup(),one=await publish(c,a),two=await publish(c,b),pending=randomUUID();
  await uploadBytes(ref(client(a),path(c,a,pending)),png,{contentType:'image/png'});
  const input={groupId:c.g,tripId:c.t,placeId:c.p},impact=await service.callables.previewTripPlaceRemoval(input,owner);
  await service.callables.removeTripPlace({...input,confirmationToken:impact.confirmationToken},owner);
  await assertSucceeds(getBytes(ref(client(b),one.objectPath)));await assertSucceeds(getBytes(ref(client(a),two.objectPath)));
  await rejects(finalize(c,pending),'invalid-argument');await assertFails(getBytes(ref(client(b),path(c,a,pending))));
  await rejects(remove(c,one,owner),'permission-denied');await rejects(edit(c,one,b),'permission-denied');
  await edit(c,one,a);await remove(c,one,a);
  await assertFails(getBytes(ref(client(b),one.objectPath)));await assertSucceeds(getBytes(ref(client(a),two.objectPath)));
  assert.equal((await db.doc(`groups/${c.g}/trips/${c.t}`).get()).data().postCount,1);
  assert.equal((await db.doc(`groups/${c.g}/trips/${c.t}/places/${c.p}`).get()).data().postCount,1);
});
