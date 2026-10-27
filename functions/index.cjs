const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {createService} = require('./service.cjs');
const {createGroupService} = require('./group-service.cjs');
const {getStorage}=require('firebase-admin/storage');
const {createPhotoVerifier}=require('./photo-verifier.cjs');
const firebaseApp=initializeApp();
const db=getFirestore();
const legacy = createService(db, {HttpsError, FieldValue, allowIndividual:process.env.ENABLE_INDIVIDUAL_PILOT === 'true'});
const bucketName=process.env.PHOTO_STORAGE_BUCKET || firebaseApp.options.storageBucket || `${process.env.GCLOUD_PROJECT||firebaseApp.options.projectId}.firebasestorage.app`;
const groups=createGroupService(db,{HttpsError,FieldValue,verifyPhoto:createPhotoVerifier(getStorage().bucket(bucketName),{HttpsError})});
const service={...legacy,...groups.callables};
for (const [name, action] of Object.entries(service)) {
  exports[name] = onCall({region:'asia-northeast3', maxInstances:3, timeoutSeconds:30}, request => action(request.data,request.auth));
}
