/**
 * Firebase Console > Project settings > Your apps > Web app > SDK setup
 * Copy the public web app configuration values into this file.
 * Firebase web API keys are public identifiers, NOT admin/server credentials.
 * Never put service account JSON or private keys in this repository.
 */
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.trim().length > 0
);
