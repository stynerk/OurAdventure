import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),env={...process.env};
for(const key of ['FIREBASE_TOKEN','GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_OAUTH_ACCESS_TOKEN','FIREBASE_CONFIG'])delete env[key];
const child=spawn(process.execPath,[resolve(root,'node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:exec','--project','demo-our-adventure','--only','auth,firestore,storage','node tests/report-verify.mjs'],{cwd:root,env,stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
