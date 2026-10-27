import {spawn} from 'node:child_process';import {once} from 'node:events';import {mkdirSync,createWriteStream} from 'node:fs';
if(!process.env.FIREBASE_STORAGE_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST)throw Error('Demo emulators required');
mkdirSync('test-results',{recursive:true});const log=createWriteStream('test-results/ui-verify.log');
for(const mode of ['--groups-ui','--report-ui']){
  const child=spawn(process.execPath,['tests/callable-http.mjs',mode],{stdio:['ignore','pipe','pipe'],env:process.env});
  for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{process.stdout.write(data);log.write(data);});
  const [code,signal]=await once(child,'exit');if(code!==0){const message=`Test process exited: code=${code}, signal=${signal}\n`;log.write(message);process.stderr.write(message);process.exitCode=code??1;break;}
}
log.end();
