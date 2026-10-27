import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
test('versioned course reuses all nine legacy quests without changing the root app',()=>{
  const original=readFileSync('index.html','utf8');
  // Git may check text files out as CRLF on Windows; compare canonical content.
  assert.equal(createHash('sha256').update(original.replace(/\r\n/g,'\n')).digest('hex'),'bc3ebfb4390f68f432bee3884616baa989ea8e04b60a35800cc24b49288921d8');
  const legacy=JSON.parse(original.match(/var quests=(\[[\s\S]*?\n\]);/)[1]);
  const course=JSON.parse(readFileSync('next/course.json'));
  assert.deepEqual(course.quests,legacy);
  assert.equal(new Set(course.questIds).size,9);
  assert.equal(course.requiredQuestIds.length,9);
  assert.equal(readFileSync('next/course.json','utf8'),readFileSync('functions/course.json','utf8'));
});
test('client scripts parse and legacy hidden-screen regression stays fixed',()=>{
  for(const path of ['next/app.js','next/groups.mjs','next/trip-views.mjs','next/creation-requests.mjs','scripts/extract-course.mjs','functions/index.cjs','functions/service.cjs'])execFileSync(process.execPath,['--check',path]);
  assert.match(readFileSync('index.html','utf8'),/\[hidden\]\{display:none!important\}/);
});
test('Pages packages only public files and emits production-only config from explicit fields',()=>{
  const config={apiKey:'public-key',authDomain:'example.firebaseapp.com',projectId:'example',appId:'public-app',useEmulators:true,privateField:'must-not-be-published'};
  execFileSync(process.execPath,['scripts/prepare-pages.mjs'],{env:{...process.env,FIREBASE_WEB_CONFIG:JSON.stringify(config)}});
  assert.equal(readFileSync('public/index.html','utf8'),readFileSync('index.html','utf8'));
  assert.equal(existsSync('public/functions'),false);
  assert.equal(existsSync('public/docs'),false);
  assert.equal(existsSync('public/node_modules'),false);
  assert.equal(readFileSync('public/next/session.mjs','utf8'),readFileSync('next/session.mjs','utf8'));
  for(const file of ['groups.mjs','trip-views.mjs','illustrated-map.mjs','creation-requests.mjs','photo-upload.mjs','photo-views.mjs','photo-drafts.mjs','analytics.mjs'])assert.equal(readFileSync('public/next/'+file,'utf8'),readFileSync('next/'+file,'utf8'));
  const output=readFileSync('public/next/firebase-config.js','utf8');
  assert.match(output,/useEmulators=false/);assert.doesNotMatch(output,/privateField|must-not-be-published/);
  execFileSync(process.execPath,['scripts/prepare-pages.mjs'],{env:{...process.env,FIREBASE_WEB_CONFIG:''}});
  assert.equal(existsSync('public/next/firebase-config.js'),false);
});
