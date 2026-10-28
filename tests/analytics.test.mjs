import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnalytics,countBucket,daysBucket} from '../next/analytics.mjs';
import {createGroupViews} from '../next/groups.mjs';

function fixture(overrides={}) {
  const sent=[],initializations=[];
  const options={app:{},config:{firebaseConfig:{measurementId:'G-TEST123'}},location:'https://example.com/OurAdventure/next/',loadSdk:async()=>({isSupported:async()=>true,initializeAnalytics:(_app,settings)=>{initializations.push(settings);return {};},logEvent:(_analytics,name,params)=>sent.push({name,params})}),...overrides};
  return {options,sent,initializations};
}
test('reviewed event parameters exclude user text, IDs, URL tokens, and arbitrary errors',async()=>{
  const f=fixture();const {track}=await createAnalytics(f.options);
  track('trip_create',{place_count:'1-3',days:'2-3',title:'PRIVATE',destination:'PRIVATE',requestId:'PRIVATE',group_id:'A'.repeat(20),trip_id:'PRIVATE',role:'leader',trip_status:'active'});
  track('page_view',{screen_name:'join',token:'PRIVATE'});
  track('operation_error',{operation:'createTrip',error_code:'functions/permission-denied',message:'PRIVATE'});
  track('operation_error',{operation:'createTrip',error_code:'PRIVATE'});
  track('past_trip_open',{trip_status:'ended',days_since_end_bucket:'unknown',tripId:'PRIVATE'});
  track('login',{method:'google',email:'PRIVATE'});
  track('arbitrary_PRIVATE',{title:'PRIVATE'});
  track('page_view',{screen_name:'join/PRIVATE'});
  track('trip_create',{place_count:11});
  assert.equal(f.sent.length,6);
  assert.doesNotMatch(JSON.stringify(f.sent),/PRIVATE|requestId|tripId|email|destination/);
  assert.equal(f.sent[0].params.place_count,'1-3');
  assert.equal(f.sent[0].params.group_id,'A'.repeat(20));
  assert.equal(f.sent[0].params.trip_id,undefined);
  assert.equal(f.sent[0].params.role,'leader');
  assert.equal(f.sent[2].params.error_code,'permission-denied');
  assert.equal(f.sent[3].params.error_code,'unknown');
  assert.equal(f.sent[4].params.trip_status,'ended');
  assert.equal(f.initializations[0].config.send_page_view,false);
  for(const event of f.sent){assert.equal(event.params.page_referrer,'');assert.equal(event.params.schema_version,'1');assert.equal(event.params.debug_mode,undefined);}
});
test('counts use specified buckets and identity properties never contain a UID',async()=>{
  assert.deepEqual([0,1,3,4,6,7,10,11].map(countBucket),['0','1-3','1-3','4-6','4-6','7-10','7-10','11+']);
  assert.deepEqual([1,2,3,4,7,8].map(daysBucket),['1','2-3','2-3','4-7','4-7','8+']);
  const properties=[];
  const f=fixture({loadSdk:async()=>({isSupported:async()=>true,initializeAnalytics:()=>({}),setUserProperties:(_a,value)=>properties.push(value)})});
  const {setAuthType}=await createAnalytics(f.options);
  setAuthType('google');setAuthType('anonymous');setAuthType('PRIVATE_UID');setAuthType(null);
  assert.deepEqual(properties,[{auth_type:'google'},{auth_type:'anonymous'},{auth_type:null},{auth_type:null}]);
});
test('SDK is never loaded for emulator, disabled, or missing measurement configuration',async()=>{
  for(const config of [{useEmulators:true,firebaseConfig:{measurementId:'G-TEST123'}},{enableAnalytics:false,firebaseConfig:{measurementId:'G-TEST123'}},{firebaseConfig:{}},{firebaseConfig:{measurementId:'invalid'}}]){
    const f=fixture({config,loadSdk:()=>{throw new Error('Must not load');}});
    const {track}=await createAnalytics(f.options);track('logout');assert.deepEqual(f.sent,[]);
  }
});
test('T7 screen events accept only specified screen names and safe common context',async()=>{
  const f=fixture();const {track}=await createAnalytics(f.options);
  track('screen_view',{screen_name:'stamps',role:'member',trip_status:'ended',group_id:'A'.repeat(20),uid:'PRIVATE_UID',nickname:'PRIVATE_NAME'});
  track('screen_view',{screen_name:'group-join/PRIVATE_TOKEN'});
  assert.equal(f.sent.length,1);assert.equal(f.sent[0].params.screen_name,'stamps');
  assert.equal(f.sent[0].params.role,'member');assert.doesNotMatch(JSON.stringify(f.sent),/PRIVATE/);
});
test('unsupported browser, SDK failure, and blocked event delivery do not break application',async()=>{
  for(const loadSdk of [async()=>{throw new Error('offline');},async()=>({isSupported:async()=>false}),async()=>({isSupported:async()=>true,initializeAnalytics:()=>({}),logEvent:()=>{throw new Error('blocked');}})]){
    const {track}=await createAnalytics(fixture({loadSdk}).options);assert.doesNotThrow(()=>track('logout'));
  }
});
test('initialization strips hash/query from measurement context and debug is explicit',async()=>{
  const f=fixture({location:'https://example.com/OurAdventure/next/app.js?PRIVATE#join/PRIVATE',debug:true});
  const {track}=await createAnalytics(f.options);track('logout');
  assert.equal(f.initializations[0].config.page_location,'https://example.com/OurAdventure/next/');
  assert.equal(f.initializations[0].config.page_referrer,'');
  assert.equal(f.sent[0].params.debug_mode,true);
  assert.doesNotMatch(JSON.stringify(f.sent),/PRIVATE/);
});
test('screen flow emits spec events only after authorized server reads and in flow order',async()=>{
  const events=[],group='A'.repeat(20),trip='B'.repeat(20);
  let owner=true,authorized=true,current=true;
  const snapshot=data=>({exists:()=>true,data:()=>data});
  const api={doc:(_db,...parts)=>parts.join('/'),collection:(_db,...parts)=>parts.join('/'),getDocFromServer:async path=>{
    if(!authorized)throw new Error('permission-denied');
    if(path.endsWith('/members/test-user'))return snapshot({role:owner?'owner':'member'});
    if(path.endsWith('/trips/'+trip))return snapshot({status:'closed',placeIds:[],closedAt:{seconds:Math.floor(Date.now()/1000)}});
    return snapshot({ownerId:owner?'test-user':'someone-else'});
  },getDocsFromServer:async()=>({docs:[]})};
  const app={innerHTML:'',addEventListener:()=>{},querySelector:()=>null};
  const views=createGroupViews({app,api,db:{},getUser:()=>({uid:'test-user'}),isCurrent:()=>current,storage:{},activateTrip:()=>{},track:(name,params)=>events.push({name,params})});
  await views.open({view:'group',groupId:group},1);
  await views.open({view:'trip-create',groupId:group},2);
  await views.open({view:'trip',groupId:group,tripId:trip},3);
  assert.deepEqual(events.map(e=>e.name),['group_open','trip_create_start','past_trip_open','screen_view']);
  assert.equal(events[0].params.trip_count,'0');
  assert.equal(events[2].params.trip_status,'ended');
  owner=false;await views.open({view:'trip-create',groupId:group},4);
  authorized=false;await views.open({view:'trip',groupId:group,tripId:trip},5);
  authorized=true;current=false;await views.open({view:'group',groupId:group},6);
  assert.equal(events.length,4);
});
