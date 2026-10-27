import {cpSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'public');
if(dirname(output)!==resolve(root))throw new Error('Unexpected public output directory');
process.chdir(root);
rmSync(output,{recursive:true,force:true});mkdirSync('public/next',{recursive:true});
cpSync('index.html','public/index.html');cpSync('assets','public/assets',{recursive:true});
for(const file of ['index.html','style.css','icons.mjs','ui.mjs','app.js','session.mjs','groups.mjs','trip-views.mjs','place-editor.mjs','illustrated-map.mjs','creation-requests.mjs','photo-upload.mjs','photo-views.mjs','photo-drafts.mjs','memory-feed.mjs','report-views.mjs','share-renderer.mjs','analytics.mjs','course.json'])cpSync(`next/${file}`,`public/next/${file}`);
cpSync('next/assets','public/next/assets',{recursive:true});
// Never publish a developer's local emulator configuration or backend source.
if(process.env.FIREBASE_WEB_CONFIG){
  const input=JSON.parse(process.env.FIREBASE_WEB_CONFIG);
  const keys=['apiKey','authDomain','projectId','appId'];
  if(!keys.every(k=>typeof input[k]==='string' && input[k].length>0))throw new Error('Incomplete Firebase public web configuration');
  const config=Object.fromEntries(keys.map(k=>[k,input[k]]));
  if(input.storageBucket!==undefined){if(!/^[a-z0-9][a-z0-9.-]+$/.test(input.storageBucket))throw Error('Invalid public Storage bucket');config.storageBucket=input.storageBucket;}
  const measurementId=input.measurementId??'G-Z7PFT0F4YL';
  if(!/^G-[A-Z0-9]+$/.test(measurementId))throw Error('Invalid Analytics measurement ID');config.measurementId=measurementId;
  writeFileSync('public/next/firebase-config.js',`export const firebaseConfig=${JSON.stringify(config)};\nexport const functionsRegion='asia-northeast3';\nexport const useEmulators=false;\n`);
}
