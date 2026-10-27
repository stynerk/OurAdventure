// This namespace never reads or writes the legacy family app's records.
const key=(uid,kind,groupId)=>`oa-v2-pending-v1:${encodeURIComponent(uid)}:${kind}:${groupId||'root'}`;
export function readPending(storage,uid,kind,groupId='') {
  if(!uid)return null;
  const raw=storage.getItem(key(uid,kind,groupId));if(!raw)return null;
  let saved;
  try {saved=JSON.parse(raw);}catch {throw new Error('저장된 생성 요청을 읽지 못했어요. 목록에서 기존 생성 결과를 먼저 확인해주세요.');}
  const valid=saved && saved.uid===uid && saved.kind===kind && saved.groupId===groupId &&
    typeof saved.requestId==='string' && /^[A-Za-z0-9_-]{16,128}$/.test(saved.requestId) &&
    saved.payload && typeof saved.payload==='object' && !Array.isArray(saved.payload);
  if(!valid)throw new Error('저장된 생성 요청을 확인하지 못했어요. 목록에서 기존 생성 결과를 먼저 확인해주세요.');
  return saved;
}
export function prepareRequest(storage,uid,kind,groupId,payload,newId) {
  if(!uid || !['group','trip'].includes(kind))throw new Error('로그인 상태를 확인해주세요.');
  const previous=readPending(storage,uid,kind,groupId);
  if(previous) {
    if(JSON.stringify(previous.payload)!==JSON.stringify(payload))throw new Error('아직 결과를 확인하지 못한 요청이 있어요. ‘이전 요청 확인’ 후 새로 만들어주세요.');
    return previous;
  }
  const pending={uid,kind,groupId,payload,requestId:newId()};
  storage.setItem(key(uid,kind,groupId),JSON.stringify(pending));
  return pending;
}
export function finishRequest(storage,pending) {
  const previous=readPending(storage,pending.uid,pending.kind,pending.groupId);
  if(previous?.requestId===pending.requestId)storage.removeItem(key(pending.uid,pending.kind,pending.groupId));
}
