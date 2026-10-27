import {spawn} from 'node:child_process';import {once} from 'node:events';import {mkdirSync,createWriteStream} from 'node:fs';
if(!process.env.FIREBASE_STORAGE_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST)throw Error('Storage and Firestore emulators required');
mkdirSync('test-results',{recursive:true});const log=createWriteStream('test-results/t8-verify.log');
for(const args of [['--experimental-test-isolation=none','--test','tests/photo-storage.integration.test.mjs'],['--experimental-test-isolation=none','--test','tests/group-model.integration.test.mjs'],['--experimental-test-isolation=none','--test','tests/integration.test.mjs'],['tests/callable-http.mjs','--groups-ui']]){
  const child=spawn(process.execPath,args,{stdio:['ignore','pipe','pipe'],env:process.env});
  child.stdout.on('data',data=>{process.stdout.write(data);log.write(data);});child.stderr.on('data',data=>{process.stderr.write(data);log.write(data);});
  const [code,signal]=await once(child,'exit');if(code!==0){const reason=`Test process exited: code=${code}, signal=${signal}\n`;process.stderr.write(reason);log.write(reason);log.end();process.exitCode=code??1;break;}
}
log.end();
