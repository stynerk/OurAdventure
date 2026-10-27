import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
export async function auditUi(page,name){
  if(process.env.UI_AUDIT!=='1')return;
  if(!process.env.UI_AUDIT_AXE_PATH)throw Error('UI_AUDIT_AXE_PATH is required for contrast/label verification');
  mkdirSync('test-results/ui-refresh',{recursive:true});
  if(name==='login'){
    const size=await page.locator('.login-cover img').evaluate(async image=>{await image.decode();return [image.naturalWidth,image.naturalHeight];});assert.deepEqual(size,[1170,2532]);
  }
  if(name==='memories'){
    const count=await page.locator('.memory-item').count();
    await page.getByRole('group',{name:'장소별 필터',exact:true}).getByRole('button',{name:'자유 기록',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.memory-item').length===1);
    await page.getByRole('group',{name:'사람별 필터',exact:true}).getByRole('button',{name:'테스트 멤버',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.memory-item').length===1);
    await page.getByRole('group',{name:'사람별 필터',exact:true}).getByRole('button',{name:'모든 사람',exact:true}).click();
    await page.getByRole('group',{name:'장소별 필터',exact:true}).getByRole('button',{name:'모든 장소',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.memory-photo img').length===n,count);
  }
  const all=[];
  for(const width of [320,375,390]){
    await page.setViewportSize({width,height:844});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
    const metrics=await page.evaluate(()=>{
      const visible=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return r.width>2 && r.height>2 && s.visibility!=='hidden' && s.display!=='none' && !node.closest('details:not([open]) nav,details:not([open]) .post-actions');};
      const touch=[];for(const node of document.querySelectorAll('main a,main button,main input,main select,main summary,header a,header summary')){
        if(!visible(node) || node.matches('input[type=file],.chip-source') || node.disabled)continue;
        const target=node.matches('input[type=checkbox],input[type=radio]')?node.closest('label')||node:node,r=target.getBoundingClientRect();
        if(r.width<43.8 || r.height<43.8)touch.push({text:node.textContent?.trim().slice(0,50)||node.getAttribute('aria-label'),width:r.width,height:r.height});
      }
      const emoji=[...document.querySelectorAll('#app [aria-hidden=true],.app-header .brand')].filter(visible).filter(n=>/\p{Extended_Pictographic}/u.test(n.textContent)).map(n=>n.textContent);
      const files=[...document.querySelectorAll('input[type=file]')].filter(visible).map(n=>n.name);
      const clipped=[...document.querySelectorAll('button,.filter-chip,.badge')].filter(visible).filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.textContent);
      return {width:innerWidth,scroll:document.documentElement.scrollWidth,touch,emoji,files,clipped};
    });
    writeFileSync('test-results/ui-refresh/last-audit.json',JSON.stringify({name,...metrics},null,2));
    assert.equal(metrics.scroll<=width,true,`${name}/${width}: horizontal overflow ${metrics.scroll}`);
    assert.deepEqual(metrics.touch,[],`${name}/${width}: touch target below 44px`);assert.deepEqual(metrics.emoji,[],`${name}: emoji icon`);assert.deepEqual(metrics.files,[],`${name}: native file control visible`);assert.deepEqual(metrics.clipped,[],`${name}: clipped control`);
    if(await page.locator('.trip-heading').count()){
      const layout=await page.evaluate(()=>{
        const bar=document.querySelector('.trip-heading'),panel=document.querySelector('.trip-panel'),bounds=bar.getBoundingClientRect();
        const issues=[];
        if(getComputedStyle(document.querySelector('.app-header')).display!=='none')issues.push('duplicate app header');
        if(bounds.height>65 || bounds.bottom>panel.getBoundingClientRect().top+1)issues.push('trip bar too tall or overlaps content');
        if(panel.classList.contains('view-map')){
          const map=panel.querySelector('.illustrated-map').getBoundingClientRect();
          if(map.left!==0 || Math.abs(map.right-innerWidth)>1 || map.bottom<innerHeight || document.documentElement.scrollHeight>innerHeight+1)issues.push('map does not fill viewport');
          if(bar.classList.contains('is-closed') && panel.querySelector('.map-pin.is-next'))issues.push('closed trip highlights next place');
          const hex=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().slice(1),accent=`rgb(${[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')})`;
          for(const pin of panel.querySelectorAll('.map-pin.is-incomplete .map-pin-dot'))if(getComputedStyle(pin).backgroundColor===accent)issues.push('incomplete pin has accent');
        }
        if(panel.classList.contains('view-stamps')){
          if(getComputedStyle(panel).backgroundColor!=='rgba(0, 0, 0, 0)' || getComputedStyle(panel).boxShadow!=='none')issues.push('nested stamp board card');
          if(getComputedStyle(panel.querySelector('.stamp-grid')).gridTemplateColumns.split(' ').length!==3)issues.push('stamp board is not three columns');
          for(const seal of panel.querySelectorAll('.stamp-tile.is-done .clay-seal>span'))if(seal.textContent==='완료' || !getComputedStyle(seal).fontFamily.includes('Jua'))issues.push('seal missing stamp name/Jua');
        }
        return issues;
      });
      assert.deepEqual(layout,[],`${name}/${width}: PM layout regression`);
    }
    if(process.env.UI_AUDIT_AXE_PATH){
      await page.addScriptTag({content:readFileSync(process.env.UI_AUDIT_AXE_PATH,'utf8')});
      const result=await page.evaluate(async()=>{const {violations}=await axe.run({include:[['main'],['.app-header']]},{runOnly:{type:'rule',values:['color-contrast','button-name','link-name','label','image-alt']}});return violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});
      assert.deepEqual(result,[],`${name}/${width}: accessibility violation`);
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.card,.clay-seal,.celebration-sparkles')].every(n=>getComputedStyle(n).animationName==='none')),true,'Reduced motion must suppress animation');
    if(name.startsWith('place-'))await page.locator('.place-dialog').screenshot({path:`test-results/ui-refresh/${name}-${width}.png`});
    else if(name==='stamp-complete' && await page.locator('.stamp-celebration').count())await page.locator('.stamp-celebration').screenshot({path:`test-results/ui-refresh/${name}-${width}.png`});
    else await page.screenshot({path:`test-results/ui-refresh/${name}-${width}.png`,fullPage:true});
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(300);
    all.push(metrics);
  }
  const file='test-results/ui-refresh/audit.json',prior=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};prior[name]=all;writeFileSync(file,JSON.stringify(prior,null,2));
  console.log(`PASS UI: ${name}, 320/375/390px, 44px touch, no emoji/native file control, axe contrast/labels, reduced motion`);
}
