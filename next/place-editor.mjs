import {icon} from './icons.mjs';
import {scheduleFields,importMarkup,mountImport,showPlaceReference} from './itinerary-editor.mjs';
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
    s.pending=pending;s.googlePlaceId=pending?.place?.googlePlaceId||'';
    show(`<h2 id="place-editor-title">장소 추가</h2><p>새 장소는 모두의 도장판에 추가돼요.</p>${error?`<p role="alert">${error}</p>`:`<form id="trip-place-add"><label>장소 이름<input name="name" maxlength="100" required autocomplete="off" value="${esc(pending?.name||'')}" ${pending?'readonly':''}></label><p class="muted">${pending?'결과를 확인하지 못한 같은 요청을 다시 확인해요.':'기존에 모은 도장은 그대로 유지돼요.'}</p><button type="submit">${icon('plus')}${pending?'같은 장소 다시 추가':'장소 추가하기'}</button><p id="place-editor-status" role="status"></p></form>`}<button type="button" class="secondary" data-place-action="cancel">닫기</button>`);
    const form=dialog.querySelector('form');if(form){form.querySelector('button').insertAdjacentHTML('beforebegin',scheduleFields(pending?.place||{},s.trip));wireLookup(s,form);if(pending)lock(form);}
  }
  function lock(form){for(const n of form.querySelectorAll('input,select,textarea,[data-import],[data-remove]')){delete n.dataset.pending;n.dataset.requestLocked='1';n.disabled=true;}}
  function unlock(form){for(const n of form.querySelectorAll('[data-request-locked]')){delete n.dataset.requestLocked;n.disabled=false;}}
  function wireLookup(s,form){
    let timer;
    form.addEventListener('input',event=>{
      if(event.target.name!=='name'||event.target.readOnly)return;
      s.googlePlaceId='';clearTimeout(timer);
      timer=setTimeout(async()=>{
        const name=form.elements.name.value.trim(),info=form.querySelector('.place-info-status');if(!name||!valid(s)||!form.isConnected)return;
        info.textContent='장소 설명을 찾고 있어요…';
        try{const result=await call('lookupPlaceInfo',{groupId:s.context.groupId,name,destination:s.trip.destination});if(!valid(s)||!form.isConnected||form.elements.name.disabled||form.elements.name.value.trim()!==name )return;s.googlePlaceId=result.placeId||'';showPlaceReference(info,result);}
        catch{if(form.isConnected)info.textContent='설명을 가져오지 못했어요. 직접 입력해도 괜찮아요.';}
      },800);
    });
  }
  const fields=form=>({kind:form.elements.kind.value,name:form.elements.name.value.trim(),day:Number(form.elements.day.value)||null,startTime:form.elements.startTime.value,endTime:form.elements.endTime.value,note:form.elements.note.value,description:form.elements.description.value});
  function edit(s,id){
    const place=s.places.find(p=>p.id===id);if(!place)return;
    const storageKey=key(s)+':edit:'+id;let pending;
    try{pending=JSON.parse(storage.getItem(storageKey)||'null');}catch{throw Error('이 기기의 이전 수정 요청을 확인하지 못했어요.');}
    s.editing={place,storageKey,pending};s.sourceUrl='';s.googlePlaceId=place.googlePlaceId||'';
    const value=pending?.place||place;
    show(`<h2 id="place-editor-title">장소·시간 수정</h2><p>기존 사진과 완료한 스탬프는 그대로 유지돼요.</p><form id="trip-place-edit"><label>장소 이름<input name="name" required maxlength="100" value="${esc(value.name)}"></label>${scheduleFields(value,s.trip)}<button type="submit">${pending?'같은 수정 다시 저장':'변경 저장'}</button><p id="place-editor-status" role="status"></p></form><button type="button" class="secondary" data-place-action="cancel">닫기</button>`);
    const form=dialog.querySelector('form');wireLookup(s,form);
    if(pending)lock(form);
  }
  function importSchedule(s){
    const storageKey=key(s)+':import';let pending;
    try{pending=JSON.parse(storage.getItem(storageKey)||'null');}catch{throw Error('이 기기의 이전 가져오기 요청을 확인하지 못했어요.');}
    show(`<h2 id="place-editor-title">시간표·장소 가져오기</h2><form id="trip-itinerary-import">${importMarkup()}<p>같은 이름의 기존 장소가 하나이면 연결해 갱신해요. 기존 사진·완료는 유지되고, 없는 장소만 추가돼요. 기존 일정은 자동 삭제하지 않아요.</p><button type="submit">${pending?'같은 요청 다시 반영':'검토한 일정 반영'}</button><p id="place-editor-status" role="status"></p></form><button type="button" class="secondary" data-place-action="cancel">닫기</button>`);
    const editor=mountImport(dialog.querySelector('.itinerary-import'),{trip:()=>s.trip,existing:s.places,valid:()=>valid(s),analyze:data=>call('analyzeItinerary',{...coordinates(s),...data}),lookup:name=>call('lookupPlaceInfo',{groupId:s.context.groupId,name,destination:s.trip.destination})});
    s.importing={storageKey,pending,editor};if(pending){editor.set(pending.entries);lock(dialog.querySelector('form'));}
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
    if(action==='edit'){edit(s,button.dataset.placeId);return;}
    if(action==='import'){importSchedule(s);return;}
    if(action==='confirm-remove'){if(s.impact)perform(()=>remove(s,s.impact));return;}
    if(action==='remove')perform(async()=>{
      const impact=await call('previewTripPlaceRemoval',{...coordinates(s),placeId:button.dataset.placeId});
      if(!valid(s))return;
      if(impact.deleted){refresh();return;}
      if(impact.photoCount)confirmation(s,impact);else await remove(s,impact);
    });
  });
  app.addEventListener('submit',event=>{
    const form=event.target;if(!['trip-place-add','trip-place-edit','trip-itinerary-import'].includes(form.id))return;event.preventDefault();
    const s=state;if(!s || !valid(s) || inactiveForm(form))return;
    if(form.id==='trip-place-edit'||form.id==='trip-itinerary-import'){
      const editing=form.id==='trip-place-edit',operation=editing?s.editing:s.importing;
      perform(async()=>{
        s.mutating=true;
        try{
          if(!operation.pending){operation.pending=editing?{...coordinates(s),placeId:operation.place.id,revision:operation.place.revision||0,requestId:crypto.randomUUID(),place:{...fields(form),sourceUrl:'',googlePlaceId:s.googlePlaceId||'',order:operation.place.order||0}}:{...coordinates(s),revision:s.trip.itineraryRevision||0,requestId:crypto.randomUUID(),entries:operation.editor.read()};storage.setItem(operation.storageKey,JSON.stringify(operation.pending));}
          lock(form);await call(editing?'editTripPlace':'applyTripItinerary',operation.pending);storage.removeItem(operation.storageKey);
          if(valid(s)){close();refresh();}
        }catch(error){
          if(['functions/invalid-argument','functions/aborted','functions/failed-precondition'].includes(error.code)){storage.removeItem(operation.storageKey);operation.pending=null;unlock(form);}
          if(valid(s)&&form.isConnected)form.querySelector('#place-editor-status').textContent=error.message+' 입력은 유지돼요.';
          throw error;
        }finally{s.mutating=false;}
      });return;
    }
    const name=form.elements.name.value.trim();if(!name || [...name].length>100)return;
    perform(async()=>{
      s.mutating=true;
      try{
        if(!s.pending){const pending={name,place:{...fields(form),sourceUrl:'',googlePlaceId:s.googlePlaceId||''},requestId:crypto.randomUUID()};storage.setItem(key(s),JSON.stringify(pending));s.pending=pending;s.googlePlaceId=pending?.place?.googlePlaceId||'';}
        form.elements.name.readOnly=true;
        lock(form);
        await call('addTripPlace',{...coordinates(s),requestId:s.pending.requestId,place:s.pending.place||{name:s.pending.name}});
        storage.removeItem(key(s));
        if(valid(s)){close();refresh();}
      }catch(error){
        if(['functions/invalid-argument','functions/aborted','functions/failed-precondition'].includes(error.code)){storage.removeItem(key(s));s.pending=null;unlock(form);form.elements.name.readOnly=false;}
        if(valid(s) && dialog){const status=dialog.querySelector('#place-editor-status');if(status)status.textContent='추가 결과를 확인하지 못했어요. 입력을 보존했으니 다시 시도해주세요.';form.querySelector('button[type="submit"]').textContent=s.pending?'같은 장소 다시 추가':'장소 추가하기';}
        throw error;
      }finally{s.mutating=false;}
    });
  });
  return {isMutating:()=>!!state?.mutating,mount(context,group,trip,places=[]){state=group.isOwner && trip.status==='open'?{context,uid:getUser()?.uid,pending:null,impact:null,trip,places}:null;},clear(){state=null;close();}};
}
