import {icon} from './icons.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function inactiveForm(form){return !!form.querySelector?.('fieldset:disabled,button[type="submit"]:disabled,button:not([type]):disabled,input[type="submit"]:disabled');}
export function createPlaceEditor({app,call,current,getUser,perform,storage,refresh}){
  let state=null,dialog=null;
  const valid=s=>state===s && current(s.context) && getUser()?.uid===s.uid;
  const key=s=>`oa-v2-place-v1:${s.uid}:${s.context.groupId}:${s.context.tripId}`;
  const coordinates=s=>({groupId:s.context.groupId,tripId:s.context.tripId});
  function close(){const node=dialog;dialog=null;node?.close();node?.remove();}
  function show(body){close();const node=document.createElement('dialog');dialog=node;node.className='place-dialog';node.setAttribute('aria-labelledby','place-editor-title');node.innerHTML=body;node.addEventListener('close',()=>{node.remove();if(dialog===node)dialog=null;});app.append(node);node.showModal();}
  function add(s){
    let pending,error='';
    try{pending=JSON.parse(storage.getItem(key(s))||'null');if(pending && (typeof pending.name!=='string' || !/^[A-Za-z0-9_-]{16,128}$/.test(pending.requestId)))throw Error('invalid');}
    catch{error='이 기기의 이전 추가 요청을 확인하지 못했어요. 연결과 저장 공간을 확인해주세요.';}
    s.pending=pending;
    show(`<h2 id="place-editor-title">장소 추가</h2><p>새 장소는 모두의 도장판에 추가돼요.</p>${error?`<p role="alert">${error}</p>`:`<form id="trip-place-add"><label>장소 이름<input name="name" maxlength="100" required autocomplete="off" value="${esc(pending?.name||'')}" ${pending?'readonly':''}></label><p class="muted">${pending?'결과를 확인하지 못한 같은 요청을 다시 확인해요.':'기존에 모은 도장은 그대로 유지돼요.'}</p><button type="submit">${icon('plus')}${pending?'같은 장소 다시 추가':'장소 추가하기'}</button><p id="place-editor-status" role="status"></p></form>`}<button type="button" class="secondary" data-place-action="cancel">닫기</button>`);
  }
  function confirmation(s,impact,changed=false){
    s.impact=impact;
    show(`<h2 id="place-editor-title">장소를 삭제할까요?</h2><p><strong>${esc(impact.name)}</strong></p><p class="place-impact">${impact.memberCount}명이 남긴 사진 ${impact.photoCount}장에 연결된 장소예요.</p><p>코스와 도장판에서 제외돼요. 사진과 한 줄은 추억에 남고, 작성자만 수정·삭제할 수 있어요.</p>${changed?'<p role="alert">사진이 바뀌었어요. 최신 영향을 다시 확인해주세요.</p>':''}<div class="row"><button type="button" class="secondary" data-place-action="cancel">취소</button><button type="button" class="danger" data-place-action="confirm-remove">장소 삭제</button></div><p id="place-editor-status" role="status"></p>`);
  }
  async function remove(s,impact){
    s.mutating=true;
    try{
      await call('removeTripPlace',{...coordinates(s),placeId:impact.placeId,...(impact.photoCount?{confirmationToken:impact.confirmationToken}:{})});
      if(valid(s)){close();refresh();}
    }catch(error){
      if(valid(s) && error.details?.reason==='confirmation-required'){
        const latest=await call('previewTripPlaceRemoval',{...coordinates(s),placeId:impact.placeId});
        if(valid(s))latest.deleted?(close(),refresh()):confirmation(s,latest,true);
        return;
      }
      if(valid(s) && dialog?.querySelector('#place-editor-status'))dialog.querySelector('#place-editor-status').textContent='삭제하지 못했어요. 같은 버튼으로 다시 확인해주세요.';
      throw error;
    }finally{s.mutating=false;}
  }
  app.addEventListener('click',event=>{
    const button=event.target.closest('button[data-place-action]'),s=state;
    if(!button || button.disabled || !s || !valid(s))return;
    const action=button.dataset.placeAction;
    if(action==='cancel'){close();return;}
    if(action==='add'){add(s);return;}
    if(action==='confirm-remove'){if(s.impact)perform(()=>remove(s,s.impact));return;}
    if(action==='remove')perform(async()=>{
      const impact=await call('previewTripPlaceRemoval',{...coordinates(s),placeId:button.dataset.placeId});
      if(!valid(s))return;
      if(impact.deleted){refresh();return;}
      if(impact.photoCount)confirmation(s,impact);else await remove(s,impact);
    });
  });
  app.addEventListener('submit',event=>{
    const form=event.target;if(form.id!=='trip-place-add')return;event.preventDefault();
    const s=state;if(!s || !valid(s) || inactiveForm(form))return;
    const name=form.elements.name.value.trim();if(!name || [...name].length>100)return;
    perform(async()=>{
      s.mutating=true;
      try{
        if(!s.pending){const pending={name,requestId:crypto.randomUUID()};storage.setItem(key(s),JSON.stringify(pending));s.pending=pending;}
        form.elements.name.readOnly=true;
        await call('addTripPlace',{...coordinates(s),requestId:s.pending.requestId,place:{name:s.pending.name}});
        storage.removeItem(key(s));
        if(valid(s)){close();refresh();}
      }catch(error){
        if(valid(s) && dialog){const status=dialog.querySelector('#place-editor-status');if(status)status.textContent='추가 결과를 확인하지 못했어요. 입력을 보존했으니 다시 시도해주세요.';form.querySelector('button[type="submit"]').textContent=s.pending?'같은 장소 다시 추가':'장소 추가하기';}
        throw error;
      }finally{s.mutating=false;}
    });
  });
  return {isMutating:()=>!!state?.mutating,mount(context,group,trip){state=group.isOwner && trip.status==='open'?{context,uid:getUser()?.uid,pending:null,impact:null}:null;},clear(){state=null;close();}};
}
