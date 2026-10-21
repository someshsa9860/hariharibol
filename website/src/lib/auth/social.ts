'use client';

// Google and Apple, in the browser. Each gives back an identity token that the API verifies itself
// (POST /auth/social) — the site never trusts it.

import { APPLE_REDIRECT_URI } from '@/lib/config';
import { runtimeConfig } from '@/lib/runtime-config';

export const googleEnabled = () => Boolean(runtimeConfig().googleClientId);
export const appleEnabled = () => Boolean(runtimeConfig().appleClientId);

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the sign-in script'));
    document.head.appendChild(script);
  });
}

interface GoogleId {
  initialize(config: Record<string, unknown>): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void;
}
interface AppleAuth {
  init(config: Record<string, unknown>): void;
  signIn(): Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string } } }>;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
    AppleID?: { auth: AppleAuth };
  }
}

/** Draws Google's own button into `element`; `onToken` gets the ID token when someone chooses an account. */
export async function renderGoogleButton(element: HTMLElement, onToken: (idToken: string) => void): Promise<void> {
  await loadScript('https://accounts.google.com/gsi/client');
  const id = window.google?.accounts.id;
  if (!id) throw new Error('Google sign-in is not available');
  id.initialize({
    client_id: runtimeConfig().googleClientId,
    callback: (response: { credential?: string }) => response.credential && onToken(response.credential),
    ux_mode: 'popup',
    auto_select: false,
    cancel_on_tap_outside: true,
  });
  id.renderButton(element, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    logo_alignment: 'left',
    width: Math.min(element.clientWidth || 320, 400),
  });
}

/** Apple's popup. It sends the person's name only the first time ever, so it is returned for the API to keep. */
export async function signInWithApple(): Promise<{ idToken: string; name?: string }> {
  await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js');
  const auth = window.AppleID?.auth;
  if (!auth) throw new Error('Apple sign-in is not available');
  auth.init({ clientId: runtimeConfig().appleClientId, scope: 'name email', redirectURI: APPLE_REDIRECT_URI, usePopup: true });
  const result = await auth.signIn();
  const name = [result.user?.name?.firstName, result.user?.name?.lastName].filter(Boolean).join(' ');
  return { idToken: result.authorization.id_token, name: name || undefined };
}
