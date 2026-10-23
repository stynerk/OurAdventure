const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {createService} = require('./service.cjs');
initializeApp();
const service = createService(getFirestore(), {HttpsError, FieldValue, allowIndividual:process.env.ENABLE_INDIVIDUAL_PILOT === 'true'});
for (const [name, action] of Object.entries(service)) {
  exports[name] = onCall({region:'asia-northeast3', maxInstances:3, timeoutSeconds:30}, request => action(request.data,request.auth));
}
