const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const MAX_STOPS=60;
export const tripDays=trip=>Math.max(1,Math.min(366,Math.floor((Date.parse(trip.endDate)-Date.parse(trip.startDate))/86400000)+1||1));
export function dayLabel(day,trip){if(!day)return '일정 미정';const d=new Date(Date.parse(trip.startDate)+(day-1)*86400000);return `${day}일차${Number.isFinite(d.getTime())?' · '+d.toISOString().slice(5).replace('-','/') :''}`;}
export function groupItinerary(places,trip){
 const buckets=new Map();for(let day=1;day<=Math.min(tripDays(trip),31);day++)buckets.set(day,[]);
 for(const [index,p]of places.entries()){const day=Number.isInteger(p.day)&&p.day>=1&&p.day<=tripDays(trip)?p.day:null;if(!buckets.has(day))buckets.set(day,[]);buckets.get(day).push({...p,_order:index});}
 return [...buckets].sort(([a],[b])=>(a??999)-(b??999)).map(([day,items])=>({day,label:dayLabel(day,trip),places:items.sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99')||(a.order??a._order)-(b.order??b._order))}));
}
export function parseItinerary(text,{startDate='',endDate=''}={}){
 const input=String(text||'').trim();if(!input)return {entries:[],warnings:[]};
 if(input.length>50000)throw Error('일정 텍스트는 5만 자까지 읽을 수 있어요.');
 if(/^[\[{]/.test(input)){
   const data=JSON.parse(input);const entries=Array.isArray(data)?data:data.entries||data.places||data.days?.flatMap((d,i)=>(d.places||[]).map(p=>({...p,day:d.day||i+1})));
   if(!Array.isArray(entries))throw Error('JSON에 entries·places·days 중 일정 목록이 필요해요.');
   if(entries.length>MAX_STOPS)throw Error('일정은 최대 60개까지 가져올 수 있어요.');
   return {entries:entries.map(p=>typeof p==='string'?{name:p,day:null}:{...p,day:p.day?Number(p.day):null}),warnings:[],title:data.title,destination:data.destination,startDate:data.startDate,endDate:data.endDate};
 }
 let day=null;const entries=[],warnings=[];
 const lines=input.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
 const splitCsv=line=>{const cells=[];let s='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'&&quoted){s+='"';i++;}else if(c==='"')quoted=!quoted;else if((c===','||c==='\t')&&!quoted){cells.push(s.trim());s='';}else s+=c;}cells.push(s.trim());return cells;};
 const headers=splitCsv(lines[0]).map(x=>x.toLowerCase());
 const nameCol=headers.findIndex(x=>['장소','장소명','name','place'].includes(x));
 if(nameCol>=0&&headers.length>1){for(const line of lines.slice(1)){const cells=splitCsv(line),pick=names=>{const i=headers.findIndex(h=>names.includes(h));return i<0?'':cells[i]||'';};if(cells[nameCol])entries.push({name:cells[nameCol],day:Number(pick(['일차','day']))||null,startTime:pick(['시작','시작시간','starttime','time']),endTime:pick(['종료','종료시간','endtime']),note:pick(['메모','note']),description:pick(['설명','description'])});}}
 else for(const line of lines){
   const dm=line.match(/(?:DAY\s*(\d+)|(\d+)\s*일차)/i),date=line.match(/(?:(\d{4})[.\-/년]\s*)?(\d{1,2})[.\-/월]\s*(\d{1,2})(?:일)?/);
   if(dm){day=Number(dm[1]||dm[2]);if(!line.replace(dm[0],'').replace(/[\s:()\-·]/g,''))continue;}
   else if(date&&startDate){const year=date[1]||startDate.slice(0,4),d=`${year}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`;const n=Math.floor((Date.parse(d)-Date.parse(startDate))/86400000)+1;if(n>=1&&n<=tripDays({startDate,endDate}))day=n;if(/^[\d\s./월일년()요일화수목금토한일차-]+$/.test(line))continue;}
   const times=[...line.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)].map(m=>m[1].padStart(2,'0')+':'+m[2]);
   let name=line.replace(/\b([01]?\d|2[0-3]):[0-5]\d/g,'').replace(/^(?:DAY\s*\d+|\d+\s*일차)\s*[:·-]?/i,'').replace(/^[\s\-~–—|,•]+/,'').trim();
   if(!name)continue;
   const [place,...notes]=name.split(/\s+[|]\s+|\t/);let endTime=times[1]||'';
   if(times[0]&&endTime&&endTime<=times[0]){warnings.push(`${place}: 종료 시간을 확인해주세요.`);endTime='';}
   entries.push({name:place.slice(0,100),day,startTime:times[0]||'',endTime,note:notes.join(' · ').slice(0,500),description:''});
 }
 if(entries.length>MAX_STOPS)throw Error('일정은 최대 60개까지 가져올 수 있어요. 문서를 나누어 주세요.');
 if(entries.some(e=>!e.day))warnings.push('날짜가 없는 장소는 ‘일정 미정’에 두었어요. 일차를 선택해주세요.');
 return {entries,warnings,source:'text-rules'};
}
export const scheduleFields=(place,trip)=>`<div class="schedule-fields"><label>일차<select name="day" aria-label="일차"><option value="">일정 미정</option>${Array.from({length:tripDays(trip)},(_,i)=>`<option value="${i+1}" ${place.day===i+1?'selected':''}>${esc(dayLabel(i+1,trip))}</option>`).join('')}</select></label><label>시작 시간<input name="startTime" type="time" value="${esc(place.startTime||'')}"></label><label>종료 시간<input name="endTime" type="time" value="${esc(place.endTime||'')}"></label></div><label>일정 메모<textarea name="note" maxlength="500" rows="2">${esc(place.note||'')}</textarea></label><label>장소 설명<textarea name="description" maxlength="500" rows="2">${esc(place.description||'')}</textarea></label><p class="place-info-status" role="status"></p>`;
export const importMarkup=()=>`<section class="itinerary-import"><h2>일정 한 번에 가져오기</h2><p>시간표·메모·여행 문서를 날짜별 코스 초안으로 바꿔요.</p><label>일정 원문<textarea name="importText" rows="5" maxlength="50000" placeholder="1일차\n10:00~11:00 해동용궁사\n2일차\n09:00 해운대"></textarea></label><input type="file" class="file-input" aria-label="일정 파일" accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"><button type="button" class="secondary" data-import="file">${'파일 선택'}</button><span class="import-filename"></span><p class="muted">텍스트·CSV·JSON·PDF·사진·Word·Excel · 파일당 4MiB 이하</p><div class="row"><button type="button" data-import="ai">AI로 일정 분석</button><button type="button" class="secondary" data-import="text">텍스트 규칙으로 읽기</button></div><p class="muted">AI 분석 시 문서 내용을 외부 AI 서비스로 전송해요. 연락처·예약번호는 지우고 올려주세요. 분석 초안은 확인 후 반영해요.</p><p class="import-status" role="status"></p><div class="import-rows"></div></section>`;
export function mountImport(root,{trip:readTrip,analyze,lookup,existing=[],onResult=()=>{},valid=()=>true}){
 let entries=[],file=null;const status=t=>{if(valid())root.querySelector('.import-status').textContent=t;};
 function render(){root.querySelector('.import-rows').innerHTML=entries.map((p,i)=>`<details class="import-row" data-index="${i}" open><summary>${i+1}. ${esc(p.name||'장소 입력')}</summary><label>장소 이름<input name="entryName" value="${esc(p.name||'')}" maxlength="100" required></label>${existing.length?`<label>기존 장소 연결<select name="placeId"><option value="">같은 이름이면 자동 연결</option><option value="__new__" ${p.createNew?'selected':''}>새 일정으로 추가</option>${existing.map(old=>`<option value="${esc(old.id)}" ${old.id===p.placeId?'selected':''}>${esc(old.name)} · ${esc(dayLabel(old.day,readTrip()))}</option>`).join('')}</select></label>`:''}${scheduleFields(p,readTrip())}<button type="button" class="secondary" data-remove="${i}">이 일정 빼기</button></details>`).join('');}
 const read=()=>[...root.querySelectorAll('.import-row')].map(node=>{const p=entries[Number(node.dataset.index)],id=node.querySelector('[name=placeId]')?.value;const value={...p,name:node.querySelector('[name=entryName]').value.trim(),day:Number(node.querySelector('[name=day]').value)||null,startTime:node.querySelector('[name=startTime]').value,endTime:node.querySelector('[name=endTime]').value,note:node.querySelector('[name=note]').value,description:node.querySelector('[name=description]').value};delete value.placeId;delete value.createNew;if(id==='__new__')value.createNew=true;else if(id)value.placeId=id;return value;});
 async function load(ai){
  let text=root.querySelector('[name=importText]').value;let result;
  if(!ai){if(file){if(!/\.(txt|md|csv|json)$/i.test(file.name))throw Error('PDF·사진·Word·Excel은 AI 분석으로 읽어주세요.');text=await file.text();}result=parseItinerary(text,readTrip());}
  else{
    const data={text,...readTrip()};
    if(file){const encoded=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});
      const types={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',txt:'text/plain',md:'text/plain',csv:'text/csv',json:'application/json',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};data.file={name:file.name,type:file.type||types[file.name.split('.').at(-1).toLowerCase()],base64:encoded};}
    if(!text.trim()&&!file)throw Error('일정 텍스트나 파일을 넣어주세요.');result=await analyze(data);
  }
  if(!valid())return;
  if(!Array.isArray(result.entries)||!result.entries.length)throw Error('일정을 찾지 못했어요. 내용을 확인해주세요.');
  entries=result.entries;onResult(result);render();const activeTrip=readTrip();const dateWarning=result.startDate&&activeTrip.startDate&&result.startDate!==activeTrip.startDate?` 문서 시작일(${result.startDate})과 여행 시작일(${activeTrip.startDate})이 달라요. 일차를 확인해주세요.`:'';status(`${entries.length}개 일정을 읽었어요. 날짜·시간·장소를 확인하고 수정해주세요.${dateWarning}${result.warnings?.length?' '+result.warnings.join(' '):''}`);
 }
 root.addEventListener('change',e=>{if(e.target.type==='file'){const selected=e.target.files?.[0];if(!selected)return;if(selected.size>4*1024*1024){status('파일은 4MiB 이하여야 해요.');e.target.value='';return;}file=selected;root.querySelector('.import-filename').textContent=file.name;}});
 root.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.remove!==undefined){entries=read();entries.splice(Number(button.dataset.remove),1);render();return;}
  const action=button.dataset.import;if(!action)return;
  if(action==='file'){root.querySelector('input[type=file]').click();return;}
  const buttons=[...root.querySelectorAll('[data-import]')];buttons.forEach(b=>b.disabled=true);status('일정을 읽고 있어요…');
  try{await load(action==='ai');}catch(error){status(error.message||'읽지 못했어요. 입력과 파일은 유지됩니다.');}finally{buttons.forEach(b=>b.disabled=false);}
 });
 async function describe(input){
  if(!lookup)return;const node=input.closest('.import-row'),name=input.value.trim(),description=node.querySelector('[name=description]'),info=node.querySelector('.place-info-status');
  if(!name||description.value.trim())return;info.textContent='장소 설명을 찾고 있어요…';
  try{const r=await lookup(name);if(!valid()||!node.isConnected||input.value.trim()!==name||description.value.trim())return;description.value=r.description||'';entries[Number(node.dataset.index)].sourceUrl=r.sourceUrl||'';info.textContent=r.description?'위키백과 참고 설명 · 저장 전에 장소가 맞는지 확인해주세요.':'확인 가능한 설명을 찾지 못했어요. 직접 입력할 수 있어요.';}catch{if(node.isConnected)info.textContent='설명을 가져오지 못했어요. 직접 입력할 수 있어요.';}
 }
 root.addEventListener('focusout',e=>{if(e.target.name==='entryName')void describe(e.target);});
 return {read,hasEntries:()=>entries.length>0,set(rows,{lookupAll=false}={}){entries=rows;render();if(lookupAll)void(async()=>{for(const input of root.querySelectorAll('[name=entryName]')){if(!valid()||!input.isConnected)return;await describe(input);}})();}};
}
