import {renderShareImage,sharePng} from './share-renderer.mjs';
import {countBucket} from './analytics.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPES=['image/jpeg','image/png','image/webp'],MAX_BYTES=5*1024*1024;
export function verifiedPhotoBlob(bytes,photo){
  if(!bytes.size || bytes.size!==photo.size || bytes.size>MAX_BYTES || !TYPES.includes(photo.contentType) || (bytes.type && bytes.type!==photo.contentType))throw Error('사진 파일을 확인하지 못했어요.');
  // Firebase getBlob(ref, maxBytes) uses Blob.slice(), which drops its MIME type.
  return bytes.type?bytes:new Blob([bytes],{type:photo.contentType});
}
export function createReportViews({app,api,photoStorage,getUser,current,call,perform,track}){
  let active=null;
  const urls=new Set();
  const valid=s=>active===s && current(s.context) && getUser()?.uid===s.uid;
  const common=s=>({group_id:s.context.groupId,trip_id:s.context.tripId,role:s.group.isOwner?'leader':'member',trip_status:'ended'});
  function revoke(url){if(url){URL.revokeObjectURL(url);urls.delete(url);}}
  function clear(){active=null;for(const url of urls)URL.revokeObjectURL(url);urls.clear();}
  function status(s,text){if(valid(s)){const node=app.querySelector('#share-status');if(node)node.textContent=text;}}
  function invalidate(s){
    s.version++;s.attempt=null;s.ready=null;revoke(s.previewUrl);s.previewUrl=null;
    const preview=app.querySelector('#share-preview');if(preview)preview.replaceChildren();
    const save=app.querySelector('[data-report="save"]');if(save){save.disabled=true;delete save.dataset.pending;}
    const privacy=app.querySelector('#share-privacy');if(privacy)privacy.checked=false;
  }
  async function loadPhoto(s,post){
    const photo=post.photo,path=photo?.objectPath,prefix=`groups/${s.context.groupId}/trips/${s.context.tripId}/uploads/`;
    if(typeof path!=='string' || !path.startsWith(prefix) || !/^[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_-]{16,128}$/.test(path.slice(prefix.length)) || !TYPES.includes(photo.contentType) || photo.size<=0 || photo.size>MAX_BYTES)throw Error('사진 정보를 확인하지 못했어요.');
    const key=path+':'+photo.generation;
    if(!s.images.has(key)){
      const pending=(async()=>{
        const object=api.ref(photoStorage,path),metadata=await api.getMetadata(object);
        if(!valid(s))throw Error('화면이 바뀌었어요.');
        if(Number(metadata.size)!==photo.size || metadata.contentType!==photo.contentType || (photo.generation && String(metadata.generation)!==photo.generation))throw Error('사진이 바뀌었어요. 다시 확인해주세요.');
        const bytes=await api.getBlob(object,MAX_BYTES);if(!valid(s))throw Error('화면이 바뀌었어요.');
        const blob=verifiedPhotoBlob(bytes,photo);
        const url=URL.createObjectURL(blob);urls.add(url);const image=new Image();image.decoding='async';image.src=url;
        try{await image.decode();}catch(error){revoke(url);throw error;}
        if(!valid(s)){revoke(url);throw Error('화면이 바뀌었어요.');}
        if(!image.naturalWidth || !image.naturalHeight || image.naturalWidth*image.naturalHeight>24000000){revoke(url);throw Error('사진 해상도가 너무 커요. 다른 사진을 선택해주세요.');}
        return {image,url};
      })();
      s.images.set(key,pending);pending.catch(()=>s.images.delete(key));
    }
    return s.images.get(key);
  }
  async function showPhotos(s,posts,selector){
    const queue=[...posts];
    await Promise.all(Array.from({length:3},async()=>{while(queue.length && valid(s)){
      const post=queue.shift(),node=app.querySelector(`[${selector}="${post.id}"]`);if(!node)continue;
      try{const {url}=await loadPhoto(s,post);if(!valid(s) || !node.isConnected)return;const img=document.createElement('img');img.src=url;img.alt='여행 사진';img.loading='lazy';node.replaceChildren(img);}
      catch{if(valid(s) && node.isConnected)node.textContent='사진을 불러오지 못했어요. 다른 사진을 선택하거나 새로고침해주세요.';}
    }}));
  }
  function picker(s){
    const posts=s.report.photos.slice(0,s.limit);
    app.querySelector('#share-picker').innerHTML=posts.map((p,index)=>`<label class="share-choice"><input type="checkbox" data-share-photo="${esc(p.id)}" aria-label="사진 ${index+1} 선택" ${s.selected.includes(p.id)?'checked':''}><span data-picker-photo="${esc(p.id)}">사진 불러오는 중…</span><strong>${esc(p.alias)}</strong><small>${esc(p.placeId?s.report.places.find(place=>place.id===p.placeId)?.name||'장소 기록':'자유 기록')}</small></label>`).join('');
    app.querySelector('[data-report="more"]').hidden=s.limit>=s.report.photos.length;
    void showPhotos(s,posts,'data-picker-photo');
  }
  function updateSelection(s){
    app.querySelector('#share-selection').textContent=`선택 ${s.selected.length}/6장`;
    app.querySelector('[data-report="preview"]').disabled=s.selected.length===0;
  }
  app.addEventListener('change',event=>{
    const s=active;if(!s || !valid(s) || s.mode!=='share' || !s.group.isOwner)return;
    const input=event.target;
    if(input.id==='share-privacy'){app.querySelector('[data-report="save"]').disabled=!s.ready || !input.checked;return;}
    if(input.matches('[data-share-photo]')){
      const id=input.dataset.sharePhoto;if(!s.report.photos.some(p=>p.id===id))return;
      if(input.checked && !s.selected.includes(id)){if(s.selected.length>=6){input.checked=false;status(s,'한 이미지에는 사진을 최대 6장 선택할 수 있어요.');return;}s.selected.push(id);}
      if(!input.checked)s.selected=s.selected.filter(value=>value!==id);
      invalidate(s);updateSelection(s);status(s,'사진을 고른 뒤 미리보기를 만들어주세요.');
    }else if(input.id==='share-format' || input.id==='share-template' || input.id==='share-trip-title'){
      s.format=app.querySelector('#share-format').value;s.template=app.querySelector('#share-template').value;s.includeTripTitle=app.querySelector('#share-trip-title').checked;app.querySelector('#share-title-notice').hidden=!s.includeTripTitle;invalidate(s);status(s,'구성이 바뀌었어요. 미리보기를 다시 만들어주세요.');
    }
  });
  app.addEventListener('click',event=>{
    const button=event.target.closest('button[data-report]'),s=active;if(!button || button.disabled || !s || !valid(s))return;
    const action=button.dataset.report;
    if(action==='reload'){window.dispatchEvent(new Event('hashchange'));return;}
    if(s.mode!=='share' || !s.group.isOwner)return;
    if(action==='more'){s.limit+=12;picker(s);return;}
    if(action==='preview'){
      if(!s.selected.length){status(s,'사진을 1장 이상 선택해주세요.');return;}
      const version=s.version;
      perform(async()=>{
        s.ready=null;revoke(s.previewUrl);s.previewUrl=null;app.querySelector('#share-preview')?.replaceChildren();
        const save=app.querySelector('[data-report="save"]');save.disabled=true;delete save.dataset.pending;app.querySelector('#share-privacy').checked=false;
        status(s,'사진과 리더 권한을 확인하고 있어요…');
        const attempt=s.attempt||={groupId:s.context.groupId,tripId:s.context.tripId,requestId:crypto.randomUUID(),format:s.format,template:s.template,includeTripTitle:s.includeTripTitle,postIds:[...s.selected]};
        try{
          const config=await call('configureShareImage',attempt);if(!valid(s) || version!==s.version)return;
          const decoded=await Promise.all(config.photos.map(async post=>[post.id,(await loadPhoto(s,post)).image]));
          await document.fonts.ready;if(!valid(s) || version!==s.version)return;
          const canvas=document.createElement('canvas');renderShareImage(canvas,config,new Map(decoded));const blob=await sharePng(canvas);
          if(!valid(s) || version!==s.version)return;
          const url=URL.createObjectURL(blob);urls.add(url);s.previewUrl=url;s.ready={config,blob,version,attempt};
          const image=document.createElement('img');image.src=url;image.alt=`${config.width}×${config.height} PNG 미리보기`;image.dataset.sharePng='';
          app.querySelector('#share-preview').replaceChildren(image);
          status(s,'미리보기가 준비됐어요. 사진 내용 확인 후 같은 PNG를 저장할 수 있어요.');
          track('share_image_create',{...common(s),format:config.format,template:config.template,photo_count:countBucket(config.photos.length)});
        }catch(error){s.ready=null;if(valid(s))status(s,'이미지를 만들지 못했어요. 사진을 모두 불러와야 저장할 수 있어요. 선택은 유지되니 다시 시도해주세요.');throw error;}
      });
    }
    if(action==='save'){
      const ready=s.ready;if(!ready || ready.version!==s.version || !app.querySelector('#share-privacy')?.checked){status(s,'미리보기와 사진 내용 확인을 먼저 완료해주세요.');return;}
      perform(async()=>{
        try{
          // Re-authorize immediately before download; membership/leadership may have changed.
          const confirmed=await call('configureShareImage',ready.attempt);if(!valid(s) || s.ready!==ready || s.version!==ready.version)return;
          if(confirmed.configId!==ready.config.configId)throw Error('구성이 달라졌어요.');
          await Promise.all(confirmed.photos.map(async p=>{const metadata=await api.getMetadata(api.ref(photoStorage,p.photo.objectPath));if(p.photo.generation && String(metadata.generation)!==p.photo.generation)throw Error('사진이 바뀌었어요.');}));
          if(!valid(s) || s.ready!==ready || !app.querySelector('#share-privacy')?.checked)return;
          const anchor=document.createElement('a');anchor.href=s.previewUrl;anchor.download=`our-adventure-${ready.config.template}-${ready.config.format}.png`;document.body.append(anchor);anchor.click();anchor.remove();
          track('share_image_save',{...common(s),format:ready.config.format,template:ready.config.template,result:'ok'});status(s,'미리보기와 같은 PNG의 다운로드를 시작했어요.');
        }catch(error){if(valid(s)){invalidate(s);status(s,'저장하지 못했어요. 사진과 권한을 다시 확인하고 미리보기를 만들어주세요.');}if(getUser()?.uid===s.uid)track('share_image_save',{...common(s),format:ready.config.format,template:ready.config.template,result:'error'});throw error;}
      });
    }
  });
  return {
    clear,
    async render(context,group,mode){
      clear();const s=active={context,group,mode,uid:getUser()?.uid,images:new Map(),selected:[],format:'feed',template:'grid',includeTripTitle:false,version:0,ready:null,attempt:null,limit:12};
      s.report=await call('getTripReport',{groupId:context.groupId,tripId:context.tripId});if(!valid(s))return '';
      const report=s.report,base=`#trip/${encodeURIComponent(context.groupId)}/${encodeURIComponent(context.tripId)}`;
      if(mode==='share'){
        if(!group.isOwner)return '<h2 id="trip-panel-title">리더만 결과 이미지를 구성할 수 있어요</h2><p>여행 리포트는 모든 멤버가 볼 수 있어요.</p><a href="'+base+'/report">리포트 보기</a>';
        return `<h2 id="trip-panel-title">인스타 이미지 만들기</h2><a href="${base}/report">여행 리포트로</a><div class="share-options"><label>이미지 크기<select id="share-format" aria-label="이미지 크기"><option value="feed">피드 1080×1350</option><option value="story">스토리 1080×1920</option></select></label><label>템플릿<select id="share-template" aria-label="템플릿"><option value="grid">사진 그리드</option><option value="board">도장판</option></select></label></div><label class="share-privacy"><input id="share-trip-title" type="checkbox">여행 이름 표시</label><p>사진 1~6장을 선택해주세요. 여행 이름은 선택한 경우에만 표시해요. 장소 이름과 한 줄 느낌은 넣지 않아요.</p><p id="share-selection">선택 0/6장</p><div id="share-picker" class="share-picker"></div><button class="secondary" data-report="more" hidden>사진 더 보기</button>${report.photoCount?'':'<p>저장된 사진이 없어요. 사진 없이 결과 이미지를 만들 수는 없어요.</p>'}<button data-report="preview" disabled>미리보기 만들기</button><p id="share-status" role="status" aria-live="polite"></p><p id="share-title-notice" role="status" hidden>여행 이름이 이미지에 들어가요</p><div id="share-preview" class="share-preview"></div><label class="share-privacy"><input id="share-privacy" type="checkbox">선택한 사진에 별칭 외 개인정보·위치 정보가 드러나지 않는지 확인했어요.</label><button data-report="save" disabled>PNG 저장</button>`;
      }
      track('report_view',common(s));
      return `<h2 id="trip-panel-title">여행 리포트</h2><p>${esc(report.startDate)} ~ ${esc(report.endDate)} · ${Number(report.days)||0}일</p><dl class="report-stats"><div><dt>장소</dt><dd data-report-value="places">${report.placeCount}</dd></div><div><dt>사진</dt><dd data-report-value="photos">${report.photoCount}</dd></div><div><dt>도장</dt><dd data-report-value="stamps">${report.stampCount} / ${report.stampTotal}</dd></div></dl>${group.isOwner?`<a class="button" href="${base}/share">인스타 이미지 만들기</a>`:''}<h3>멤버별 도장</h3><ul class="members">${report.members.map(m=>`<li><strong>${esc(m.alias)}</strong>${m.stampCount}/${report.placeCount}</li>`).join('')}</ul><h3>장소별 대표 사진</h3>${report.places.length?report.places.map(p=>`<article class="report-place"><h4>${esc(p.name)}</h4>${p.representative?`<div class="report-photo" data-report-photo="${esc(p.representative.id)}">사진 불러오는 중…</div><p>${esc(p.representative.alias)}</p>`:'<p>아직 남긴 사진이 없어요.</p>'}</article>`).join(''):'<p>장소 없이 남긴 자유 기록 여행이에요.</p>'}<h3>한 줄 모음</h3>${report.lines.length?report.lines.map(line=>`<blockquote><p>${esc(line.feeling)}</p><footer>${esc(line.alias)}</footer></blockquote>`).join(''):'<p>남긴 한 줄 느낌이 없어요.</p>'}<button class="secondary" data-report="reload">리포트 새로고침</button>`;
    },
    mount(){const s=active;if(!s || !valid(s) || !app.querySelector)return;if(s.mode==='share' && s.group.isOwner)picker(s);else if(s.mode==='report')void showPhotos(s,s.report.places.flatMap(p=>p.representative?[p.representative]:[]),'data-report-photo');}
  };
}
