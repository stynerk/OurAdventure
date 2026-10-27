// Focused retry after browser-test changes; requires the same demo emulators.
import {spawn} from 'node:child_process';import {once} from 'node:events';import {mkdirSync,createWriteStream} from 'node:fs';
if(!process.env.FIREBASE_STORAGE_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST)throw Error('Demo Storage and Firestore emulators required');
mkdirSync('test-results',{recursive:true});const log=createWriteStream('test-results/qa-v2-browser.log');
for(const mode of ['--groups-ui','--report-ui']){
  const child=spawn(process.execPath,['tests/callable-http.mjs',mode],{stdio:['ignore','pipe','pipe'],env:process.env});
  for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{process.stdout.write(data);log.write(data);});
  const [code,signal]=await once(child,'exit');if(code!==0){const reason=`Test process exited: code=${code}, signal=${signal}\n`;log.write(reason);process.stderr.write(reason);process.exitCode=code??1;break;}
}
log.end();
