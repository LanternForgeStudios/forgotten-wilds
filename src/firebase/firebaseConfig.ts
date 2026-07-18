import { initializeApp } from 'firebase/app';
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
