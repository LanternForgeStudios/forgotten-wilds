import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);

// App Check: attaches a verifiable-app-instance token to every outgoing Firestore/Functions call,
// so a Cloud Function with enforceAppCheck: true can reject a scripted call that only has a valid
// Auth token but didn't come from this actual client (the class of exploit that let a fresh
// character skip straight to a dungeon's finale room by calling enterLocation directly - see that
// function's own LOCATION_GATES fix; App Check is the general-purpose defense against the same
// "not really the game client" pattern, on every function, not just the ones we've already
// hand-hardened). Deliberately a no-op until VITE_RECAPTCHA_SITE_KEY is actually set - see
// README's setup steps for registering the app in Firebase Console → App Check first. Local
// dev/emulators use the debug provider (real reCAPTCHA can't verify a localhost origin) - the
// first local run logs a debug token to the console that needs registering in the same App Check
// console page, same one-time step as an authorized domain.
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
// experimentalAutoDetectLongPolling: Firestore's realtime Listen channel defaults to WebChannel
// over QUIC, which some networks/security software silently degrade (packet loss/retransmission
// failures - surfaces in devtools as ERR_QUIC_PROTOCOL_ERROR / QUIC_TOO_MANY_RTOS on the /Listen
// endpoint), stalling anything waiting on a live Firestore listener until the SDK's own retry
// logic recovers. This makes one detection request up front to pick long-polling instead whenever
// the environment needs it, rather than only falling back reactively after visible failures -
// Firebase's own documented fix for this exact symptom class.
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
export const functions = getFunctions(app);

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
