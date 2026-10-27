import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createGroupService}=require('../functions/group-service.cjs');
class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
const anonymous={uid:'member',token:{firebase:{sign_in_provider:'anonymous'}}};
const owner={uid:'owner',token:{firebase:{sign_in_provider:'google.com'}}};
const service=createGroupService({}, {HttpsError,FieldValue:{serverTimestamp(){}}});
const valid={groupId:'g',requestId:'request_0123456789',title:'여행',destination:'경주',startDate:'2026-10-27',endDate:'2026-10-28',places:[]};
const rejects=(action,code)=>assert.rejects(action,e=>e.code===code);

test('group and trip creation reject unauthenticated and anonymous requests before DB use',async()=>{
  await rejects(service.callables.createGroup({},null),'unauthenticated');
  await rejects(service.callables.createGroup({},anonymous),'permission-denied');
  await rejects(service.callables.createTrip(valid,anonymous),'permission-denied');
});
test('invalid trip paths, impossible dates, reverse date ranges and excessive places are rejected',async()=>{
  for(const update of [{groupId:'../other'},{startDate:'2026-02-30'}, {endDate:'2026-10-26'}, {places:Array(11).fill({name:'장소'})}, {places:[{name:''}]}])
    await rejects(service.callables.createTrip({...valid,...update},owner),'invalid-argument');
});
test('photo finalization is not an exposed callable and client verification claims cannot publish',async()=>{
  assert.deepEqual(Object.keys(service.callables).sort(),['addTripPlace','createGroup','createGroupInvite','createTrip','deletePost','editPost','endTrip','finalizePhoto','joinGroup','previewGroupInvite']);
  assert.equal(service.callables.finalizeVerifiedPost,undefined);
  await rejects(service.finalizeVerifiedPost({...valid,tripId:'t',placeId:'p',verified:true,photo:{url:'https://invalid.test/photo.jpg'}},anonymous),'failed-precondition');
});
test('invite creation requires Google leadership and joining requires authenticated valid nickname',async()=>{
  await rejects(service.callables.createGroupInvite({groupId:'g'},anonymous),'permission-denied');
  await rejects(service.callables.previewGroupInvite({},null),'unauthenticated');
  await rejects(service.callables.joinGroup({nickname:'별칭'},null),'unauthenticated');
  for(const nickname of ['', '가'.repeat(25),'줄\n바꿈'])await rejects(service.callables.joinGroup({nickname},anonymous),'invalid-argument');
});
test('feeling is limited to sixty Unicode characters before photo verification',async()=>{
  await rejects(service.finalizeVerifiedPost({...valid,tripId:'t',placeId:'p',feeling:'가'.repeat(61)},anonymous),'invalid-argument');
});
