// Demo-only aggregate runner: rules/transaction tests, then real SDK and browser flows.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Demo emulators required');
for(const args of [['--test','tests/integration.test.mjs','tests/group-model.integration.test.mjs'],['tests/callable-http.mjs','--groups-ui']]){
  const child=spawn(process.execPath,args,{stdio:'inherit',env:process.env});
  const [code]=await once(child,'exit');if(code!==0)process.exit(code??1);
}
