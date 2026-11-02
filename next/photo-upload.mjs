export const MAX_PHOTO_BYTES=5*1024*1024;
export const PHOTO_TYPES=['image/jpeg','image/png','image/webp'];
export function photoFailureMessage(error,stage){
  const code=error?.code,retained='사진과 느낌은 유지돼요. 같은 사진 다시 저장으로 재시도해주세요.';
  if(code==='photo/draft-unavailable')return '기기 임시 저장 실패: 브라우저 저장 공간을 확인해주세요. 사진은 현재 화면에 유지돼요.';
  if(code==='functions/invalid-argument')return '서버 확정 실패: 사진 형식·크기 또는 일정 정보를 확인해주세요. 사진과 느낌은 유지돼요.';
  if(error?.details?.reason==='ended')return '서버 확정 실패: 종료된 여행에는 사진을 추가할 수 없어요. 사진과 느낌은 유지돼요.';
  if(stage==='upload'){
    if(code==='storage/unauthorized')return '사진 업로드 실패: 업로드 권한을 확인하지 못했어요. 로그인·그룹 참여 상태를 확인해주세요. 계속되면 운영 설정 점검이 필요해요. [storage/unauthorized] '+retained;
    if(code==='storage/retry-limit-exceeded')return '사진 업로드 실패: 연결 대기 시간이 초과됐어요. 네트워크를 확인해주세요. '+retained;
    if(code==='storage/quota-exceeded')return '사진 업로드 실패: 서비스 저장소 사용 한도에 도달했어요. 운영자 확인이 필요해요. '+retained;
    return '사진 업로드 실패: 아직 서버 저장·스탬프 확정을 진행하지 못했어요. '+retained;
  }
  if(['functions/permission-denied','functions/unauthenticated'].includes(code))return '서버 확정 실패: 로그인·그룹 참여 권한을 확인해주세요. '+retained;
  return '서버 확정 실패: 업로드 이후 기록·스탬프 저장 결과를 확인하지 못했어요. 이미 저장됐을 수도 있으므로 같은 요청으로 확인해요. '+retained;
}
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
