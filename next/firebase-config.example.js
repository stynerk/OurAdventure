// Copy to firebase-config.js. Only PUBLIC Firebase web configuration goes here.
// Enable Google + Anonymous Auth, authorize the Pages domain, deploy functions/rules.
export const firebaseConfig = {
  apiKey: 'YOUR_PUBLIC_WEB_API_KEY', authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT', appId: 'YOUR_PUBLIC_WEB_APP_ID'
};
export const functionsRegion = 'asia-northeast3';
export const useEmulators = false; // local localhost development ONLY

export const enableIndividualPilot = false; // Phase 1C only; backend flag also required
