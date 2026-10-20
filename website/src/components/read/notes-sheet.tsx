'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/states';
import { api, describeError } from '@/lib/api/client';
import type { Verse } from '@/lib/types';

interface Note { id: string; text: string; createdAt: string }

/** The reader's own notes on a verse. Needs an account; the caller checks that before opening. */
export function NotesSheet({ verse, onClose }: { verse: Verse; onClose: () => void }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Note[]>('/verse-notes', { auth: 'required', query: { verseId: verse.id } }).then(setNotes).catch((e) => setError(describeError(e)));
  }, [verse.id]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    try {
      const note = await api<Note>('/verse-notes', { method: 'POST', auth: 'required', body: { verseId: verse.id, text: text.trim() } });
      setNotes((list) => [note, ...(list ?? [])]);
      setText('');
    } catch (e) { setError(describeError(e)); }
  };
  const remove = async (id: string) => {
    try { await api(`/verse-notes/${id}`, { method: 'DELETE', auth: 'required' }); setNotes((l) => l?.filter((n) => n.id !== id) ?? null); }
    catch (e) { setError(describeError(e)); }
  };

  return (
    <Sheet title="My notes" onClose={onClose}>
      <form className="comment-input" onSubmit={add}>
        <textarea className="textarea" rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="What does this verse say to you?" aria-label="New note" />
        <button className="btn btn-primary" disabled={!text.trim()}>Save</button>
      </form>
      {error && <div className="notice notice-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      {!notes && !error && <div className="center-state"><Spinner /></div>}
      <ul className="comment-list" style={{ marginTop: 16 }}>
        {notes?.map((n) => (
          <li key={n.id} className="card note">
            <p>{n.text}</p>
            <small className="muted">{new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
            <button className="icon-btn" aria-label="Delete note" onClick={() => remove(n.id)}><Icon name="trash" size={16} /></button>
          </li>
        ))}
      </ul>
      {notes?.length === 0 && <p className="muted center-text">No notes yet.</p>}
    </Sheet>
  );
}
