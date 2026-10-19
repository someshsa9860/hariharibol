// Firebase App Check, which the API requires on sign-in when it runs with APP_CHECK_ENABLED (production).
// Loaded only when the site is configured for it and only at sign-in, so nobody else downloads Firebase.

import { FIREBASE_CONFIG, RECAPTCHA_SITE_KEY } from '@/lib/config';

type Getter = () => Promise<string | undefined>;
let getter: Getter | null | undefined;

async function setup(): Promise<Getter | null> {
  if (!FIREBASE_CONFIG || !RECAPTCHA_SITE_KEY) return null;
  const [{ initializeApp, getApps }, appCheck] = await Promise.all([import('firebase/app'), import('firebase/app-check')]);
  const app = getApps()[0] ?? initializeApp(JSON.parse(FIREBASE_CONFIG));
  const instance = appCheck.initializeAppCheck(app, {
    provider: new appCheck.ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
  return async () => (await appCheck.getToken(instance)).token;
}

/** A fresh App Check token, or undefined when the site is not set up for it (the API then must not require it). */
export async function appCheckToken(): Promise<string | undefined> {
  if (getter === undefined) {
    try {
      getter = await setup();
    } catch {
      getter = null;
    }
  }
  try {
    return getter ? await getter() : undefined;
  } catch {
    return undefined;
  }
}
