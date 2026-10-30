// Local HTTP harness for the actual exported Firebase callable handlers.
// Uses real Auth/Firestore emulators and validates SDK auth tokens in the callable
// wrapper. It does not replace production Cloud Run/Functions deployment testing.
// Useful in environments where the official Functions emulator's Unix sockets
// are unavailable. No product code or SDK security behavior is mocked.
import express from 'express';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Run only inside demo Auth and Firestore emulators');
process.env.GCLOUD_PROJECT='demo-our-adventure';
if(process.env.FIREBASE_STORAGE_EMULATOR_HOST)process.env.PHOTO_STORAGE_BUCKET='demo-our-adventure.firebasestorage.app';
process.env.ENABLE_INDIVIDUAL_PILOT='true'; // Explicit test-only Phase 1C coverage.
const require=createRequire(import.meta.url),functionRequire=createRequire(new URL('../functions/index.cjs',import.meta.url)),handlers=require('../functions/index.cjs');
const serverApp=express();serverApp.use(express.json());
serverApp.all('/demo-our-adventure/asia-northeast3/:name',(req,res)=>{
  const handler=handlers[req.params.name];if(!handler)return res.status(404).end();return handler(req,res);
});
const server=serverApp.listen(5001,'127.0.0.1');await once(server,'listening');
async function run(file){const proc=spawn(process.execPath,[file],{stdio:'inherit',env:process.env});const [code]=await once(proc,'exit');if(code!==0)throw new Error(`${file} failed (${code})`);}
try{if(process.argv.includes('--navigation-ui'))await run('tests/navigation-browser.mjs');else if(process.argv.includes('--report-ui'))await run('tests/report-browser.mjs');else{await run('tests/client.mjs');if(process.argv.includes('--groups-ui'))await run('tests/groups-browser.mjs');else if(!process.argv.includes('--client-only'))await run('tests/browser.mjs');}}
finally{server.closeAllConnections();server.close();const {getApps,deleteApp}=functionRequire('firebase-admin/app');await functionRequire('firebase-admin/firestore').getFirestore().terminate();await Promise.all(getApps().map(deleteApp));}
