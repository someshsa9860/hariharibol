// One picture from OpenAI's image API, as bytes. Share Studio backgrounds are the only caller; they go through
// services/share-background.js, which does the credit accounting. Not part of the text `complete()` chain: an
// image has no fail-over model and no streaming, and its cost is a flat price in wallet tokens, not usage.

import env from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

const SIZE = '1024x1536'; // portrait: the Studio crops it to square, story or landscape

export const isConfigured = () => Boolean(env.OPENAI_API_KEY);

/** Returns `{ buffer, contentType }`; throws an AppError whose `retryable` says whether trying again can help. */
export async function generate(prompt, { signal } = {}) {
  if (!isConfigured()) throw Object.assign(new AppError(503, 'IMAGE_NOT_AVAILABLE', 'Backgrounds are not available right now'), { retryable: false });

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: env.OPENAI_IMAGE_MODEL, prompt, size: SIZE, n: 1 }),
      signal,
    });
  } catch (error) {
    throw Object.assign(new AppError(502, 'IMAGE_FAILED', 'The picture could not be made'), { retryable: true, cause: error });
  }
  if (!response.ok) {
    // The provider's body is logged by the caller via `cause`, never sent on.
    const transient = response.status === 429 || response.status >= 500;
    throw Object.assign(new AppError(502, 'IMAGE_FAILED', 'The picture could not be made'), { retryable: transient, providerStatus: response.status });
  }
  const body = await response.json().catch(() => null);
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw Object.assign(new AppError(502, 'IMAGE_FAILED', 'The picture could not be made'), { retryable: true });
  return { buffer: Buffer.from(b64, 'base64'), contentType: 'image/png' };
}
