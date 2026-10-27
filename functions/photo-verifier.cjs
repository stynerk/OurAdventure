const MAX_PHOTO_BYTES=5*1024*1024;
const PHOTO_TYPES=['image/jpeg','image/png','image/webp'];
function createPhotoVerifier(bucket,{HttpsError}) {
  return async ({groupId,tripId,uid,uploadId})=>{
    if(typeof uploadId!=='string' || !/^[A-Za-z0-9_-]{16,128}$/.test(uploadId))throw new HttpsError('invalid-argument','사진 요청을 확인해주세요.');
    const objectPath=`groups/${groupId}/trips/${tripId}/uploads/${uid}/${uploadId}`,file=bucket.file(objectPath);
    let metadata,header;
    try{[metadata]=await file.getMetadata();[header]=await file.download({start:0,end:15});}
    catch{throw new HttpsError('failed-precondition','사진 업로드가 끝났는지 확인해주세요.');}
    const size=Number(metadata.size),contentType=metadata.contentType;
    const recognized=header[0]===0xff && header[1]===0xd8 && header[2]===0xff?'image/jpeg':
      header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':
      header.subarray(0,4).toString()==='RIFF' && header.subarray(8,12).toString()==='WEBP'?'image/webp':null;
    if(!PHOTO_TYPES.includes(contentType) || recognized!==contentType || !Number.isFinite(size) || size<=0 || size>MAX_PHOTO_BYTES)
      throw new HttpsError('invalid-argument','JPEG·PNG·WebP 사진을 5MiB 이하로 선택해주세요.');
    // The app downloads through authenticated SDK reads, never a bearer download URL.
    if(metadata.metadata?.firebaseStorageDownloadTokens)await file.setMetadata({metadata:{firebaseStorageDownloadTokens:null}});
    return {objectPath,contentType,size,uploadId,generation:String(metadata.generation||'')};
  };
}
module.exports={createPhotoVerifier,MAX_PHOTO_BYTES,PHOTO_TYPES};
