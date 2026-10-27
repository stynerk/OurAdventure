let database;
function open() {
  if(!database)database=new Promise((resolve,reject)=>{
    const request=indexedDB.open('oa-photo-drafts-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'key'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  return database;
}
async function transact(mode,action) {
  const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts',mode),request=action(tx.objectStore('drafts'));
    tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
export const readPhotoDraft=key=>transact('readonly',store=>store.get(key));
export function storePhotoDraft(key,a) {
  const {file,uid,groupId,tripId,placeId,feeling,uploadId,requestId,uploaded,uploadMs,tries}=a;
  return transact('readwrite',store=>store.put({key,file,uid,groupId,tripId,placeId,feeling,uploadId,requestId,uploaded,uploadMs,tries}));
}
export const removePhotoDraft=key=>transact('readwrite',store=>store.delete(key));
export async function clearPhotoDrafts(uid) {
  const rows=await transact('readonly',store=>store.getAll());
  for(const row of rows)if(row.uid===uid)await removePhotoDraft(row.key);
}
