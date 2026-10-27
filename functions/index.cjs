const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {createService} = require('./service.cjs');
const {createGroupService} = require('./group-service.cjs');
initializeApp();
const db=getFirestore();
const legacy = createService(db, {HttpsError, FieldValue, allowIndividual:process.env.ENABLE_INDIVIDUAL_PILOT === 'true'});
const groups=createGroupService(db,{HttpsError,FieldValue});
const service={...legacy,...groups.callables};
for (const [name, action] of Object.entries(service)) {
  exports[name] = onCall({region:'asia-northeast3', maxInstances:3, timeoutSeconds:30}, request => action(request.data,request.auth));
}
