const {randomBytes, createHash} = require('node:crypto');
const course = require('./course.json');

// All writes go through this trusted service. Admin SDK bypasses Rules, so every
// action checks auth, membership, mode and room state inside its transaction.
function createService(db, {HttpsError, FieldValue}) {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const text = (value, max, label) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) fail('invalid-argument', `${label}을 확인해 주세요.`);
    return value.trim();
  };
  const uidOf = auth => auth?.uid || fail('unauthenticated', '인증 세션이 필요해요.');
  const idOf = data => {
    const id = text(data?.roomId, 100, '탐험방 ID');
    if (!/^[A-Za-z0-9_-]+$/.test(id)) fail('invalid-argument', '잘못된 탐험방 ID예요.');
    return id;
  };
  const hash = token => {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) fail('invalid-argument', '초대 링크를 확인해 주세요.');
    return createHash('sha256').update(token).digest('hex');
  };
  const now = () => FieldValue.serverTimestamp();
  const roomRef = id => db.doc(`rooms/${id}`);
  const memberRef = (id, uid) => roomRef(id).collection('members').doc(uid);
  async function context(tx, id, uid, {owner = false, open = true} = {}) {
    const [rs, ms] = await tx.getAll(roomRef(id), memberRef(id, uid));
    if (!rs.exists || !ms.exists) fail('permission-denied', '이 탐험방에 참여할 수 없어요.');
    const room = rs.data(), member = ms.data();
    if (owner && (room.ownerId !== uid || member.role !== 'owner')) fail('permission-denied', '방장만 사용할 수 있어요.');
    if (open && room.status !== 'open') fail('failed-precondition', '종료된 탐험방은 읽기만 할 수 있어요.');
    return {room, member};
  }
  const log = (tx, id, event, uid, type, extra = {}) => tx.create(roomRef(id).collection('activity').doc(event), {type, uid, at:now(), ...extra});
  return {
    async createRoom(data, auth) {
      const uid = uidOf(auth);
      if (auth.token?.firebase?.sign_in_provider !== 'google.com') fail('permission-denied', '방장은 Google 로그인이 필요해요.');
      const title = text(data?.title, 60, '탐험방 이름');
      if (!['shared','individual'].includes(data?.mode) || data?.courseId !== course.id) fail('invalid-argument', '코스와 진행 방식을 확인해 주세요.');
      const ref = db.collection('rooms').doc(), token = randomBytes(32).toString('base64url');
      await db.runTransaction(async tx => {
        // Token is returned once; only its hash is stored in a private collection.
        tx.create(ref, {title, mode:data.mode, status:'open', ownerId:uid, courseId:course.id, courseVersion:course.version,
          questIds:course.questIds, requiredQuestIds:course.requiredQuestIds, sharedDone:[], memberCount:1, capacity:100, createdAt:now(), closedAt:null});
        tx.create(memberRef(ref.id, uid), {role:'owner', displayName:'방장', participantCode:'', done:[], submittedAt:null, joinedAt:now(), lastSeenAt:now()});
        tx.create(db.doc(`invites/${hash(token)}`), {roomId:ref.id});
        tx.create(db.doc(`roomSecrets/${ref.id}`), {inviteHash:hash(token)});
        log(tx, ref.id, 'created', uid, 'room-created');
      });
      return {roomId:ref.id, token};
    },
    async previewInvite(data) {
      const invite = await db.doc(`invites/${hash(data?.token)}`).get();
      if (!invite.exists) fail('not-found', '유효하지 않거나 재발급된 초대 링크예요.');
      const snap = await roomRef(invite.data().roomId).get();
      if (!snap.exists || snap.data().status !== 'open') fail('failed-precondition', '종료된 탐험방이에요.');
      const r = snap.data();
      return {roomId:snap.id, title:r.title, mode:r.mode, questCount:r.questIds.length};
    },
    async joinRoom(data, auth) {
      const uid = uidOf(auth), inviteRef = db.doc(`invites/${hash(data?.token)}`);
      const displayName = text(data?.nickname, 24, '별칭');
      const participantCode = data?.participantCode ? text(data.participantCode, 12, '참여 코드') : '';
      return db.runTransaction(async tx => {
        const invite = await tx.get(inviteRef);
        if (!invite.exists) fail('not-found', '유효하지 않거나 재발급된 초대 링크예요.');
        const id = invite.data().roomId;
        const [rs, ms] = await tx.getAll(roomRef(id), memberRef(id, uid));
        if (!rs.exists || rs.data().status !== 'open') fail('failed-precondition', '종료된 탐험방이에요.');
        if (ms.exists) return {roomId:id}; // Never overwrite existing role, name or progress.
        if (rs.data().memberCount >= rs.data().capacity) fail('resource-exhausted', '탐험방 정원이 가득 찼어요.');
        tx.create(memberRef(id, uid), {role:'member', displayName, participantCode, done:[], submittedAt:null, joinedAt:now(), lastSeenAt:now()});
        tx.update(roomRef(id), {memberCount:rs.data().memberCount + 1});
        log(tx,id,`join-${uid}`,uid,'member-joined');
        return {roomId:id};
      });
    },
    async completeQuest(data, auth) {
      const uid = uidOf(auth), id = idOf(data), questId = data.questId;
      return db.runTransaction(async tx => {
        const {room, member} = await context(tx,id,uid);
        if (!room.questIds.includes(questId)) fail('invalid-argument', '코스에 없는 미션이에요.');
        const shared = room.mode === 'shared', done = shared ? room.sharedDone : member.done;
        if (done.includes(questId)) return {completed:true};
        if (member.submittedAt) fail('failed-precondition', '이미 제출한 기록이에요.');
        tx.update(shared ? roomRef(id) : memberRef(id,uid), shared ? {sharedDone:[...done,questId]} : {done:[...done,questId],lastSeenAt:now()});
        log(tx,id,`quest-${shared?'room':uid}-${questId}`,uid,'quest-completed',{questId});
        return {completed:true};
      });
    },
    async submit(data, auth) {
      const uid = uidOf(auth), id = idOf(data);
      return db.runTransaction(async tx => {
        const {room, member} = await context(tx,id,uid);
        if (room.mode !== 'individual') fail('failed-precondition', '각자 완료 모드에서만 제출해요.');
        if (member.submittedAt) return {submitted:true};
        if (!room.requiredQuestIds.every(q=>member.done.includes(q))) fail('failed-precondition', '필수 미션을 먼저 완료해 주세요.');
        tx.update(memberRef(id,uid), {submittedAt:now(),lastSeenAt:now()});
        log(tx,id,`submit-${uid}`,uid,'submitted');
        return {submitted:true};
      });
    },
    async closeRoom(data, auth) {
      const uid = uidOf(auth), id = idOf(data);
      return db.runTransaction(async tx => {
        const {room} = await context(tx,id,uid,{owner:true,open:false});
        if (room.status === 'closed') return {closed:true};
        tx.update(roomRef(id), {status:'closed',closedAt:now()});
        log(tx,id,'closed',uid,'room-closed');
        return {closed:true};
      });
    },
    async rotateInvite(data, auth) {
      const uid = uidOf(auth), id = idOf(data), token = randomBytes(32).toString('base64url');
      await db.runTransaction(async tx => {
        await context(tx,id,uid,{owner:true});
        const secret = await tx.get(db.doc(`roomSecrets/${id}`));
        tx.delete(db.doc(`invites/${secret.data().inviteHash}`));
        tx.create(db.doc(`invites/${hash(token)}`), {roomId:id});
        tx.update(db.doc(`roomSecrets/${id}`), {inviteHash:hash(token)});
      });
      return {token};
    }
  };
}
module.exports = {createService};
