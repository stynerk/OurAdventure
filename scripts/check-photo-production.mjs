// Read-only operational preflight. Uses the existing Firebase CLI login; never
// creates identities, changes IAM, publishes rules or writes application data.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
export function photoProductionChecks({projectNumber,bindings,bucket,storageRules,finalizerState}){
  const agent=`serviceAccount:service-${projectNumber}@gcp-sa-firebasestorage.iam.gserviceaccount.com`;
  const crossService=/firestore\.(get|exists)\s*\(/.test(storageRules);
  const bound=bindings.some(b=>b.role==='roles/firebaserules.firestoreServiceAgent'&&b.members?.includes(agent)&&!b.condition);
  return [
    {check:'storage-firestore-cross-service-role',passed:!crossService||bound,reason:crossService&&!bound?'Storage rules query Firestore but the Storage service agent has no unconditional Firebase Rules Firestore Service Agent binding.':'ok'},
    {check:'photo-read-cors',passed:(bucket.cors||[]).some(c=>c.origin?.includes('https://stynerk.github.io')&&c.method?.includes('GET')),reason:'Authenticated SDK photo reads require the app origin. Upload API preflight must be checked separately.'},
    {check:'finalize-photo-active',passed:finalizerState==='ACTIVE',reason:finalizerState||'missing'}
  ];
}
export async function inspectPhotoProduction(project){
  if(project!=='our-adventures-5ce50')throw Error('Pass --project our-adventures-5ce50 explicitly.');
  const lib=n=>require('firebase-tools/lib/'+n),account=lib('auth').getGlobalDefaultAccount();
  if(!account)throw Error('Existing Firebase CLI login required.');
  await lib('requireAuth').requireAuth({project,...account},true);
  const {Client}=lib('apiv2'),crm=new Client({urlPrefix:'https://cloudresourcemanager.googleapis.com',apiVersion:'v1'}),rules=new Client({urlPrefix:'https://firebaserules.googleapis.com',apiVersion:'v1'});
  const [projectInfo,policy,bucket,release,functions]=await Promise.all([
    crm.get('/projects/'+project),crm.post('/projects/'+project+':getIamPolicy',{}),
    lib('gcp/storage').getBucket(project+'.firebasestorage.app'),
    rules.get(`/projects/${project}/releases/firebase.storage/${project}.firebasestorage.app`),
    new Client({urlPrefix:'https://cloudfunctions.googleapis.com',apiVersion:'v2'}).get(`/projects/${project}/locations/asia-northeast3/functions`)
  ]);
  const source=await rules.get('/'+release.body.rulesetName);
  return photoProductionChecks({projectNumber:projectInfo.body.projectNumber,bindings:policy.body.bindings||[],bucket,storageRules:(source.body.source?.files||[]).map(f=>f.content).join('\n'),finalizerState:(functions.body.functions||[]).find(f=>f.name.endsWith('/finalizePhoto'))?.state});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const project=process.argv[process.argv.indexOf('--project')+1];
  try{const checks=await inspectPhotoProduction(project);for(const check of checks)console.log(JSON.stringify(check));process.exitCode=checks.every(c=>c.passed)?0:1;}
  catch(error){console.error(JSON.stringify({check:'photo-production-preflight',passed:false,status:error.status||null,reason:'Could not complete read-only preflight. Check project selection, existing CLI authentication and read access.'}));process.exitCode=1;}
}
