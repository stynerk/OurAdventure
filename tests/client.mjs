// Firebase SDK -> Auth emulator -> callable Functions -> Firestore realtime listener.
// These are separate client sessions, not physical devices or a browser UI test.
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInAnonymously,signInWithCredential,GoogleAuthProvider} from 'firebase/auth';
import {getFunctions,connectFunctionsEmulator,httpsCallable} from 'firebase/functions';
import {getFirestore,connectFirestoreEmulator,doc,onSnapshot,terminate} from 'firebase/firestore';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const projectId='demo-our-adventure', sessions=[];
function session(name){
  const app=initializeApp({projectId,apiKey:'demo-key',authDomain:`${projectId}.firebaseapp.com`},name);
  const auth=getAuth(app),db=getFirestore(app),fn=getFunctions(app,'asia-northeast3');
  connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  connectFirestoreEmulator(db,'127.0.0.1',8085);connectFunctionsEmulator(fn,'127.0.0.1',5001);
  const result={app,auth,db,call:async(name,data)=>(await httpsCallable(fn,name,{timeout:15000})(data)).data};sessions.push(result);return result;
}
try{
  const leader=session('sdk-owner'),a=session('sdk-a'),b=session('sdk-b');
  const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const token=encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://accounts.google.com',sub:'sdk-leader',aud:'demo',email:'sdk@example.test',email_verified:true})+'.';
  await signInWithCredential(leader.auth,GoogleAuthProvider.credential(token));
  await Promise.all([signInAnonymously(a.auth),signInAnonymously(b.auth)]);
  await assert.rejects(a.call('createRoom',{title:'blocked',mode:'shared',courseId:'gyeongju-v1'}),e=>e.code==='functions/permission-denied');
  const request={title:'SDK 동기화 테스트',mode:'shared',courseId:'gyeongju-v1',requestId:randomUUID()};
  const room=await leader.call('createRoom',request);
  const replay=await leader.call('createRoom',request);
  assert.equal(replay.roomId,room.roomId);assert.equal(replay.token,null);
  await Promise.all([a,b].map(s=>s.call('joinRoom',{token:room.token,nickname:'가상 탐험가'})));
  let stop;
  const received=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{stop?.();reject(new Error('Realtime event timed out'));},15000);
    stop=onSnapshot(doc(b.db,'rooms',room.roomId),snap=>{
      if(snap.data()?.sharedDone.includes('museum')){clearTimeout(timeout);stop();resolve();}
    },reject);
  });
  await a.call('completeQuest',{roomId:room.roomId,questId:'museum'});await received;
  await leader.call('closeRoom',{roomId:room.roomId});
  await assert.rejects(a.call('completeQuest',{roomId:room.roomId,questId:'bulguksa'}),e=>e.code==='functions/failed-precondition');
  console.log('PASS: three authenticated SDK sessions; callable auth rejection, room create/join, realtime stamp, closed-room rejection');
}finally{await Promise.all(sessions.map(async s=>{await terminate(s.db);await deleteApp(s.app);}));}
