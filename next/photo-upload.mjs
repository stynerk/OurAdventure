export const MAX_PHOTO_BYTES=5*1024*1024;
export const PHOTO_TYPES=['image/jpeg','image/png','image/webp'];
export function validatePhoto(file,feeling='') {
  if(!file || !PHOTO_TYPES.includes(file.type) || file.size<=0 || file.size>MAX_PHOTO_BYTES)throw Error('JPEG·PNG·WebP 사진을 5MiB 이하로 선택해주세요.');
  if([...feeling.trim()].length>60)throw Error('한 줄 느낌은 60자까지 남길 수 있어요.');
}
export function makePhotoAttempt({file,feeling='',uid,groupId,tripId,placeId},id=()=>crypto.randomUUID()) {
  validatePhoto(file,feeling);
  return {file,uid,groupId,tripId,placeId,feeling:feeling.trim(),uploadId:id(),requestId:id(),uploaded:false,tries:0,result:null,inFlight:null};
}
export function savePhotoAttempt(attempt,{upload,finalize,stage=()=>{}}) {
  if(attempt.result)return Promise.resolve(attempt.result);
  if(attempt.inFlight)return attempt.inFlight;
  attempt.tries++;
  attempt.inFlight=(async()=>{
    if(!attempt.uploaded){attempt.stage='upload';stage('upload');await upload(attempt);attempt.uploaded=true;}
    attempt.stage='save';stage('save');
    const result=await finalize({groupId:attempt.groupId,tripId:attempt.tripId,placeId:attempt.placeId,uploadId:attempt.uploadId,requestId:attempt.requestId,feeling:attempt.feeling});
    attempt.result=result;return result;
  })().finally(()=>{attempt.inFlight=null;});
  return attempt.inFlight;
}
export const lineBucket=line=>!line?'0':[...line].length<=20?'1-20':[...line].length<=40?'21-40':'41-60';
export const uploadBucket=ms=>ms<2000?'under_2s':ms<5000?'2-5s':ms<15000?'5-15s':'15s+';
