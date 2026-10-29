import assert from 'node:assert/strict';
import {auditUi} from './ui-audit.mjs';
export async function verifyPlaceEditing({owner,peer,db,groupId,origin,ownerUid,peerUid,image}){
  const invoke=(page,name,data)=>page.evaluate(async({name,data})=>{
    const sdk=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js');
    try{return {data:(await sdk.httpsCallable(sdk.getFunctions(undefined,'asia-northeast3'),name)(data)).data};}catch(error){return {code:error.code,details:error.details};}
  },{name,data});
  const created=await invoke(owner,'createTrip',{groupId,requestId:crypto.randomUUID(),title:'코스를 함께 다듬는 여행',destination:'경주',startDate:'2026-10-28',endDate:'2026-10-29',places:[{name:'왕의 언덕'},{name:'별빛 전망대'}]});
  assert.ok(created.data,JSON.stringify(created));const tripId=created.data.tripId,root=`groups/${groupId}/trips/${tripId}`,base=origin+`#trip/${groupId}/${tripId}`,[p,q]=(await db.doc(root).get()).data().placeIds;
  async function publish(page,placeId){
    return page.evaluate(async({groupId,tripId,placeId,bytes})=>{
      const storage=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js'),functions=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-functions.js'),auth=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');
      const uploadId=crypto.randomUUID(),uid=auth.getAuth().currentUser.uid,path=`groups/${groupId}/trips/${tripId}/uploads/${uid}/${uploadId}`;
      await storage.uploadString(storage.ref(storage.getStorage(),path),bytes,'base64',{contentType:'image/png'});
      return (await functions.httpsCallable(functions.getFunctions(undefined,'asia-northeast3'),'finalizePhoto')({groupId,tripId,placeId,uploadId,requestId:crypto.randomUUID(),feeling:'함께 남긴 발견'})).data;
    },{groupId,tripId,placeId,bytes:image.buffer.toString('base64')});
  }
  await publish(owner,p);await publish(peer,p);await publish(peer,p);await publish(owner,q);
  await peer.goto(base+'/stamps');await peer.getByRole('heading',{name:'내 스탬프 1/2',exact:true}).waitFor();
  await owner.goto(base+'/course');await owner.getByRole('button',{name:'장소 추가',exact:true}).click();
  await owner.getByLabel('장소 이름',{exact:true}).fill('숲길 쉼터');
  await auditUi(owner,'place-add');
  let release,seen;const gate=new Promise(resolve=>{release=resolve;}),committed=new Promise(resolve=>{seen=resolve;}),requests=[];
  await owner.route('**/addTripPlace',async route=>{
    if(route.request().method()!=='POST'){await route.continue();return;}
    requests.push(route.request().postDataJSON().data);await route.fetch();seen();await gate;await route.abort('failed');
  });
  await owner.getByRole('button',{name:'장소 추가하기',exact:true}).click();await committed;
  await owner.locator('#trip-place-add').evaluate(form=>{for(let i=0;i<3;i++)form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(requests.length,1);await peer.getByRole('heading',{name:'내 스탬프 1/3',exact:true}).waitFor();release();
  await owner.getByRole('button',{name:'같은 장소 다시 추가',exact:true}).waitFor();
  await owner.unroute('**/addTripPlace');await owner.reload();await owner.getByRole('button',{name:'장소 추가',exact:true}).click();
  assert.equal(await owner.getByLabel('장소 이름',{exact:true}).inputValue(),'숲길 쉼터');
  await owner.getByRole('button',{name:'같은 장소 다시 추가',exact:true}).click();
  await owner.locator('.place-dialog').waitFor({state:'detached'});
  assert.equal((await db.doc(root).get()).data().placeCount,3);
  await owner.getByRole('link',{name:'스탬프',exact:true}).click();await owner.getByRole('heading',{name:'내 스탬프 2/3',exact:true}).waitFor();
  assert.equal((await db.collection(root+'/completions').where('uid','==',peerUid).get()).size,1);
  // Empty place removes immediately, with no confirmation dialog.
  await owner.getByRole('link',{name:'코스',exact:true}).click();await owner.getByRole('button',{name:'숲길 쉼터 장소 삭제',exact:true}).click();
  await peer.getByRole('heading',{name:'내 스탬프 1/2',exact:true}).waitFor();
  assert.equal(await owner.locator('.place-dialog').count(),0);
  await owner.getByRole('button',{name:'왕의 언덕 장소 삭제',exact:true}).click();
  await owner.getByText('2명이 남긴 사진 3장에 연결된 장소예요.',{exact:true}).waitFor();
  await auditUi(owner,'place-delete');
  await owner.getByRole('button',{name:'취소',exact:true}).click();assert.equal((await db.doc(root).get()).data().placeCount,2);
  await owner.getByRole('button',{name:'왕의 언덕 장소 삭제',exact:true}).click();
  await owner.getByText('2명이 남긴 사진 3장에 연결된 장소예요.',{exact:true}).waitFor();
  await publish(peer,p);
  await owner.getByRole('button',{name:'장소 삭제',exact:true}).click();
  await owner.getByText('사진이 바뀌었어요. 최신 영향을 다시 확인해주세요.',{exact:true}).waitFor();
  await owner.getByText('2명이 남긴 사진 4장에 연결된 장소예요.',{exact:true}).waitFor();
  assert.equal((await db.doc(root).get()).data().placeCount,2);
  await owner.getByRole('button',{name:'장소 삭제',exact:true}).click();await owner.locator('.place-dialog').waitFor({state:'detached'});
  await peer.getByRole('heading',{name:'내 스탬프 0/1',exact:true}).waitFor();
  assert.deepEqual((await db.doc(root).get()).data().placeIds,[q]);assert.equal((await db.doc(root).get()).data().postCount,5);
  await owner.getByRole('link',{name:'스탬프',exact:true}).click();await owner.getByRole('heading',{name:'내 스탬프 1/1',exact:true}).waitFor();
  const stampColor=await owner.locator('.clay-seal').evaluate(n=>getComputedStyle(n).backgroundColor);
  await owner.getByRole('link',{name:'지도',exact:true}).click();await owner.getByRole('heading',{name:'여행 지도',exact:true}).waitFor();
  assert.equal(await owner.locator('.map-pin.is-done .map-pin-dot').evaluate(n=>getComputedStyle(n).backgroundColor),stampColor);
  for(const width of [320,375,390]){await owner.setViewportSize({width,height:844});const sun=await owner.locator('.map-sun').boundingBox();assert.ok(Math.abs(sun.width-sun.height)<0.05,`Sun is distorted at ${width}px: ${sun.width} × ${sun.height}`);}
  await owner.screenshot({path:'test-results/ui-refresh/place-map-390.png',fullPage:true});
  await owner.getByRole('link',{name:'추억',exact:true}).click();await owner.waitForFunction(()=>document.querySelectorAll('.memory-photo img').length===5);
  assert.equal(await owner.getByText('삭제된 장소',{exact:true}).count(),4);
  assert.equal((await invoke(peer,'removeTripPlace',{groupId,tripId,placeId:q})).code,'functions/permission-denied');
  await invoke(owner,'endTrip',{groupId,tripId});
  for(const page of [owner,peer]){await page.goto(base+'/course');await page.getByRole('heading',{name:'여행 코스',exact:true}).waitFor();assert.equal(await page.locator('[data-place-action]').count(),0);}
  console.log('PASS T15 AC-2c: leader adds once across response loss/reload, member stamp board updates live, prior personal completions remain');
  console.log('PASS T15 AC-2d: empty removal immediate; 2-author/3-photo impact, cancel, stale impact re-confirmation, retained photos and ended/member controls verified');
  console.log('PASS T15: forced disabled place submits ignored; map sun remains circular and completed pin matches its stamp color');
}
