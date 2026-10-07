// Uploads a file for a reel and hands back the object key to save on the row.
//
// Two steps, as backend/controllers/admin/upload.js describes: ask the API for a
// key and a URL, then PUT the file to that URL. XMLHttpRequest rather than fetch
// because fetch cannot report upload progress, and a 40 MB video with no
// progress bar looks like a hung page.

import { api, loadTokens } from './api';

export type UploadKind = 'reelVideo' | 'reelImage' | 'reelAudio' | 'reelThumbnail' | 'mantraMalaAudio';

type Presigned = { key: string; uploadUrl: string; contentType: string; viaApi?: boolean };

// The types backend/services/s3.js accepts. Checked here first so a wrong file
// fails before it is read off the disk, with a message that says what to do.
export const ACCEPT: Record<UploadKind, string[]> = {
  reelVideo: ['video/mp4', 'video/quicktime'],
  reelImage: ['image/jpeg', 'image/png', 'image/webp'],
  reelThumbnail: ['image/jpeg', 'image/png', 'image/webp'],
  reelAudio: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav'],
  mantraMalaAudio: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav'],
};

const FRIENDLY: Record<UploadKind, string> = {
  reelVideo: 'an MP4 or MOV video',
  reelImage: 'a JPEG, PNG or WebP image',
  reelThumbnail: 'a JPEG, PNG or WebP image',
  reelAudio: 'an MP3, M4A, AAC or WAV file',
  mantraMalaAudio: 'an MP3, M4A, AAC or WAV file',
};

// Browsers report some audio files under names the API does not list (`audio/x-m4a`,
// `audio/x-wav`), and leave the type empty for others. Fall back to the extension.
const BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
};

const ALIASES: Record<string, string> = {
  'audio/x-m4a': 'audio/mp4',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/mp3': 'audio/mpeg',
  'audio/x-aac': 'audio/aac',
};

export function contentTypeOf(file: File): string {
  const reported = ALIASES[file.type] ?? file.type;
  if (reported) return reported;
  return BY_EXTENSION[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? '';
}

export class UploadError extends Error {}

export async function uploadFile(kind: UploadKind, file: File, onProgress?: (fraction: number) => void): Promise<string> {
  const contentType = contentTypeOf(file);
  if (!ACCEPT[kind].includes(contentType)) {
    throw new UploadError(`"${file.name}" is not ${FRIENDLY[kind]}.`);
  }

  const { data } = await api.post<Presigned>('/api/admin/uploads', { kind, contentType });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', data.uploadUrl);
    xhr.setRequestHeader('Content-Type', data.contentType);

    // Only the API's own stand-in endpoint wants the bearer token. A real S3
    // presigned URL is already signed, and sending it an Authorization header
    // makes S3 reject the request.
    if (data.viaApi) {
      const tokens = loadTokens();
      if (tokens) xhr.setRequestHeader('Authorization', `Bearer ${tokens.accessToken}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new UploadError(`The upload was refused (${xhr.status}). Try again.`));
    xhr.onerror = () =>
      reject(new UploadError('The upload failed — check your connection, and that the storage bucket allows this site.'));
    xhr.onabort = () => reject(new UploadError('The upload was cancelled.'));

    xhr.send(file);
  });

  // The key is only worth saving if the object really arrived.
  await api.post('/api/admin/uploads/verify', { key: data.key });
  return data.key;
}

// ── Reading a file before it is uploaded ───────────────────────────────────

export type MediaInfo = { durationMs: number | null; width: number | null; height: number | null };

/** Duration and pixel size of a local file, read from the browser's own decoder. */
export function probeMedia(file: File, kind: 'video' | 'audio' | 'image'): Promise<MediaInfo> {
  const url = URL.createObjectURL(file);
  const done = (info: MediaInfo) => {
    URL.revokeObjectURL(url);
    return info;
  };
  const none: MediaInfo = { durationMs: null, width: null, height: null };

  if (kind === 'image') {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(done({ durationMs: null, width: image.naturalWidth, height: image.naturalHeight }));
      image.onerror = () => resolve(done(none));
      image.src = url;
    });
  }

  return new Promise((resolve) => {
    const element = document.createElement(kind);
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      const duration = Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : null;
      const size = element instanceof HTMLVideoElement ? { width: element.videoWidth, height: element.videoHeight } : { width: null, height: null };
      resolve(done({ durationMs: duration, ...size }));
    };
    element.onerror = () => resolve(done(none));
    element.src = url;
  });
}
