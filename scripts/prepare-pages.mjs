import {cpSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
rmSync('public',{recursive:true,force:true});mkdirSync('public/next',{recursive:true});
cpSync('index.html','public/index.html');cpSync('assets','public/assets',{recursive:true});
for(const file of ['index.html','style.css','app.js','session.mjs','course.json'])cpSync(`next/${file}`,`public/next/${file}`);
// Never publish a developer's local emulator configuration or backend source.
if(process.env.FIREBASE_WEB_CONFIG){
  const input=JSON.parse(process.env.FIREBASE_WEB_CONFIG);
  const keys=['apiKey','authDomain','projectId','appId'];
  if(!keys.every(k=>typeof input[k]==='string' && input[k].length>0))throw new Error('Incomplete Firebase public web configuration');
  const config=Object.fromEntries(keys.map(k=>[k,input[k]]));
  writeFileSync('public/next/firebase-config.js',`export const firebaseConfig=${JSON.stringify(config)};\nexport const functionsRegion='asia-northeast3';\nexport const useEmulators=false;\n`);
}
