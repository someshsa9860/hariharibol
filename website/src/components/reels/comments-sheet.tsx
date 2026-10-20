'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-provider';
import { api, apiEnvelope, describeError } from '@/lib/api/client';
import type { ReelComment } from '@/lib/types';

function ago(iso: string): string {
  const seconds = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  const units: [number, string][] = [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  for (const [size, label] of units) if (seconds >= size) return `${Math.floor(seconds / size)}${label}`;
  return 'now';
}

function CommentRow({ comment, onReply, onChange, onRemove, level }: { comment: ReelComment; onReply: (c: ReelComment) => void; onChange: (c: ReelComment) => void; onRemove: (id: string) => void; level: 0 | 1 }) {
  const { requireSignIn } = useAuth();
  const [replies, setReplies] = useState<ReelComment[] | null>(null);
  const [open, setOpen] = useState(false);

  const like = async () => {
    if (!requireSignIn('Sign in to like comments.')) return;
    const next = { ...comment, isLiked: !comment.isLiked, likeCount: comment.likeCount + (comment.isLiked ? -1 : 1) };
    onChange(next);
    try {
      await api(`/reel-comments/${comment.id}/like`, { method: comment.isLiked ? 'DELETE' : 'POST', auth: 'required' });
    } catch { onChange(comment); }
  };

  const toggleReplies = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    if (replies === null) {
      const { data } = await apiEnvelope<ReelComment[]>('/reel-comments', { query: { reelId: comment.reelId, parentId: comment.id, pageSize: 50 } }).catch(() => ({ data: [] as ReelComment[] }));
      setReplies(data);
    }
  };

  const remove = async () => {
    try { await api(`/reel-comments/${comment.id}`, { method: 'DELETE', auth: 'required' }); onRemove(comment.id); } catch { /* stays */ }
  };

  return (
    <li className="comment">
      <Avatar name={comment.author?.name} url={comment.author?.avatarUrl} size={34} />
      <div className="comment-body">
        <div className="comment-meta"><strong>{comment.author?.name ?? 'Devotee'}</strong><span>{ago(comment.createdAt)}</span></div>
        <p className={comment.text ? '' : 'muted'}>{comment.text ?? 'This comment was removed.'}</p>
        <div className="comment-actions">
          <button onClick={like} aria-pressed={comment.isLiked}><Icon name="heart" size={15} solid={comment.isLiked} /> {comment.likeCount > 0 && comment.likeCount}</button>
          {level === 0 && <button onClick={() => onReply(comment)}>Reply</button>}
          {comment.isMine && <button onClick={remove}>Delete</button>}
          {level === 0 && comment.replyCount > 0 && <button onClick={toggleReplies}>{open ? 'Hide' : 'View'} {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}</button>}
        </div>
        {open && replies && (
          <ul className="comment-replies">
            {replies.map((r) => <CommentRow key={r.id} comment={r} level={1} onReply={onReply} onChange={(n) => setReplies((l) => l!.map((x) => (x.id === n.id ? n : x)))} onRemove={(id) => setReplies((l) => l!.filter((x) => x.id !== id))} />)}
          </ul>
        )}
      </div>
    </li>
  );
}

export function CommentsSheet({ reelId, onClose, onCount }: { reelId: string; onClose: () => void; onCount: (delta: number) => void }) {
  const { requireSignIn } = useAuth();
  const [comments, setComments] = useState<ReelComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ReelComment | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiEnvelope<ReelComment[]>('/reel-comments', { query: { reelId, pageSize: 50 } }).then(({ data }) => setComments(data)).catch((e) => setError(describeError(e)));
  }, [reelId]);
  useEffect(load, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || !requireSignIn('Sign in to join the conversation.')) return;
    setBusy(true);
    try {
      await api('/reel-comments', { method: 'POST', auth: 'required', body: { reelId, text: text.trim(), parentId: replyTo?.id } });
      setText('');
      setReplyTo(null);
      onCount(1);
      load();
    } catch (failure) { setError(describeError(failure)); }
    setBusy(false);
  };

  return (
    <Sheet title="Comments" onClose={onClose}>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {!comments && !error && <div className="center-state"><Spinner /></div>}
      {comments && comments.length === 0 && <p className="muted center-text">No comments yet. Be the first to share a thought.</p>}
      {comments && (
        <ul className="comment-list">
          {comments.map((c) => <CommentRow key={c.id} comment={c} level={0} onReply={setReplyTo} onChange={(n) => setComments((l) => l!.map((x) => (x.id === n.id ? n : x)))} onRemove={(id) => { setComments((l) => l!.filter((x) => x.id !== id)); onCount(-1); }} />)}
        </ul>
      )}
      <form className="comment-form" onSubmit={submit}>
        {replyTo && <div className="replying">Replying to {replyTo.author?.name ?? 'a devotee'} <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><Icon name="x" size={14} /></button></div>}
        <div className="comment-input">
          <input className="input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" aria-label="Add a comment" />
          <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label="Post comment"><Icon name="send" size={18} /></button>
        </div>
      </form>
    </Sheet>
  );
}
