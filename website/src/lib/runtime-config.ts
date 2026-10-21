// The sign-in values (Google and Apple client ids, App Check) are not written into the build. The server reads them
// from its environment each time it serves a page and sends them to the browser in an inline script (`configScript`,
// in the root layout), so changing one means restarting the container, not building the image again. In production
// they come from the shared server/.env (see deploy/server/website.sh). All four are public values — a browser
// needs them — so nothing secret goes through here.

export interface RuntimeConfig {
  googleClientId: string;
  appleClientId: string;
  /** The Firebase web app config as one line of JSON. */
  firebaseConfig: string;
  recaptchaSiteKey: string;
}

const GLOBAL = '__HHB_CONFIG__';
const EMPTY: RuntimeConfig = { googleClientId: '', appleClientId: '', firebaseConfig: '', recaptchaSiteKey: '' };

/** What this server process was started with. Only call it on the server. */
function configFromEnvironment(): RuntimeConfig {
  return {
    googleClientId: process.env.WEBSITE_GOOGLE_CLIENT_ID ?? '',
    appleClientId: process.env.WEBSITE_APPLE_CLIENT_ID ?? '',
    firebaseConfig: process.env.WEBSITE_FIREBASE_CONFIG ?? '',
    recaptchaSiteKey: process.env.WEBSITE_RECAPTCHA_SITE_KEY ?? '',
  };
}

/** The script that carries the config to the browser. `<` is escaped so a value can never close the tag. */
export function configScript(): string {
  return `window.${GLOBAL}=${JSON.stringify(configFromEnvironment()).replace(/</g, '\\u003c')}`;
}

/** The config wherever this runs: the server reads its environment, the browser reads what the page was sent. */
export function runtimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return configFromEnvironment();
  return (window as unknown as Record<string, RuntimeConfig | undefined>)[GLOBAL] ?? EMPTY;
}
