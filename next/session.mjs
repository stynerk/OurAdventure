// Local IDs are navigation hints only. The caller must recheck server membership.
const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id);
const roomKey = uid => `oa-next-rooms-v1:${uid}`;
const requestKey = uid => `oa-next-create-v1:${uid}`;
export function readRoomIds(storage,uid) {
  if (!uid) return [];
  try {
    const ids=JSON.parse(storage.getItem(roomKey(uid)) || '[]');
    return Array.isArray(ids)?[...new Set(ids.filter(validId))]:[];
  } catch {return [];}
}
export function rememberRoom(storage,uid,roomId) {
  if (!uid || !validId(roomId)) return false;
  try {storage.setItem(roomKey(uid),JSON.stringify([...new Set([...readRoomIds(storage,uid),roomId])]));return true;}
  catch {return false;}
}
export function readCreateRequest(storage,uid) {
  if (!uid) return null;
  try {
    const value=JSON.parse(storage.getItem(requestKey(uid)) || 'null');
    return value && typeof value.requestId==='string' && /^[A-Za-z0-9_-]{16,100}$/.test(value.requestId)
      && typeof value.title==='string' && ['shared','individual'].includes(value.mode) && typeof value.courseId==='string' ? value:null;
  } catch {return null;}
}
export function getCreateRequest(storage,uid,payload,makeId) {
  const next={title:payload.title.trim(),mode:payload.mode,courseId:payload.courseId};
  const previous=readCreateRequest(storage,uid);
  if (previous) {
    if (JSON.stringify([previous.title,previous.mode,previous.courseId])!==JSON.stringify([next.title,next.mode,next.courseId])) {
      throw new Error('결과를 확인하지 못한 생성 요청이 있어요. 원래 이름과 방식으로 다시 시도해 주세요.');
    }
    return previous;
  }
  const request={...next,requestId:makeId()};
  // Refuse the network request if its retry identity cannot be retained.
  storage.setItem(requestKey(uid),JSON.stringify(request));
  return request;
}
export function clearCreateRequest(storage,uid,requestId) {
  try {
    if (readCreateRequest(storage,uid)?.requestId===requestId) storage.removeItem(requestKey(uid));
  } catch { /* A retained request is safe: the server will replay it. */ }
}
export async function loadAccessibleRooms(ids,lookup) {
  const results=await Promise.allSettled([...new Set(ids.filter(validId))].map(lookup));
  return {rooms:results.filter(r=>r.status==='fulfilled' && r.value).map(r=>r.value),
    failed:results.filter(r=>r.status==='rejected').length};
}
