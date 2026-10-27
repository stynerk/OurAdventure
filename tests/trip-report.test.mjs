import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {imageLayout,renderShareImage,SHARE_FORMATS} from '../next/share-renderer.mjs';import {createAnalytics} from '../next/analytics.mjs';
import {verifiedPhotoBlob} from '../next/report-views.mjs';
const require=createRequire(import.meta.url),{buildReport}=require('../functions/report-service.cjs');
test('report counts all published photos but one stamp per member/place, with newest representative and optional lines',()=>{
  const report=buildReport({title:'여행',startDate:'2026-10-28',endDate:'2026-10-30',placeIds:['p2','p1']},[{id:'a',displayName:'같은 별칭',role:'owner'},{id:'b',displayName:'같은 별칭'}],[{id:'p1',name:'첫 장소'},{id:'p2',name:'둘째 장소'}],[
    {id:'one',uid:'a',placeId:'p1',status:'published',createdAt:{seconds:1},feeling:'한 줄'},
    {id:'two',uid:'a',placeId:'p1',status:'published',createdAt:{seconds:1,nanoseconds:500},feeling:''},
    {id:'three',uid:'b',placeId:'p2',status:'published',createdAt:{seconds:2}},
    {id:'free',uid:'a',placeId:null,status:'published',createdAt:{seconds:3}},
    {id:'pending',uid:'a',placeId:'p2',status:'pending',createdAt:{seconds:4}},
    {id:'deleted',uid:'a',placeId:'p2',status:'deleted',createdAt:{seconds:5}}
  ]);
  assert.equal(report.days,3);assert.equal(report.photoCount,4);assert.equal(report.stampCount,2);assert.equal(report.stampTotal,4);assert.equal(report.lines.length,1);
  assert.equal(report.places[1].representative.id,'two');assert.deepEqual(report.members.map(m=>m.stampIndices),[[2],[1]]);assert.deepEqual(report.photos.map(p=>p.id),['free','three','two','one']);
});
const config=(format='feed',template='grid',n=3)=>({version:1,format,template,...SHARE_FORMATS[format],placeCount:10,stampCount:20,stampTotal:100,members:Array.from({length:10},(_,i)=>({alias:'탐험가 '+i,stampIndices:[1,2]})),photos:Array.from({length:n},(_,i)=>({id:'photo-'+i,alias:'별칭 '+i}))});
test('both exact export sizes and templates fit one to six selected photos and ten members within the canvas',()=>{
  for(const format of ['feed','story'])for(const template of ['grid','board'])for(let n=1;n<=6;n++){
    const plan=imageLayout(config(format,template,n));assert.equal(plan.width,1080);assert.equal(plan.height,format==='feed'?1350:1920);assert.equal(plan.photos.length,n);
    for(const tile of plan.photos){assert.ok(tile.x>=0 && tile.y>=0 && tile.w>0 && tile.h>tile.caption);assert.ok(tile.x+tile.w<=plan.width && tile.y+tile.h<plan.height);}
    if(template==='board')assert.ok(plan.boardY+30+plan.rowHeight*10<plan.footerY);
  }
});
test('renderer draws only generic text, aliases and counts; private report fields never enter PNG text',()=>{
  const text=[],draw=[],ctx={measureText:value=>({width:[...String(value)].length*10}),fillText:(...v)=>text.push(v[0]),drawImage:(...v)=>draw.push(v)};
  for(const key of ['beginPath','moveTo','arcTo','closePath','fillRect','save','clip','restore','arc','fill','lineTo','stroke'])ctx[key]=()=>{};
  const sample={...config('story','board',3),title:'PRIVATE_TRIP',destination:'PRIVATE_LOCATION',email:'PRIVATE_EMAIL',uid:'PRIVATE_UID',feeling:'PRIVATE_LINE',photos:config().photos.map(p=>({...p,objectPath:'PRIVATE_PATH'}))};
  const canvas={getContext:()=>ctx};renderShareImage(canvas,sample,new Map(sample.photos.map(p=>[p.id,{width:600,height:400}])));
  assert.equal(canvas.width,1080);assert.equal(canvas.height,1920);assert.equal(draw.length,3);assert.doesNotMatch(JSON.stringify(text),/PRIVATE|photo-/);assert.ok(text.includes('별칭 0'));
  assert.ok(text.includes('우리가 모은 도장'));assert.ok(text.includes('사진 3장 · 도장 20/100'));assert.ok(text.includes('Our Adventure'));
  assert.doesNotMatch(JSON.stringify(text),/STAMP COLLECTION|PHOTOS|STAMPS|Made together|MADE TOGETHER/);
  for(const template of ['grid','board']){
    for(const enabled of [undefined,false,true]){
      text.length=0;renderShareImage(canvas,{...sample,template,includeTripTitle:enabled,tripTitle:'선택한 여행 이름'},new Map(sample.photos.map(p=>[p.id,{width:600,height:400}])));
      assert.equal(text.includes('선택한 여행 이름'),enabled===true);assert.ok(text.includes(template==='grid'?'함께 남긴 추억':'우리가 모은 도장'));
      assert.doesNotMatch(JSON.stringify(text),/PRIVATE|Made together|MADE TOGETHER/);
    }
  }
});
test('empty selection, invalid dimensions and any missing decoded photo block rendering',()=>{
  assert.throws(()=>imageLayout(config('feed','grid',0)),/사진/);assert.throws(()=>imageLayout({...config(),height:1920}),/사진/);
  assert.throws(()=>renderShareImage({},config(),new Map()),/모두 불러와야/);
});
test('bounded Firebase Blob slices regain only the verified MIME type; size or conflicting MIME is rejected',()=>{
  const original=new Blob(['test-image-bytes'],{type:'image/png'}),sliced=original.slice(0,100);
  assert.equal(sliced.type,'');const restored=verifiedPhotoBlob(sliced,{size:original.size,contentType:'image/png'});assert.equal(restored.type,'image/png');assert.equal(restored.size,original.size);
  assert.throws(()=>verifiedPhotoBlob(sliced,{size:original.size+1,contentType:'image/png'}),/확인/);assert.throws(()=>verifiedPhotoBlob(original,{size:original.size,contentType:'image/jpeg'}),/확인/);
});
test('report/export Analytics filters IDs, aliases, text, paths and invalid raw counts',async()=>{
  const events=[],analytics=await createAnalytics({app:{},config:{firebaseConfig:{measurementId:'G-EXAMPLE'}},location:'https://example.test/next/',loadSdk:async()=>({isSupported:async()=>true,initializeAnalytics:()=>({}),logEvent:(_,name,params)=>events.push({name,params})})});
  const unsafe={alias:'PRIVATE_ALIAS',uid:'PRIVATE_UID',feeling:'PRIVATE_TEXT',objectPath:'PRIVATE_PATH',destination:'PRIVATE_LOCATION'};
  analytics.track('report_view',unsafe);analytics.track('share_image_create',{...unsafe,format:'feed',template:'grid',photo_count:'1-3'});analytics.track('share_image_save',{...unsafe,format:'story',template:'board',result:'ok'});
  analytics.track('share_image_create',{format:'feed',template:'grid',photo_count:999});analytics.track('share_image_save',{format:'feed',template:'other',result:'ok'});
  assert.equal(events.length,3);assert.doesNotMatch(JSON.stringify(events),/PRIVATE|999/);
});
