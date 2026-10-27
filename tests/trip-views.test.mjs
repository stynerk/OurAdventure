import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIP_TABS,completionSummary,googlePlaceUrl,createTripViews} from '../next/trip-views.mjs';
import {mapPositions,illustratedMap} from '../next/illustrated-map.mjs';

test('personal stamp progress deduplicates photos and ignores other places, missing members and zero-photo records',()=>{
  const rows=completionSummary(['p1','p2'],[{id:'a',displayName:'같은 별칭'},{id:'b',displayName:'같은 별칭'}],[
    {uid:'a',placeId:'p1',photoCount:1},{uid:'a',placeId:'p1',photoCount:2},
    {uid:'b',placeId:'p2',photoCount:1},{uid:'a',placeId:'other-trip',photoCount:1},
    {uid:'stranger',placeId:'p1',photoCount:1},{uid:'a',placeId:'p2',photoCount:0}
  ]);
  assert.deepEqual([...rows.get('a')],['p1']);assert.deepEqual([...rows.get('b')],['p2']);
  assert.equal(rows.has('stranger'),false);
});
test('Google map links use fixed HTTPS origin and encoded destination/place, never arbitrary URLs',()=>{
  const url=new URL(googlePlaceUrl('도쿄 & 여행',{name:'장소 #1',googlePlaceId:'ChIJ_example'}));
  assert.equal(url.origin,'https://www.google.com');assert.equal(url.pathname,'/maps/search/');
  assert.equal(url.searchParams.get('api'),'1');assert.equal(url.searchParams.get('query'),'도쿄 & 여행 장소 #1');
  assert.equal(url.searchParams.get('query_place_id'),'ChIJ_example');
  const malicious=new URL(googlePlaceUrl('javascript:alert(1)',{name:'<script>',googlePlaceId:'https://evil.test'}));
  assert.equal(malicious.origin,'https://www.google.com');assert.equal(malicious.searchParams.has('query_place_id'),false);
});
test('illustrated map uses one internal pin per place, stable route order and escaped labels',()=>{
  for(const n of [0,1,2,10]){const points=mapPositions(n);assert.equal(points.length,n);assert.equal(new Set(points.map(p=>`${p.x},${p.y}`)).size,n);}
  const html=illustratedMap([{id:'a',name:'<script>'},{id:'b',name:'둘째 장소'}],new Set(['a']),p=>`#trip/g/t/stamp/${p.id}`);
  assert.match(html,/map-route/);assert.match(html,/is-done/);assert.match(html,/href="#trip\/g\/t\/stamp\/b"/);
  assert.doesNotMatch(html,/<script>|https?:\/\//);assert.match(html,/&lt;script&gt;/);
});
function fixture({owner=true,closed=false}={}) {
  const app={innerHTML:'initial',addEventListener:()=>{}},calls=[],events=[];let active=true,activated=0,expectedContext;
  const docs=rows=>({docs:rows.map(({id,...data})=>({id,data:()=>data}))});
  const api={doc:(_db,...path)=>path.join('/'),collection:(_db,...path)=>path.join('/'),where:(...args)=>({where:args}),limit:n=>({limit:n}),query:(path,...constraints)=>({path,constraints}),getDocFromServer:async()=>({exists:()=>true,data:()=>({title:'여행',destination:'경주',status:closed?'closed':'open',placeIds:['p1','p2'],postCount:1})}),getDocsFromServer:async query=>{
    calls.push(query);const path=typeof query==='string'?query:query.path;
    if(path.endsWith('/places'))return docs([{id:'p1',name:'첫 장소',icon:'📍'},{id:'p2',name:'둘째 장소'}]);
    if(path.endsWith('/members'))return docs([{id:'a',displayName:'같은 별칭'},{id:'b',displayName:'같은 별칭'}]);
    if(path.endsWith('/completions'))return docs([{id:'ca',uid:'a',placeId:'p1',photoCount:1},{id:'cb',uid:'b',placeId:'p2',photoCount:1}]);
    assert.deepEqual(query.constraints,[{where:['status','==','published']},{limit:50}]);
    return docs([{id:'post',uid:'b',placeId:null,status:'published',feeling:'<img src=x onerror=alert(1)>',photo:{objectPath:'PRIVATE_STORAGE_PATH'}}]);
  }};
  const views=createTripViews({app,api,db:{},current:context=>active && context===expectedContext,getUser:()=>({uid:'a'}),track:(name,params)=>events.push({name,params}),activate:()=>activated++});
  const open=tab=>{expectedContext={groupId:'g',tripId:'t',tab,placeId:'p1'};return views.open(expectedContext,{title:'그룹',isOwner:owner});};
  return {app,api,open,calls,events,deactivate:()=>{active=false;},activated:()=>activated};
}
test('closed trips retain all four routes and personal progress without write controls',async()=>{
  const f=fixture({closed:true});
  for(const tab of TRIP_TABS){
    await f.open(tab);
    assert.match(f.app.innerHTML,/aria-label="여행 화면"/);
    for(const label of ['지도','코스','스탬프','추억'])assert.ok(f.app.innerHTML.includes(label));
    assert.match(f.app.innerHTML,/종료된 여행/);assert.doesNotMatch(f.app.innerHTML,/<form|data-v2-action|data-trip-action/);
    assert.doesNotMatch(f.app.innerHTML,/>여행 관리<|\/manage/);
    if(tab==='stamps')assert.match(f.app.innerHTML,/내 스탬프 1\/2/);
  }
  assert.equal(f.activated(),4);
  assert.deepEqual(f.events.map(e=>e.params.screen_name),TRIP_TABS);
  assert.ok(f.events.every(e=>e.name==='screen_view' && e.params.trip_status==='ended'));
  assert.match(f.app.innerHTML,/&lt;img/);assert.doesNotMatch(f.app.innerHTML,/<img|PRIVATE_STORAGE_PATH/);
});
test('closed leader direct management route returns read-only map without management actions',async()=>{
  const f=fixture({closed:true});await f.open('manage');
  assert.match(f.app.innerHTML,/여행 지도/);assert.doesNotMatch(f.app.innerHTML,/>여행 관리<|초대 링크·참여 관리/);
});
test('member DOM excludes management and direct management route does not read group details',async()=>{
  const f=fixture({owner:false});await f.open('map');
  assert.doesNotMatch(f.app.innerHTML,/>여행 관리<|\/manage/);
  f.calls.length=0;await f.open('manage');
  assert.match(f.app.innerHTML,/리더만 여행을 관리/);assert.equal(f.calls.length,0);
  assert.equal(f.events.length,1);
});
test('only open leader management includes end action',async()=>{
  const leader=fixture();await leader.open('manage');assert.match(leader.app.innerHTML,/data-trip-action="end"/);
  const closed=fixture({closed:true});await closed.open('manage');assert.doesNotMatch(closed.app.innerHTML,/data-trip-action/);
  const member=fixture({owner:false});await member.open('manage');assert.doesNotMatch(member.app.innerHTML,/data-trip-action/);
});
test('stale responses and denied reads never render a former trip',async()=>{
  const f=fixture();f.deactivate();await f.open('memory');
  assert.equal(f.app.innerHTML,'initial');assert.equal(f.activated(),0);assert.equal(f.events.length,0);
  const blocked=fixture();blocked.api.getDocsFromServer=async()=>{throw Error('permission-denied');};
  await assert.rejects(blocked.open('stamps'),/permission-denied/);assert.equal(blocked.app.innerHTML,'initial');
  const unknown=fixture();await assert.rejects(unknown.open('arbitrary'),/없는 화면/);
});
