/**
 * Optional Firebase Analytics bootstrap. Socket.IO remains the only realtime
 * game backend. Web app config is public by design; never place admin keys here.
 */
type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
};

const providedConfig: FirebaseConfig = {
  apiKey: "AIzaSyCYP-Sd5oaQHWyQIHUnggZVHiz1BEqABLk",
  authDomain: "my-projectcaptain-e561e.firebaseapp.com",
  databaseURL: "https://my-projectcaptain-e561e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "my-projectcaptain-e561e",
  storageBucket: "my-projectcaptain-e561e.firebasestorage.app",
  messagingSenderId: "952448514806",
  appId: "1:952448514806:web:6f40b94a7ce2ae3b5a4ad7",
  measurementId: "G-1W1TQZ66JV",
};

let started = false;

export async function initializeFirebaseAnalytics(): Promise<void> {
  if (started || typeof window === "undefined") return;
  started = true;

  try {
    // Use the official modular browser SDK; loading it is isolated from the game.
    const appSdkUrl = "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
    const analyticsSdkUrl = "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
    const [appSdk, analyticsSdk] = await Promise.all([
      import(/* @vite-ignore */ appSdkUrl),
      import(/* @vite-ignore */ analyticsSdkUrl),
    ]);
    const config: FirebaseConfig = {
      ...providedConfig,
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || providedConfig.apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || providedConfig.authDomain,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || providedConfig.databaseURL,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || providedConfig.projectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || providedConfig.storageBucket,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || providedConfig.messagingSenderId,
      appId: import.meta.env.VITE_FIREBASE_APP_ID || providedConfig.appId,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || providedConfig.measurementId,
    };
    if (await analyticsSdk.isSupported()) {
      const app = appSdk.initializeApp(config, "who-stole-the-moon");
      analyticsSdk.getAnalytics(app);
    }
  } catch (error) {
    // Analytics is observability only. CDN, consent, or browser support failures
    // must never prevent the village or multiplayer socket from starting.
    console.info("Firebase Analytics is unavailable; gameplay is unaffected.", error);
  }
}
