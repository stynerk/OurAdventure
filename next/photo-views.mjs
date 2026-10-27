import {icon} from './icons.mjs';
import {celebrateStamp} from './ui.mjs';
import {makePhotoAttempt,savePhotoAttempt,validatePhoto,lineBucket,uploadBucket} from './photo-upload.mjs';
import {countBucket} from './analytics.mjs';
import {readPhotoDraft,storePhotoDraft,removePhotoDraft,clearPhotoDrafts} from './photo-drafts.mjs';
export const photoForm=(mode='stamp')=>`<form id="photo-stamp"><fieldset><legend class="sr-only">${mode==='free'?'장소 없이 자유 기록 남기기':'사진으로 내 스탬프 남기기'}</legend><div class="photo-tools"><button type="button" class="camera-button" data-file-trigger="camera">${icon('camera')}사진 찍기</button><button type="button" class="secondary album-button" data-file-trigger="gallery" aria-label="앨범에서 사진 선택">${icon('image')}<span>앨범</span></button></div><label class="file-label"><span class="sr-only">사진 촬영</span><input class="file-input" aria-label="사진 촬영" type="file" name="camera" accept="image/jpeg,image/png,image/webp" capture="environment"></label><label class="file-label"><span class="sr-only">사진 선택</span><input class="file-input" aria-label="사진 선택" type="file" name="gallery" accept="image/jpeg,image/png,image/webp"></label><div id="photo-preview"></div><label>한 줄 느낌 (선택)<textarea name="feeling" rows="2" maxlength="60" placeholder="오늘의 느낌을 60자 안으로 남겨주세요"></textarea></label></fieldset><button type="submit">${icon('stamp')}${mode==='free'?'자유 기록 저장':'사진 저장하고 스탬프 받기'}</button><p id="photo-status" role="status" aria-live="polite"></p><p class="photo-form-hint">JPEG·PNG·WebP · 5MiB 이하</p></form>`;

export function createPhotoViews({app,api,photoStorage,getUser,current,call,perform,track,onSaved=async()=>{}}) {
  const drafts=new Map();let active=null;
  const valid=()=>active && current(active.context) && active.uid===getUser()?.uid;
  const visible=state=>valid() && active.key===state.key;
  const status=text=>{const node=app.querySelector('#photo-status');if(node)node.textContent=text;};
  function preview(draft){const node=app.querySelector('#photo-preview');if(!node)return;node.replaceChildren();if(draft.preview){const img=document.createElement('img');img.src=draft.preview;img.alt=draft.saved?'저장한 내 사진':'선택한 사진 미리보기';node.append(img);}}
  app.addEventListener('change',event=>{
    if(!valid() || !event.target.matches('#photo-stamp input[type=file]'))return;
    const file=event.target.files?.[0];if(!file)return;
    const draft=drafts.get(active.key);if(draft.attempt || draft.restoring)return;
    try{validatePhoto(file);if(draft.preview)URL.revokeObjectURL(draft.preview);draft.file=file;draft.saved=false;draft.preview=URL.createObjectURL(file);preview(draft);status('사진을 골랐어요. 저장이 끝나면 내 스탬프가 완료돼요.');track('photo_select',{...active.common,source:event.target.name==='camera'?'camera':'gallery'});}
    catch(error){status(error.message);}
  });
  app.addEventListener('submit',event=>{
    if(event.target.id!=='photo-stamp')return;event.preventDefault();if(!valid())return;
    const state=active,draft=drafts.get(state.key),form=event.target;
    if(draft.restoring)return;
    try{if(!draft.attempt)draft.attempt=makePhotoAttempt({...state.context,placeId:state.context.placeId??null,uid:state.uid,file:draft.file,feeling:form.elements.feeling.value});}
    catch(error){status(error.message);return;}
    form.querySelector('fieldset').disabled=true;
    perform(async()=>{
      const attempt=draft.attempt;
      try{
        try{await storePhotoDraft(state.key,attempt);}catch{throw Error('사진과 저장 요청을 이 기기에 보관하지 못했어요. 브라우저 저장 공간을 확인한 뒤 다시 시도해주세요.');}
        const result=await savePhotoAttempt(attempt,{
          upload:async pending=>{
            const start=performance.now(),ref=api.ref(photoStorage,`groups/${pending.groupId}/trips/${pending.tripId}/uploads/${pending.uid}/${pending.uploadId}`);
            try{const metadata=await api.getMetadata(ref);if(Number(metadata.size)!==pending.file.size || metadata.contentType!==pending.file.type)throw Error('사진 업로드 상태가 달라요.');}
            catch(error){if(error.code!=='storage/object-not-found')throw error;await new Promise((resolve,reject)=>{const upload=api.uploadBytesResumable(ref,pending.file,{contentType:pending.file.type});upload.on('state_changed',snap=>{if(visible(state))status(`사진 업로드 중 ${Math.round(snap.bytesTransferred/snap.totalBytes*100)}%`);},reject,resolve);});}
            pending.uploadMs=performance.now()-start;pending.uploaded=true;await storePhotoDraft(state.key,pending);
          },
          finalize:data=>call('finalizePhoto',data),stage:stage=>{if(visible(state))status(stage==='upload'?'사진을 업로드하고 있어요…':'업로드 완료 · 스탬프 저장을 확인하고 있어요…');}
        });
        try{await removePhotoDraft(state.key);}catch{/* A retained request safely replays after reload. */}
        if(!attempt.reported && getUser()?.uid===state.uid){attempt.reported=true;track(state.free?'free_post_create':result.newCompletion?'stamp_complete':'photo_add',{...state.common,place_index:state.index,has_line:!!attempt.feeling,line_length_bucket:lineBucket(attempt.feeling),upload_bucket:uploadBucket(attempt.uploadMs||0),stamps_done:countBucket(result.stampsDone),stamps_total:countBucket(result.stampsTotal)});}
        draft.saved=true;draft.attempt=null;draft.file=null;
        if(visible(state)){const shown=app.querySelector('#photo-stamp');shown.reset();shown.querySelector('fieldset').disabled=false;shown.querySelector('button[type=submit]').textContent=state.free?'자유 기록 저장':'사진 저장하고 스탬프 받기';const badge=app.querySelector('[data-own-stamp]');if(badge)badge.textContent='내 스탬프 완료';const count=app.querySelector('[data-trip-post-count]');if(count && Number.isFinite(result.postCount))count.textContent=String(Math.max(Number(count.textContent)||0,result.postCount));status(state.free?'자유 기록이 저장됐어요.':'사진과 스탬프가 저장됐어요.');preview(draft);}
        if(visible(state) && !state.free && result.newCompletion)celebrateStamp({app,context:state.context,result,photo:draft.preview,feeling:attempt.feeling});
        try{await onSaved(state.context);}catch{if(visible(state))status('기록은 저장됐어요. 피드는 새로고침으로 확인해주세요.');}
      }catch(error){
        try{await storePhotoDraft(state.key,attempt);}catch{}
        if(!state.free && getUser()?.uid===state.uid)track('stamp_complete_fail',{...state.common,reason:!navigator.onLine?'offline':error.details?.reason==='ended'?'ended':attempt.stage==='upload'?'upload':'save',retry:attempt.tries>1});
        if(visible(state)){status('저장하지 못했어요. 사진과 느낌은 유지돼요. 같은 요청으로 다시 시도해주세요.');app.querySelector('#photo-stamp button[type=submit]').textContent='같은 사진 다시 저장';}
        if(error.code==='functions/invalid-argument'){try{await removePhotoDraft(state.key);}catch{}draft.attempt=null;if(visible(state)){app.querySelector('#photo-stamp fieldset').disabled=false;status(error.message+' 사진과 느낌을 확인한 뒤 다시 선택해주세요.');}}
        throw error;
      }
    });
  });
  return {
    async mount(context,group,index){
      const uid=getUser()?.uid,key=JSON.stringify([uid,context.groupId,context.tripId,context.placeId??null]);
      const restore=!drafts.has(key) || drafts.get(key).restoreFailed;if(!drafts.has(key))drafts.set(key,{});
      active={context,uid,key,index,free:context.tab==='memory',common:{group_id:context.groupId,trip_id:context.tripId,role:group.isOwner?'leader':'member',trip_status:'active'}};
      const draft=drafts.get(key),form=app.querySelector('#photo-stamp');
      if(restore){
        draft.restoring=true;
        form.querySelector('fieldset').disabled=true;form.querySelector('button').disabled=true;
        try{const saved=await readPhotoDraft(key);if(saved){if(saved.uid!==uid || saved.groupId!==context.groupId || saved.tripId!==context.tripId || saved.placeId!==(context.placeId??null))throw Error('요청 불일치');validatePhoto(saved.file,saved.feeling);draft.attempt={...saved,inFlight:null,result:null};draft.file=saved.file;draft.preview=URL.createObjectURL(saved.file);}}
        catch{draft.restoreFailed=true;if(visible(active))status('이 기기의 이전 저장 요청을 확인하지 못했어요. 브라우저 저장 공간을 확인해주세요.');return;}
        draft.restoring=false;draft.restoreFailed=false;
        if(!current(context) || getUser()?.uid!==uid)return;
        form.querySelector('fieldset').disabled=false;form.querySelector('button').disabled=false;
      }
      preview(draft);
      if(draft.attempt){form.elements.feeling.value=draft.attempt.feeling;form.querySelector('fieldset').disabled=true;form.querySelector('button[type=submit]').textContent='같은 사진 다시 저장';status('확인 중인 사진과 느낌을 유지했어요. 같은 요청으로 다시 저장해주세요.');}
      else if(draft.saved)status('사진과 스탬프가 저장됐어요.');
    },
    clear(){const uid=getUser()?.uid;for(const draft of drafts.values())if(draft.preview)URL.revokeObjectURL(draft.preview);drafts.clear();active=null;if(uid)void clearPhotoDrafts(uid).catch(()=>{});}
  };
}
