import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const css=readFileSync('next/style.css','utf8');
const luminance=hex=>hex.match(/[a-f\d]{2}/gi).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('UI text palette meets 4.5:1 including muted text on app background and action buttons',()=>{
  const token=name=>css.match(new RegExp('--'+name+':(#[a-f0-9]{6})'))[1];
  for(const [a,b]of [[token('ink'),'#ffffff'],[token('muted'),'#ffffff'],[token('muted'),token('bg')],['#ffffff',token('accent')],[token('accent-ink'),token('accent-soft')]])assert.ok(contrast(a,b)>=4.5,`${a}/${b}: ${contrast(a,b)}`);
});
test('cover export is within budget with recorded hashes and licensed self-hosted fonts/icons; motion has a reduced alternative',()=>{
  const metadata=JSON.parse(readFileSync('docs/engineering/ui-refresh/cover-metadata.json'));
  for(const file of metadata.outputs){const bytes=readFileSync('next/assets/'+file.file);assert.ok(bytes.length<=400*1024);assert.equal(file.width,1170);assert.equal(file.height,2532);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
  for(const file of ['Pretendard-OFL.txt','Jua-OFL.txt'])assert.match(readFileSync('next/assets/'+file,'utf8'),/OPEN FONT LICENSE/i);
  assert.match(readFileSync('next/assets/Lucide-LICENSE.txt','utf8'),/ISC/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  for(const file of ['app.js','groups.mjs','trip-views.mjs','photo-views.mjs','memory-feed.mjs','index.html'])assert.doesNotMatch(readFileSync('next/'+file,'utf8'),/\p{Extended_Pictographic}/u,file+' contains an emoji icon');
});
