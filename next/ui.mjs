import {icon} from './icons.mjs';
export const cover=(className='')=>`<picture class="cover-picture ${className}"><source srcset="./assets/travel-cover-v2.webp" type="image/webp"><img src="./assets/travel-cover-v2.jpg" alt="" width="1170" height="2532" decoding="async"></picture>`;
export const avatar=(name='')=>`<span class="avatar" aria-hidden="true">${String(name).trim().slice(0,1).replace(/[&<>"']/g,'')||icon('user')}</span>`;
export function celebrateStamp({app,context,result,photo,feeling}){
  app.querySelector('.stamp-celebration')?.remove();
  const card=document.createElement('dialog');card.className='stamp-celebration';card.setAttribute('aria-label','도장 획득');
  // Only called after server-confirmed completion. User text stays textContent.
  card.innerHTML=`<div class="celebration-sparkles" aria-hidden="true"></div><div class="clay-seal large">${icon('check')}<span>획득 완료</span></div><h2>도장 쾅!</h2><p>우리 여행에 발견 하나를 더했어요.</p><progress max="${Math.max(1,Number(result.stampsTotal)||1)}" value="${Number(result.stampsDone)||0}" aria-label="내 도장 진행률"></progress><div class="celebration-photo"></div><p class="celebration-line"></p><a class="button ink" href="#trip/${encodeURIComponent(context.groupId)}/${encodeURIComponent(context.tripId)}/map">다음 장소 보기 ${icon('arrow-right')}</a><button type="button" class="secondary" data-ui-dismiss>사진 더 남기기</button>`;
  if(photo){const image=document.createElement('img');image.src=photo;image.alt='방금 남긴 여행 사진';card.querySelector('.celebration-photo').append(image);}
  card.querySelector('.celebration-line').textContent=feeling||'사진으로 남긴 오늘의 발견';
  app.querySelector('#photo-stamp')?.before(card);
  card.addEventListener('close',()=>card.remove());card.querySelector('a').addEventListener('click',()=>card.close());card.showModal();
}
export function initUi(){
  document.querySelector('.brand>svg')?.replaceWith(document.createRange().createContextualFragment(icon('compass')));
  const profile=document.querySelector('.profile-menu>summary');if(profile)profile.innerHTML=icon('user');
  let queued=false;
  function enhance(){
    queued=false;
    for(const select of document.querySelectorAll('select[data-feed-filter]:not([data-chip-ready])')){
      select.dataset.chipReady='';select.classList.add('chip-source');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
      const group=document.createElement('div');group.className='filter-chips';group.setAttribute('role','group');group.setAttribute('aria-label',select.getAttribute('aria-label')+' 필터');
      for(const option of select.options){const button=document.createElement('button');button.type='button';button.className='filter-chip';button.textContent=option.textContent;button.dataset.uiFilter=select.dataset.feedFilter;button.dataset.value=option.value;button.setAttribute('aria-pressed',String(select.value===option.value));group.append(button);}
      select.closest('label').after(group);
    }
    for(const button of document.querySelectorAll('#app button:not([data-ui-icon])')){
      button.dataset.uiIcon='';if(button.querySelector('svg') || button.classList.contains('filter-chip'))continue;
      const text=button.textContent;let name=/삭제/.test(text)?'trash-2':/수정/.test(text)?'pencil':/저장|PNG/.test(text)?'download':/로그인|시작/.test(text)?'log-in':/로그아웃/.test(text)?'log-out':/새로|다시/.test(text)?'refresh-cw':/생성|만들기/.test(text)?'plus':/복사|초대/.test(text)?'link':null;
      if(name)button.insertAdjacentHTML('afterbegin',icon(name));
    }
    for(const row of document.querySelectorAll('.members li:not([data-ui-avatar])')){
      row.dataset.uiAvatar='';const strong=row.querySelector('strong');if(strong)row.insertAdjacentHTML('afterbegin',avatar(strong.textContent));
    }
  }
  new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(enhance);}}).observe(document.querySelector('#app'),{childList:true,subtree:true});
  document.addEventListener('change',event=>{
    const select=event.target;if(!select.matches('select[data-feed-filter]'))return;
    for(const button of document.querySelectorAll(`[data-ui-filter="${select.dataset.feedFilter}"]`))button.setAttribute('aria-pressed',String(button.dataset.value===select.value));
  });
  document.addEventListener('click',event=>{
    const filter=event.target.closest('[data-ui-filter]');
    if(filter && !filter.disabled){const select=document.querySelector(`select[data-feed-filter="${filter.dataset.uiFilter}"]`);if(select){select.value=filter.dataset.value;select.dispatchEvent(new Event('change',{bubbles:true}));}}
    const trigger=event.target.closest('[data-file-trigger]');if(trigger && !trigger.disabled)trigger.closest('form')?.querySelector(`input[name="${trigger.dataset.fileTrigger}"]`)?.click();
    if(event.target.closest('[data-ui-dismiss]'))event.target.closest('.stamp-celebration')?.close();
  });
  enhance();
}
