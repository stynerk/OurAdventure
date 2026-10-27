const FORMATS=Object.freeze({feed:{width:1080,height:1350},story:{width:1080,height:1920}});
const TEMPLATES=['grid','board'];
const time=value=>(value?.seconds||0)*1000+(value?.nanoseconds||0)/1e6;
function buildReport(trip,members,places,posts){
  const ordered=(trip.placeIds||[]).map(id=>places.find(p=>p.id===id)).filter(Boolean);
  const allowed=new Set(ordered.map(p=>p.id)),names=new Map(members.map(m=>[m.id,m.displayName||'멤버']));
  const published=posts.filter(p=>p.status==='published').sort((a,b)=>time(b.createdAt)-time(a.createdAt)||b.id.localeCompare(a.id));
  const photos=published.map(p=>({id:p.id,uid:p.uid,alias:names.get(p.uid)||'멤버',placeId:p.placeId||null,feeling:p.feeling||'',photo:{objectPath:p.photo?.objectPath||'',generation:p.photo?.generation||'',contentType:p.photo?.contentType||'',size:p.photo?.size||0}}));
  const rows=[...members].sort((a,b)=>(b.role==='owner')-(a.role==='owner')||time(a.joinedAt)-time(b.joinedAt)||a.id.localeCompare(b.id)).map(m=>{
    const done=new Set(photos.filter(p=>p.uid===m.id && allowed.has(p.placeId)).map(p=>p.placeId));
    return {uid:m.id,alias:names.get(m.id),stampIndices:ordered.flatMap((p,index)=>done.has(p.id)?[index+1]:[]),stampCount:done.size};
  });
  return {title:trip.title,startDate:trip.startDate,endDate:trip.endDate,days:Math.round((Date.parse(trip.endDate)-Date.parse(trip.startDate))/86400000)+1,placeCount:ordered.length,photoCount:photos.length,stampCount:rows.reduce((n,m)=>n+m.stampCount,0),stampTotal:rows.length*ordered.length,members:rows,places:ordered.map(p=>({id:p.id,name:p.name,representative:photos.find(photo=>photo.placeId===p.id)||null})),photos,lines:photos.filter(p=>p.feeling).map(p=>({postId:p.id,alias:p.alias,feeling:p.feeling,placeId:p.placeId}))};
}
function createReportService({db,HttpsError,tripContext,tripRef,coordinates,uidOf,requestId,id,now,hash}){
  const fail=(code,message)=>{throw new HttpsError(code,message);};
  const ended=trip=>{if(trip.status!=='closed')fail('failed-precondition','여행을 종료하면 결과를 볼 수 있어요.');};
  async function read(tx,g,t,trip){
    const [members,places,posts]=await Promise.all([tx.get(db.collection(`groups/${g}/members`)),tx.get(tripRef(g,t).collection('places')),tx.get(tripRef(g,t).collection('posts').where('status','==','published'))]);
    const rows=snap=>snap.docs.map(d=>({id:d.id,...d.data()}));return buildReport(trip,rows(members),rows(places),rows(posts));
  }
  return {
    async getTripReport(data,auth){
      const uid=uidOf(auth),{g,t}=coordinates(data);
      return db.runTransaction(async tx=>{const trip=await tripContext(tx,g,t,uid);ended(trip);return read(tx,g,t,trip);});
    },
    async configureShareImage(data,auth){
      const uid=uidOf(auth),{g,t}=coordinates(data),request=requestId(data);
      return db.runTransaction(async tx=>{
        const trip=await tripContext(tx,g,t,uid,true);ended(trip);
        const format=data?.format,template=data?.template;
        if(!Object.hasOwn(FORMATS,format) || !TEMPLATES.includes(template))fail('invalid-argument','이미지 크기와 템플릿을 확인해주세요.');
        if(!Array.isArray(data?.postIds) || data.postIds.length<1 || data.postIds.length>6 || new Set(data.postIds).size!==data.postIds.length)fail('invalid-argument','사진을 1~6장 골라주세요.');
        if(data.includeTripTitle!==undefined && typeof data.includeTripTitle!=='boolean')fail('invalid-argument','여행 이름 표시 여부를 확인해주세요.');
        const includeTripTitle=data.includeTripTitle===true;
        const postIds=data.postIds.map(value=>id(value,'사진 기록 ID')),fingerprint=hash(includeTripTitle?[1,format,template,postIds,true]:[1,format,template,postIds]);
        const ref=tripRef(g,t).collection('shareImages').doc(hash([uid,request])),saved=await tx.get(ref),report=await read(tx,g,t,trip);
        const selected=postIds.map(postId=>report.photos.find(p=>p.id===postId));
        if(selected.some(p=>!p))fail('failed-precondition','확정된 사진을 다시 선택해주세요.');
        if(saved.exists){
          const prior=saved.data();if(prior.fingerprint!==fingerprint)fail('failed-precondition','동일 요청의 구성이 달라졌어요.');
          if(selected.some((p,i)=>p.photo.objectPath!==prior.config.photos[i].photo.objectPath || p.photo.generation!==prior.config.photos[i].photo.generation))fail('failed-precondition','사진이 바뀌었어요. 다시 미리보기를 만들어주세요.');
          return {...prior.config,configId:ref.id,replayed:true};
        }
        // Trip title is server-sourced and exported only after explicit leader opt-in.
        const config={version:1,format,template,...FORMATS[format],includeTripTitle,...(includeTripTitle?{tripTitle:trip.title}:{}),placeCount:report.placeCount,stampCount:report.stampCount,stampTotal:report.stampTotal,members:report.members.map(m=>({alias:m.alias,stampIndices:m.stampIndices})),photos:selected.map(p=>({id:p.id,alias:p.alias,photo:p.photo}))};
        tx.create(ref,{uid,fingerprint,config,createdAt:now()});return {...config,configId:ref.id,replayed:false};
      });
    }
  };
}
module.exports={createReportService,buildReport,FORMATS};
