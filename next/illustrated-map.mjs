import {icon} from './icons.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// A story map of visit order, deliberately independent of geographic coordinates.
export function mapPositions(count) {
  const rows=Math.ceil(Math.min(count,10)/2);
  return Array.from({length:Math.min(count,10)},(_,i)=>{
    const row=Math.floor(i/2),column=row%2?1-i%2:i%2;
    return {x:column?460:180,y:rows===1?320:180+row*360/(rows-1)};
  });
}
export function illustratedMap(places,done,placeLink,{closed=false}={}) {
  const positions=mapPositions(places.length),height=Math.max(320,Math.ceil(places.length/2)*100+80);
  return `<figure class="illustrated-map" style="height:${height}px" aria-label="장소별 탐험 그림 지도"><svg viewBox="0 0 640 640" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <rect width="640" height="640" rx="26" fill="#e9f0db"/><path d="M0 90 Q140 10 290 95 T640 70 V0 H0Z" fill="#dae7ce"/>
    <path d="M35 95 Q100 12 160 95 Q210 35 260 95Z" fill="#a7bea1"/>
    <path d="M0 470 Q160 415 260 520 T640 510 V640 H0Z" fill="#d6e3bf"/>
    <path d="M330 340 Q400 300 465 355 T610 420 Q590 475 510 465 T340 425 Q300 385 330 340Z" fill="#badbd9"/>
    <path d="M350 380 Q405 355 455 395 M470 420 Q525 400 565 425" fill="none" stroke="#94c4c3" stroke-width="5" stroke-linecap="round"/>
    ${[[55,180],[575,225],[65,410],[565,555],[270,560]].map(([x,y])=>`<g transform="translate(${x} ${y})"><path d="M0 0 V30" stroke="#958269" stroke-width="8"/><ellipse cy="-12" rx="23" ry="34" fill="#9ab68b"/></g>`).join('')}
    ${positions.length>1?`<polyline class="map-route" points="${positions.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="#b79d70" stroke-width="7" stroke-dasharray="7 13" stroke-linecap="round" stroke-linejoin="round"/>`:''}
    <path d="M290 160 l30 -24 30 24 v34 h-60Z" fill="#f9efcf"/><path d="M280 160 l40 -34 40 34" fill="none" stroke="#bb8c71" stroke-width="11" stroke-linecap="round"/>
  </svg><svg class="map-sun" viewBox="0 0 54 54" aria-hidden="true" focusable="false"><circle cx="27" cy="27" r="27" fill="#f1cd70"/></svg>${positions.map((point,i)=>{const p=places[i],complete=done.has(p.id),next=!closed && places.find(item=>!done.has(item.id))?.id===p.id;return `<a class="map-pin ${complete?'is-done':next?'is-next':'is-incomplete'}" href="${escape(placeLink(p))}" style="left:${point.x/6.4}%;top:${point.y/6.4}%;--stamp-face:${["#ff8a65","#6fa3f5","#3dbb8a","#8b74e0"][i%4]};--stamp-ink:${["#572314","#153765","#123d2b","#201044"][i%4]}" aria-label="${i+1}. ${escape(p.name)} · 내 스탬프 ${complete?'완료':'미완료'}"><span class="map-pin-dot" aria-hidden="true">${complete?icon('check'):i+1}</span><span class="map-pin-label">${i+1}. ${escape(p.name)}</span></a>`;}).join('')}</figure><p class="muted">방문 순서를 나타낸 그림 지도예요. 핀을 눌러 장소를 열어보세요.</p>`;
}
