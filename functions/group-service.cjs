const {createHash,randomBytes} = require('node:crypto');
const {createReportService}=require('./report-service.cjs');

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const LIMITS = Object.freeze({members:10, places:10, feeling:60});

// V2 lives beside the legacy rooms collection. No legacy records are read or migrated.
// Auth is provided by onCall; no client-supplied owner/uid/completion is trusted.
function createGroupService(db, {HttpsError, FieldValue, deletePhoto=async()=>{}, verifyPhoto = async () => {
  throw new HttpsError('failed-precondition', '사진 저장 연결이 아직 준비되지 않았어요.');
}}) {
  const fail = (code, message) => {throw new HttpsError(code,message);};
  const text = (value,max,label,optional=false) => {
    if(optional && (value === undefined || value === ''))return '';
    if(typeof value !== 'string' || !value.trim() || [...value.trim()].length>max || /[\u0000-\u001f]/.test(value))
      fail('invalid-argument',`${label}을 확인해주세요.`);
    return value.trim();
  };
  const id = (value,label) => {
    if(typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value))fail('invalid-argument',`${label}을 확인해주세요.`);
    return value;
  };
  const uidOf = auth => auth?.uid || fail('unauthenticated','인증 세션이 필요해요.');
  const google = auth => {
    const uid=uidOf(auth);
    if(auth.token?.firebase?.sign_in_provider!=='google.com')fail('permission-denied','그룹과 여행 생성에는 Google 로그인이 필요해요.');
    return uid;
  };
  const requestId = data => {
    const value=id(data?.requestId,'요청 ID');
    if(value.length<16)fail('invalid-argument','요청 ID를 확인해주세요.');
    return value;
  };
  const groupRef = g => db.doc(`groups/${g}`);
  const tripRef = (g,t) => db.doc(`groups/${g}/trips/${t}`);
  const placeRef = (g,t,p) => tripRef(g,t).collection('places').doc(p);
  const now = () => FieldValue.serverTimestamp();
  const date = value => {
    if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))fail('invalid-argument','여행 날짜를 확인해주세요.');
    const parsed=new Date(value+'T00:00:00Z');
    if(!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==value)fail('invalid-argument','여행 날짜를 확인해주세요.');
    return value;
  };
  const placeInput = value => ({
    name:text(value?.name,100,'장소 이름'),
    icon:value?.icon===undefined?'📍':text(value.icon,20,'스탬프 아이콘')
  });
  async function groupContext(tx,g,uid,owner=false) {
    const [gs,ms]=await tx.getAll(groupRef(g),groupRef(g).collection('members').doc(uid));
    if(!gs.exists || !ms.exists)fail('permission-denied','이 그룹의 구성원이 아니에요.');
    if(owner && (gs.data().ownerId!==uid || ms.data().role!=='owner'))fail('permission-denied','리더만 사용할 수 있어요.');
    return gs.data();
  }
  async function tripContext(tx,g,t,uid,owner=false) {
    await groupContext(tx,g,uid,owner);
    const snapshot=await tx.get(tripRef(g,t));
    if(!snapshot.exists)fail('not-found','여행을 찾지 못했어요.');
    return snapshot.data();
  }
  const open = trip => {if(trip.status!=='open')throw new HttpsError('failed-precondition','종료된 여행은 읽기만 할 수 있어요.',{reason:'ended'});};
  const coordinates = data => ({g:id(data?.groupId,'그룹 ID'),t:id(data?.tripId,'여행 ID')});
  async function placeImpact(tx,g,t,p,uid) {
    const trip=await tripContext(tx,g,t,uid,true);open(trip);
    const snapshot=await tx.get(placeRef(g,t,p));
    if(!snapshot.exists)fail('not-found','장소를 찾지 못했어요.');
    const place=snapshot.data();
    if(place.status==='deleted')return {trip,place,deleted:true};
    if(!trip.placeIds.includes(p))fail('not-found','이 여행에 없는 장소예요.');
    const posts=await tx.get(tripRef(g,t).collection('posts').where('placeId','==',p));
    const published=posts.docs.filter(d=>d.data().status==='published');
    if(published.length!==place.postCount)fail('failed-precondition','사진 수를 확인하지 못했어요. 다시 확인해주세요.');
    return {trip,place,photoCount:published.length,memberCount:new Set(published.map(d=>d.data().uid)).size,
      confirmationToken:hash(['remove-place',uid,g,t,p,published.map(d=>d.id).sort()])};
  }
  const tokenHash = token => typeof token==='string' && /^[A-Za-z0-9_-]{43}$/.test(token)?hash(['group-invite',token]):null;
  async function inviteContext(tx,key,uid) {
    if(!key)return null;
    const invite=await tx.get(db.doc(`v2Invites/${key}`));
    if(!invite.exists)return null;
    const g=invite.data().groupId;
    const [group,member,secret]=await tx.getAll(groupRef(g),groupRef(g).collection('members').doc(uid),db.doc(`v2GroupSecrets/${g}`));
    if(!group.exists || !secret.exists || secret.data().inviteHash!==key)return null;
    return {g,group:group.data(),member:member.exists?member.data():null};
  }

  const callables = {
    async previewTripPlaceRemoval(data,auth) {
      const uid=uidOf(auth),{g,t}=coordinates(data),p=id(data?.placeId,'장소 ID');
      return db.runTransaction(async tx=>{
        const impact=await placeImpact(tx,g,t,p,uid);
        if(impact.deleted)return {placeId:p,deleted:true};
        return {placeId:p,name:impact.place.name,photoCount:impact.photoCount,memberCount:impact.memberCount,confirmationToken:impact.confirmationToken};
      });
    },
    async removeTripPlace(data,auth) {
      const uid=uidOf(auth),{g,t}=coordinates(data),p=id(data?.placeId,'장소 ID');
      return db.runTransaction(async tx=>{
        const impact=await placeImpact(tx,g,t,p,uid);
        if(impact.deleted)return {placeId:p,replayed:true};
        if(impact.photoCount && data?.confirmationToken!==impact.confirmationToken)
          throw new HttpsError('failed-precondition','사진이 남아 있어요. 최신 영향을 확인한 뒤 삭제해주세요.',{reason:'confirmation-required'});
        // Remove the course association, not another author's photos or feelings.
        // Keep a tombstone so authors can still delete their own retained posts.
        const ids=impact.trip.placeIds.filter(value=>value!==p);
        tx.update(placeRef(g,t,p),{status:'deleted',deletedAt:now(),deletedBy:uid});
        tx.update(tripRef(g,t),{placeIds:ids,placeCount:ids.length});
        return {placeId:p,replayed:false};
      });
    },
    ...createReportService({db,HttpsError,tripContext,tripRef,coordinates,uidOf,requestId,id,now,hash}),
    async editPost(data,auth) {
      const uid=uidOf(auth),{g,t}=coordinates(data),postId=id(data?.postId,'기록 ID'),request=requestId(data);
      const feeling=text(data?.feeling,LIMITS.feeling,'한 줄 느낌',true),revision=data?.revision;
      if(!Number.isSafeInteger(revision) || revision<0)fail('invalid-argument','기록 버전을 확인해주세요.');
      const ref=tripRef(g,t).collection('posts').doc(postId),replay=db.doc(`v2Requests/${hash(['edit-post',uid,g,t,postId,request])}`),fingerprint=hash([feeling,revision]);
      return db.runTransaction(async tx=>{
        const trip=await tripContext(tx,g,t,uid),[post,saved]=await tx.getAll(ref,replay);
        if(!post.exists)fail('not-found','기록을 찾지 못했어요.');
        if(post.data().uid!==uid)fail('permission-denied','본인 기록만 바꿀 수 있어요.');
        open(trip);
        if(saved.exists){if(saved.data().fingerprint!==fingerprint)fail('failed-precondition','동일 요청의 내용이 달라졌어요.');return {...saved.data().result,replayed:true};}
        if(post.data().status!=='published')fail('failed-precondition','삭제된 기록이에요.');
        if((post.data().revision||0)!==revision)fail('aborted','다른 화면에서 바뀐 기록이에요. 새로 확인해주세요.');
        const result={postId,revision:revision+1};
        tx.update(ref,{feeling,revision:revision+1,updatedAt:now()});tx.create(replay,{uid,fingerprint,result,createdAt:now()});
        return {...result,replayed:false};
      });
    },
    async deletePost(data,auth) {
      const uid=uidOf(auth),{g,t}=coordinates(data),postId=id(data?.postId,'기록 ID'),ref=tripRef(g,t).collection('posts').doc(postId);
      const outcome=await db.runTransaction(async tx=>{
        const trip=await tripContext(tx,g,t,uid),post=await tx.get(ref);
        if(!post.exists)fail('not-found','기록을 찾지 못했어요.');
        const record=post.data();if(record.uid!==uid)fail('permission-denied','본인 기록만 지울 수 있어요.');
        open(trip);
        if(record.status==='deleted')return {...record.deleteResult,photo:record.photo,replayed:true};
        if(record.status!=='published')fail('failed-precondition','확정된 기록만 지울 수 있어요.');
        const p=record.placeId,completionRef=p?tripRef(g,t).collection('completions').doc(hash([uid,p])):null;
        const [place,completion]=p?await tx.getAll(placeRef(g,t,p),completionRef):[null,null];
        if(trip.postCount<1 || (p && (!place.exists || place.data().postCount<1 || !completion.exists || completion.data().photoCount<1)))fail('failed-precondition','기록 수를 확인하지 못했어요.');
        const result={postId,wasStamp:!!p,stampRemoved:!!p && completion.data().photoCount===1,postCount:trip.postCount-1};
        const uploadId=record.photo.objectPath.split('/').at(-1);
        tx.set(tripRef(g,t).collection('uploads').doc(uid).collection('items').doc(uploadId),{uid,status:'deleted',postId,deletedAt:now()});
        tx.update(ref,{status:'deleted',feeling:FieldValue.delete(),deletedAt:now(),deleteResult:result});
        tx.update(tripRef(g,t),{postCount:trip.postCount-1});
        if(p){tx.update(placeRef(g,t,p),{postCount:place.data().postCount-1});if(result.stampRemoved)tx.delete(completionRef);else tx.update(completionRef,{photoCount:completion.data().photoCount-1,updatedAt:now()});}
        return {...result,photo:record.photo,replayed:false};
      });
      // Revocation/counts commit first. Storage failure cannot resurrect the post.
      let cleanupPending=false;try{await deletePhoto(outcome.photo);}catch{cleanupPending=true;}
      const {photo,...result}=outcome;return {...result,cleanupPending};
    },
    async finalizePhoto(data,auth) {
      const uid=uidOf(auth),{g,t}=coordinates(data);
      await db.runTransaction(tx=>tripContext(tx,g,t,uid));
      return finalizeVerifiedPost(data,auth);
    },
    async endTrip(data,auth) {
      const uid=uidOf(auth),{g,t}=coordinates(data);
      return db.runTransaction(async tx=>{
        const trip=await tripContext(tx,g,t,uid,true);
        if(trip.status==='closed')return {groupId:g,tripId:t,status:'closed',replayed:true};
        open(trip);
        tx.update(tripRef(g,t),{status:'closed',closedAt:now(),closedBy:uid});
        return {groupId:g,tripId:t,status:'closed',replayed:false};
      });
    },
    async createGroupInvite(data,auth) {
      const uid=google(auth),g=id(data?.groupId,'그룹 ID'),token=randomBytes(32).toString('base64url'),key=tokenHash(token);
      await db.runTransaction(async tx=>{
        await groupContext(tx,g,uid,true);
        const secretRef=db.doc(`v2GroupSecrets/${g}`),prior=await tx.get(secretRef);
        if(prior.exists)tx.delete(db.doc(`v2Invites/${prior.data().inviteHash}`));
        tx.create(db.doc(`v2Invites/${key}`),{groupId:g,createdAt:now()});
        tx.set(secretRef,{inviteHash:key,createdAt:now()});
      });
      return {token};
    },
    async previewGroupInvite(data,auth) {
      const uid=uidOf(auth),key=tokenHash(data?.token);
      return db.runTransaction(async tx=>{
        const context=await inviteContext(tx,key,uid);
        if(!context)return {state:'invalid'};
        if(context.member)return {state:'member',groupId:context.g};
        if(context.group.memberCount>=LIMITS.members || context.group.memberIds.length>=LIMITS.members)return {state:'full'};
        // Only a valid non-full invitation may reveal its group introduction.
        return {state:'ready',title:context.group.title};
      });
    },
    async joinGroup(data,auth) {
      const uid=uidOf(auth),key=tokenHash(data?.token),nickname=text(data?.nickname,24,'별칭');
      return db.runTransaction(async tx=>{
        const context=await inviteContext(tx,key,uid);
        if(!context)fail('not-found','유효하지 않은 초대 링크예요. 리더에게 새 링크를 요청해주세요.');
        const {g,group,member}=context;
        if(member)return {groupId:g,replayed:true};
        if(group.memberCount>=LIMITS.members || group.memberIds.length>=LIMITS.members)fail('resource-exhausted','그룹 정원 10명이 모두 찼어요. 리더에게 문의해주세요.');
        if(group.memberCount!==group.memberIds.length || group.memberIds.includes(uid))fail('failed-precondition','참여 상태를 확인하지 못했어요. 리더에게 문의해주세요.');
        tx.create(groupRef(g).collection('members').doc(uid),{role:'member',displayName:nickname,joinedAt:now()});
        tx.update(groupRef(g),{memberIds:[...group.memberIds,uid],memberCount:group.memberCount+1});
        return {groupId:g,replayed:false};
      });
    },
    async createGroup(data,auth) {
      const uid=google(auth),title=text(data?.title,60,'그룹 이름'),request=requestId(data);
      const replayRef=db.doc(`v2Requests/${hash(['group',uid,request])}`),fingerprint=hash([title]);
      const ref=db.collection('groups').doc();
      return db.runTransaction(async tx=>{
        const saved=await tx.get(replayRef);
        if(saved.exists) {
          if(saved.data().fingerprint!==fingerprint)fail('failed-precondition','동일 요청의 내용이 달라졌어요.');
          await groupContext(tx,saved.data().groupId,uid,true);
          return {groupId:saved.data().groupId,replayed:true};
        }
        tx.create(ref,{schemaVersion:2,title,ownerId:uid,memberIds:[uid],memberCount:1,capacity:LIMITS.members,createdAt:now()});
        tx.create(ref.collection('members').doc(uid),{role:'owner',displayName:'리더',joinedAt:now()});
        tx.create(replayRef,{uid,fingerprint,groupId:ref.id,createdAt:now()});
        return {groupId:ref.id,replayed:false};
      });
    },
    async createTrip(data,auth) {
      const uid=google(auth),g=id(data?.groupId,'그룹 ID'),request=requestId(data);
      const title=text(data?.title,80,'여행 이름'),destination=text(data?.destination,100,'목적지');
      const startDate=date(data?.startDate),endDate=date(data?.endDate);
      if(endDate<startDate)fail('invalid-argument','종료 날짜는 시작 날짜보다 빠를 수 없어요.');
      if(!Array.isArray(data?.places) || data.places.length>LIMITS.places)fail('invalid-argument','장소 목록을 확인해주세요.');
      const places=data.places.map(placeInput);
      const fingerprint=hash([title,destination,startDate,endDate,places]);
      const replayRef=db.doc(`v2Requests/${hash(['trip',uid,g,request])}`),ref=groupRef(g).collection('trips').doc();
      const refs=places.map(()=>ref.collection('places').doc());
      return db.runTransaction(async tx=>{
        await groupContext(tx,g,uid,true);
        const saved=await tx.get(replayRef);
        if(saved.exists) {
          if(saved.data().fingerprint!==fingerprint)fail('failed-precondition','동일 요청의 내용이 달라졌어요.');
          return {groupId:g,tripId:saved.data().tripId,replayed:true};
        }
        tx.create(ref,{schemaVersion:2,title,destination,startDate,endDate,status:'open',createdBy:uid,
          placeIds:refs.map(p=>p.id),placeCount:places.length,postCount:0,createdAt:now(),closedAt:null});
        places.forEach((p,i)=>tx.create(refs[i],{...p,postCount:0,createdAt:now()}));
        tx.create(replayRef,{uid,fingerprint,groupId:g,tripId:ref.id,createdAt:now()});
        return {groupId:g,tripId:ref.id,replayed:false};
      });
    },
    async addTripPlace(data,auth) {
      const uid=uidOf(auth),{g,t}=coordinates(data),request=requestId(data),place=placeInput(data?.place);
      const replayRef=db.doc(`v2Requests/${hash(['place',uid,g,t,request])}`),fingerprint=hash(place);
      const ref=tripRef(g,t).collection('places').doc();
      return db.runTransaction(async tx=>{
        const trip=await tripContext(tx,g,t,uid,true),saved=await tx.get(replayRef);
        if(saved.exists) {
          if(saved.data().fingerprint!==fingerprint)fail('failed-precondition','동일 요청의 내용이 달라졌어요.');
          return {placeId:saved.data().placeId,replayed:true};
        }
        open(trip);
        if(trip.placeIds.length>=LIMITS.places)fail('resource-exhausted','한 여행에 장소는 최대 10개예요.');
        tx.create(ref,{...place,postCount:0,createdAt:now()});
        tx.update(tripRef(g,t),{placeIds:[...trip.placeIds,ref.id],placeCount:trip.placeIds.length+1});
        tx.create(replayRef,{uid,fingerprint,groupId:g,tripId:t,placeId:ref.id,createdAt:now()});
        return {placeId:ref.id,replayed:false};
      });
    }
  };

  // The exported finalizePhoto wrapper always uses the injected server Storage verifier.
  // Client `verified:true`, photo paths, uid and content claims are ignored.
  async function finalizeVerifiedPost(data,auth) {
    const uid=uidOf(auth),{g,t}=coordinates(data),request=requestId(data);
    const p=data?.placeId==null?null:id(data.placeId,'장소 ID');
    const feeling=text(data?.feeling,LIMITS.feeling,'한 줄 느낌',true);
    const verified=await verifyPhoto({groupId:g,tripId:t,uid,uploadId:data?.uploadId});
    const prefix=`groups/${g}/trips/${t}/uploads/${uid}/`;
    if(!verified || typeof verified.objectPath!=='string' || !verified.objectPath.startsWith(prefix) ||
      !/^image\//.test(verified.contentType||'') || !Number.isFinite(verified.size) || verified.size<=0)
      fail('failed-precondition','저장된 사진을 확인하지 못했어요.');
    const postRef=tripRef(g,t).collection('posts').doc(hash([uid,request]));
    const claimRef=db.doc(`v2MediaClaims/${hash(verified.objectPath)}`);
    const completionRef=p?tripRef(g,t).collection('completions').doc(hash([uid,p])):null;
    const fingerprint=hash([uid,p,feeling,verified.objectPath]);
    return db.runTransaction(async tx=>{
      const trip=await tripContext(tx,g,t,uid);
      const existing=await tx.get(postRef);
      if(existing.exists) {
        if(existing.data().fingerprint!==fingerprint)fail('failed-precondition','동일 요청의 내용이 달라졌어요.');
        if(existing.data().status!=='published')fail('failed-precondition','삭제된 기록은 다시 저장할 수 없어요.');
          return {postId:postRef.id,completed:!!p,...existing.data().completionResult,replayed:true};
      }
      open(trip);
      const claim=await tx.get(claimRef);
      if(claim.exists)fail('already-exists','이미 기록한 사진이에요.');
      let place,completion;
      if(p) {
        if(!trip.placeIds.includes(p))fail('invalid-argument','이 여행에 없는 장소예요.');
        const snapshots=await tx.getAll(placeRef(g,t,p),completionRef);
        if(!snapshots[0].exists)fail('invalid-argument','이 여행에 없는 장소예요.');
        place=snapshots[0].data();completion=snapshots[1].exists?snapshots[1].data():null;
      }
      const mine=p?await tx.get(tripRef(g,t).collection('completions').where('uid','==',uid)):null;
      const activeDone=mine?mine.docs.filter(d=>trip.placeIds.includes(d.data().placeId) && d.data().photoCount>0).length:0;
      const completionResult={newCompletion:!!p && !completion,stampsDone:p?activeDone+(completion?0:1):0,stampsTotal:trip.placeIds.length,postCount:trip.postCount+1};
      const uploadId=id(data?.uploadId,'사진 ID');
      tx.create(tripRef(g,t).collection('uploads').doc(uid).collection('items').doc(uploadId),{uid,status:'published',postId:postRef.id,createdAt:now()});
      tx.create(postRef,{uid,placeId:p,feeling,status:'published',revision:0,fingerprint,completionResult,
        photo:{objectPath:verified.objectPath,contentType:verified.contentType,size:verified.size,generation:verified.generation||''},createdAt:now()});
      tx.create(claimRef,{groupId:g,tripId:t,uid,postId:postRef.id,createdAt:now()});
      tx.update(tripRef(g,t),{postCount:trip.postCount+1});
      if(p) {
        tx.set(completionRef,{uid,placeId:p,photoCount:(completion?.photoCount||0)+1,completedAt:completion?.completedAt||now(),updatedAt:now()});
        tx.update(placeRef(g,t,p),{postCount:place.postCount+1});
      }
      return {postId:postRef.id,completed:!!p,...completionResult,replayed:false};
    });
  }
  return {callables,finalizeVerifiedPost};
}

module.exports={createGroupService,LIMITS};
