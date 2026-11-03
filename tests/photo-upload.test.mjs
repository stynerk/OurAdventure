import test from 'node:test';import assert from 'node:assert/strict';
import {makePhotoAttempt,savePhotoAttempt,validatePhoto,photoFailureMessage,lineBucket,uploadBucket,MAX_PHOTO_BYTES} from '../next/photo-upload.mjs';
import {photoProductionChecks} from '../scripts/check-photo-production.mjs';
import {createAnalytics} from '../next/analytics.mjs';
const input={uid:'a',groupId:'g',tripId:'t',placeId:'p',file:{size:123,type:'image/png'},feeling:''};

test('production preflight catches missing cross-service IAM that emulators cannot enforce',()=>{
  const config={projectNumber:'123',bindings:[{role:'roles/firebasestorage.serviceAgent',members:['serviceAccount:service-123@gcp-sa-firebasestorage.iam.gserviceaccount.com']}],bucket:{cors:[{origin:['https://stynerk.github.io'],method:['GET','HEAD']}]},storageRules:'allow get: if firestore.exists(/databases/(default)/documents/groups/g);',finalizerState:'ACTIVE'};
  assert.equal(photoProductionChecks(config)[0].passed,false);
  const grant={role:'roles/firebaserules.firestoreServiceAgent',members:['serviceAccount:service-123@gcp-sa-firebasestorage.iam.gserviceaccount.com']};
  assert.ok(photoProductionChecks({...config,bindings:[...config.bindings,grant]}).every(c=>c.passed));
  assert.equal(photoProductionChecks({...config,bindings:[{...grant,members:['serviceAccount:service-999@gcp-sa-firebasestorage.iam.gserviceaccount.com']} ]})[0].passed,false);
  assert.equal(photoProductionChecks({...config,bindings:[{...grant,condition:{expression:'false'}}]})[0].passed,false);
});

test('storage permission denial is identified before finalization and same request retries without duplicates',async()=>{
  const attempt=makePhotoAttempt(input);let blocked=true,finalized=0;
  const deps={upload:async()=>{if(blocked)throw Object.assign(Error('PRIVATE/path'),{code:'storage/unauthorized'});},finalize:async()=>{finalized++;return {completed:true};}};
  await assert.rejects(savePhotoAttempt(attempt,deps),error=>{assert.match(photoFailureMessage(error,attempt.stage),/^사진 업로드 실패:/);assert.doesNotMatch(photoFailureMessage(error,attempt.stage),/PRIVATE/);return true;});
  assert.equal(finalized,0);assert.equal(attempt.uploaded,false);const id=attempt.requestId;
  blocked=false;await savePhotoAttempt(attempt,deps);await savePhotoAttempt(attempt,deps);assert.equal(finalized,1);assert.equal(attempt.requestId,id);
});

test('photo errors distinguish upload, server confirmation, ended trips and local draft storage',()=>{
  assert.match(photoFailureMessage({code:'storage/retry-limit-exceeded'},'upload'),/^사진 업로드 실패:.*대기 시간/);
  assert.match(photoFailureMessage({code:'functions/internal',message:'PRIVATE'},'save'),/^서버 확정 실패:/);
  assert.match(photoFailureMessage({details:{reason:'ended'}},'save'),/종료된 여행/);
  assert.match(photoFailureMessage({code:'photo/draft-unavailable'},'upload'),/^기기 임시 저장 실패:/);
});
test('photo upload failure preserves input and identity; no finalize or completion occurs before upload succeeds',async()=>{
  const attempt=makePhotoAttempt({...input,feeling:'남긴 느낌'});let uploaded=0,finalized=0;
  const deps={upload:async()=>{if(++uploaded===1)throw Error('offline');},finalize:async()=>{finalized++;return {completed:true};}};
  await assert.rejects(savePhotoAttempt(attempt,deps));assert.equal(attempt.uploaded,false);assert.equal(finalized,0);
  const id=attempt.requestId;assert.equal(attempt.feeling,'남긴 느낌');assert.equal(attempt.file,input.file);
  await savePhotoAttempt(attempt,deps);assert.equal(attempt.requestId,id);assert.equal(finalized,1);
});
test('lost finalization response retries same request without uploading again; concurrent submits share one promise',async()=>{
  const a=makePhotoAttempt(input);let uploads=0,calls=0;const requests=[];
  const deps={upload:async()=>{uploads++;},finalize:async data=>{requests.push(data);if(++calls===1)throw Error('lost response');return {completed:true,replayed:true};}};
  const one=savePhotoAttempt(a,deps),two=savePhotoAttempt(a,deps);assert.equal(one,two);await assert.rejects(one);
  assert.equal(a.uploaded,true);await savePhotoAttempt(a,deps);await savePhotoAttempt(a,deps);
  assert.equal(uploads,1);assert.equal(calls,2);assert.deepEqual(requests[0],requests[1]);assert.equal(requests[0].feeling,'');
});
test('photo format/size and sixty Unicode characters are checked before creating an attempt',()=>{
  for(const file of [{size:0,type:'image/png'},{size:MAX_PHOTO_BYTES+1,type:'image/png'},{size:1,type:'image/svg+xml'}])assert.throws(()=>validatePhoto(file));
  assert.throws(()=>makePhotoAttempt({...input,feeling:'가'.repeat(61)}));assert.doesNotThrow(()=>makePhotoAttempt({...input,feeling:'😀'.repeat(60)}));
  assert.equal(lineBucket(''),'0');assert.equal(lineBucket('가'.repeat(21)),'21-40');assert.equal(uploadBucket(6000),'5-15s');
});
test('photo Analytics filters out text, files, UID, object paths and invalid enums',async()=>{
  const events=[];const tracker=await createAnalytics({app:{},config:{firebaseConfig:{measurementId:'G-TEST123'}},location:'https://example.test/next/',loadSdk:async()=>({isSupported:async()=>true,initializeAnalytics:()=>({}),logEvent:(_a,name,params)=>events.push({name,params})})});
  tracker.track('photo_select',{source:'camera',fileName:'PRIVATE'});
  tracker.track('stamp_complete_fail',{reason:'save',retry:true,feeling:'PRIVATE'});
  tracker.track('stamp_complete',{place_index:1,has_line:false,line_length_bucket:'0',upload_bucket:'under_2s',stamps_done:'1-3',stamps_total:'1-3',uid:'PRIVATE',objectPath:'PRIVATE'});
  tracker.track('stamp_complete_fail',{reason:'PRIVATE',retry:true});tracker.track('photo_select',{source:'PRIVATE'});
  assert.deepEqual(events.map(e=>e.name),['photo_select','stamp_complete_fail','stamp_complete']);assert.doesNotMatch(JSON.stringify(events),/PRIVATE/);
});
