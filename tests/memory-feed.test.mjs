import test from 'node:test';import assert from 'node:assert/strict';
import {memoryQuery,FEED_PAGE_SIZE} from '../next/memory-feed.mjs';import {createAnalytics} from '../next/analytics.mjs';
test('memory query paginates the filtered published set by server timestamp and document ID, not a local limited subset',()=>{
  const api={collection:(_,...p)=>p.join('/'),where:(...v)=>['where',...v],orderBy:(...v)=>['order',...v],documentId:()=>'__name__',startAfter:c=>['after',c],limit:n=>['limit',n],query:(...v)=>v};
  assert.deepEqual(memoryQuery(api,{}, {groupId:'g',tripId:'t'},{place:'free',person:'b'},'cursor'),['groups/g/trips/t/posts',['where','status','==','published'],['where','placeId','==',null],['where','uid','==','b'],['order','createdAt','desc'],['order','__name__','desc'],['after','cursor'],['limit',FEED_PAGE_SIZE]]);
});
test('T9 Analytics accepts only declared booleans/buckets and strips names, UID, text, photo and filter identifiers',async()=>{
  const events=[],sdk={isSupported:async()=>true,initializeAnalytics:()=>({}),logEvent:(_,name,params)=>events.push({name,params})};
  const analytics=await createAnalytics({app:{},config:{firebaseConfig:{measurementId:'G-EXAMPLE'}},location:'https://example.test/next/#private-route',loadSdk:async()=>sdk});
  const unsafe={uid:'private-uid',feeling:'private-text',photo:'private-photo',place_id:'private-place',member_id:'private-member',displayName:'private-name'};
  analytics.track('free_post_create',{...unsafe,has_line:true});analytics.track('post_delete',{...unsafe,was_stamp:false});analytics.track('feed_view',{...unsafe,post_count_bucket:'4-6'});
  analytics.track('feed_view',{post_count_bucket:999});analytics.track('post_delete',{was_stamp:'true'});
  assert.equal(events.length,3);assert.doesNotMatch(JSON.stringify(events),/private|999/);assert.deepEqual(events.map(e=>e.name),['free_post_create','post_delete','feed_view']);
});
