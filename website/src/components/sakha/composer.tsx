'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { describeError, rawRequest } from '@/lib/api/client';
import { readEnvelope } from '@/lib/api/core';

interface Props {
  disabled?: boolean;
  sending: boolean;
  maxChars: number;
  allowImage: boolean;
  onSend: (text: string, imageKey?: string, imageUrl?: string) => void;
  onStop: () => void;
}

type Recognition = { start(): void; stop(): void; lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type RecognitionCtor = new () => Recognition;

/** Draws the picture smaller and as a JPEG before it is sent — a phone photo can be many megabytes. */
async function shrink(file: File, maxEdge = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', 0.86));
}

export function Composer({ disabled, sending, maxChars, allowImage, onSend, onStop }: Props) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [picture, setPicture] = useState<{ key: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [listening, setListening] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const recognition = useRef<Recognition | null>(null);
  const [canSpeak, setCanSpeak] = useState(false);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    setCanSpeak(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => recognition.current?.stop();
  }, []);

  // The box grows with what is typed, up to a few lines.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  const submit = () => {
    const value = text.trim();
    if ((!value && !picture) || sending || disabled || uploading) return;
    if (value.length > maxChars) { toast(`Please keep it under ${maxChars.toLocaleString('en-IN')} characters.`); return; }
    onSend(value, picture?.key, picture?.url);
    setText('');
    setPicture(null);
    recognition.current?.stop();
  };

  const choose = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    setUploading(true);
    try {
      const blob = await shrink(chosen);
      const response = await rawRequest('/chat/images', { method: 'POST', body: blob, auth: 'required', headers: { 'Content-Type': 'image/jpeg' } });
      const { data } = await readEnvelope<{ key: string; url: string }>(response);
      setPicture({ key: data.key, url: data.url });
    } catch (failure) {
      toast(describeError(failure, 'That picture could not be used.'));
    }
    setUploading(false);
  };

  // The recogniser writes into the box and never sends by itself.
  const speak = () => {
    if (listening) { recognition.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const heard = new Ctor();
    heard.lang = document.documentElement.lang || 'en-IN';
    heard.interimResults = true;
    heard.continuous = false;
    const base = text ? `${text.trim()} ` : '';
    heard.onresult = (event) => setText(base + Array.from(event.results).map((r) => r[0].transcript).join(''));
    heard.onend = () => setListening(false);
    heard.onerror = () => { setListening(false); toast('The microphone could not be used.'); };
    recognition.current = heard;
    setListening(true);
    heard.start();
  };

  return (
    <div className="composer">
      {picture && (
        <div className="attach-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picture.url} alt="Picture to send" />
          <button className="icon-btn" aria-label="Remove picture" onClick={() => setPicture(null)}><Icon name="x" size={16} /></button>
        </div>
      )}
      <div className="composer-row">
        {allowImage && (
          <>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choose} />
            <button className="icon-btn" aria-label="Attach a picture" disabled={disabled || sending || uploading || Boolean(picture)} onClick={() => file.current?.click()}>
              {uploading ? <span className="spinner" /> : <Icon name="image" />}
            </button>
          </>
        )}
        <textarea
          ref={field} rows={1} className="composer-input" value={text} disabled={disabled}
          placeholder="Write to Sakha…" aria-label="Message to Sakha"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }}
        />
        {canSpeak && <button className={listening ? 'icon-btn is-listening' : 'icon-btn'} aria-label={listening ? 'Stop listening' : 'Speak your message'} aria-pressed={listening} disabled={disabled || sending} onClick={speak}><Icon name="mic" /></button>}
        {sending ? (
          <button className="send-btn stop" onClick={onStop} aria-label="Stop"><Icon name="stop" size={18} /></button>
        ) : (
          <button className="send-btn" onClick={submit} disabled={disabled || uploading || (!text.trim() && !picture)} aria-label="Send"><Icon name="send" size={18} /></button>
        )}
      </div>
      <p className="composer-note">A picture you attach is sent to Sakha’s language model. Sakha can make mistakes — check what matters.</p>
    </div>
  );
}
