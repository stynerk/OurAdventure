import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';
import {initializeApp,deleteApp} from 'firebase-admin/app';import {getFirestore,FieldValue} from 'firebase-admin/firestore';import {getStorage as adminStorage} from 'firebase-admin/storage';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,uploadBytes,getMetadata,getBytes,deleteObject,updateMetadata} from 'firebase/storage';import {doc,setDoc} from 'firebase/firestore';
const require=createRequire(import.meta.url),{createGroupService}=require('../functions/group-service.cjs'),{createPhotoVerifier}=require('../functions/photo-verifier.cjs');
class HttpsError extends Error{constructor(code,message,details){super(message);this.code=code;this.details=details;}}
const projectId='demo-our-adventure',bucketName=projectId+'.firebasestorage.app',png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
const auth=(uid,provider='anonymous')=>({uid,token:{firebase:{sign_in_provider:provider}}}),owner=auth('photo-owner','google.com'),a=auth('photo-a'),b=auth('photo-b');let app,db,bucket,env,service;
before(async()=>{assert.ok(process.env.FIREBASE_STORAGE_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST,'Demo emulators required');app=initializeApp({projectId,storageBucket:bucketName},'photo-admin');db=getFirestore(app);bucket=adminStorage(app).bucket();env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8085,rules:readFileSync('firestore.rules','utf8')},storage:{host:'127.0.0.1',port:9199,rules:readFileSync('storage.rules','utf8')}});service=createGroupService(db,{HttpsError,FieldValue,verifyPhoto:createPhotoVerifier(bucket,{HttpsError})});});
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
