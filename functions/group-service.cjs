const {createHash,randomBytes} = require('node:crypto');

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const LIMITS = Object.freeze({members:10, places:10, feeling:60});

// V2 lives beside the legacy rooms collection. No legacy records are read or migrated.
// Auth is provided by onCall; no client-supplied owner/uid/completion is trusted.
function createGroupService(db, {HttpsError, FieldValue, verifyPhoto = async () => {
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
      const completionResult={newCompletion:!!p && !completion,stampsDone:p?mine.size+(completion?0:1):0,stampsTotal:trip.placeIds.length,postCount:trip.postCount+1};
      const uploadId=id(data?.uploadId,'사진 ID');
      tx.create(tripRef(g,t).collection('uploads').doc(uid).collection('items').doc(uploadId),{uid,status:'published',postId:postRef.id,createdAt:now()});
      tx.create(postRef,{uid,placeId:p,feeling,status:'published',fingerprint,completionResult,
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
