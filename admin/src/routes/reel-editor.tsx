import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, EyeOff, Loader2, Redo2, Save, Send, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { ReelDesigner } from '@/components/reel-designer';
import { ReelDetailsPanel, type Creator } from '@/components/reel-details-panel';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/use-resource';
import {
  MEDIA_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
  bodyFromDoc,
  docFromReel,
  emptyDoc,
  keepLocalUrls,
  useReelHistory,
  withUrlsFrom,
  type MediaType,
  type ReelDetail,
  type ReelDoc,
  type ReelStatus,
} from '@/lib/reel-doc';

type Problem = { message: string; details: string[] };

const MEDIA_TYPES = Object.keys(MEDIA_LABEL) as MediaType[];
const snapshot = (doc: ReelDoc) => JSON.stringify(bodyFromDoc(doc));

function problemFrom(error: unknown, fallback: string): Problem {
  if (!(error instanceof ApiRequestError)) return { message: fallback, details: [] };
  // Validation failures come back as [{field, message}].
  const rows = Array.isArray(error.details) ? (error.details as { field?: string; message?: string }[]) : [];
  return { message: error.message, details: rows.map((row) => (row.field ? `${row.field}: ${row.message}` : String(row.message))) };
}

// /reels/new?type=VIDEO and /reels/:id. The page only loads; the editor below
// is mounted once everything it starts from has arrived, so its history begins
// from the saved reel and never has to be reset.
export function ReelEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  // A new reel's first save moves the page to /reels/:id. That address change
  // must not remount the editor — it would throw away the undo history and any
  // upload still in flight — so the save passes the key it was mounted under.
  const location = useLocation();
  const editorKey = (location.state as { editorKey?: string } | null)?.editorKey ?? id ?? 'new';

  const reel = useResource<ReelDetail>(['reel', id], `/api/admin/reels/${id}`, undefined, { enabled: !!id });
  const creators = useResource<Creator[]>(['reel-creators'], '/api/admin/reels/creators');

  const requested = params.get('type') as MediaType | null;
  const mediaType = requested && MEDIA_TYPES.includes(requested) ? requested : 'VIDEO';

  if (reel.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <AlertTriangle className="h-8 w-8" />
        <p className="text-sm">{reel.error instanceof ApiRequestError ? reel.error.message : 'Could not load this reel.'}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/reels">Back to reels</Link>
        </Button>
      </div>
    );
  }

  if (creators.isLoading || (id && !reel.data) || !creators.data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Editor key={editorKey} reel={id ? reel.data! : null} creators={creators.data} mediaType={mediaType} />;
}

function Editor({ reel, creators, mediaType }: { reel: ReelDetail | null; creators: Creator[]; mediaType: MediaType }) {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [initial] = useState(() =>
    reel ? docFromReel(reel) : emptyDoc(mediaType, (creators.find((c) => c.isOfficial) ?? creators[0])?.id ?? '')
  );
  const history = useReelHistory(initial);
  const { doc, set, replace, undo, redo, canUndo, canRedo } = history;

  const [saved, setSaved] = useState(() => snapshot(initial));
  const [status, setStatus] = useState<ReelStatus>(reel?.status ?? 'DRAFT');
  const [busy, setBusy] = useState<'save' | 'publish' | 'delete' | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  const reelId = reel?.id ?? null;
  const canWrite = hasPermission('reel.write');
  const canPublish = hasPermission('reel.publish');
  const canDelete = hasPermission('reel.delete');

  const dirty = useMemo(() => snapshot(doc) !== saved, [doc, saved]);
  const live = status === 'PUBLISHED';

  // The document as of the last render, for async work that finishes later.
  const docRef = useRef(doc);
  docRef.current = doc;

  // ── leaving with unsaved work ────────────────────────────────────────────

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function back() {
    if (dirty && !confirm('Discard your unsaved changes?')) return;
    navigate('/reels');
  }

  function changeMediaType(next: MediaType) {
    if (next === doc.mediaType) return;
    const hasMedia = doc.videoPath || doc.images.length || doc.audioPath || doc.thumbnailPath;
    if (hasMedia && !confirm('Switching type drops the media you have uploaded. Continue?')) return;
    set((d) => ({
      ...d,
      mediaType: next,
      videoPath: null,
      videoUrl: null,
      images: [],
      audioPath: null,
      audioUrl: null,
      thumbnailPath: null,
      thumbnailUrl: null,
      durationMs: null,
      width: null,
      height: null,
    }));
  }

  // ── saving ───────────────────────────────────────────────────────────────

  // `sent` is the snapshot that went to the API. If the document changed while
  // the request was out — typing, an upload finishing — those edits are kept
  // and stay unsaved; only the links are brought up to date.
  function accept(fresh: ReelDetail, sent?: string) {
    const current = docRef.current;
    const server = keepLocalUrls(docFromReel(fresh), current);
    if (sent === undefined || snapshot(current) === sent) {
      replace(server);
      setSaved(snapshot(server));
    } else {
      replace(withUrlsFrom(current, server));
      setSaved(sent);
    }
    setStatus(fresh.status);
    queryClient.setQueryData(['reel', fresh.id], fresh);
    queryClient.invalidateQueries({ queryKey: ['reels'] });
  }

  async function save(): Promise<string | null> {
    setProblem(null);
    setBusy('save');
    try {
      const body = bodyFromDoc(doc);
      const sent = JSON.stringify(body);
      const { data } = reelId
        ? await api.patch<ReelDetail>(`/api/admin/reels/${reelId}`, body)
        : await api.post<ReelDetail>('/api/admin/reels', body);
      accept(data, sent);
      // A new reel now has an id; move to its own address so a refresh keeps it.
      if (!reelId) navigate(`/reels/${data.id}`, { replace: true, state: { editorKey: 'new' } });
      return data.id;
    } catch (error) {
      setProblem(problemFrom(error, 'Could not save this reel.'));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function setPublished(isPublished: boolean) {
    if (!reelId) return;
    if (dirty && (await save()) === null) return;

    setProblem(null);
    setBusy('publish');
    try {
      const { data } = await api.post<ReelDetail>(`/api/admin/reels/${reelId}/publish`, { isPublished });
      setStatus(data.status);
      queryClient.setQueryData(['reel', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    } catch (error) {
      setProblem(problemFrom(error, isPublished ? 'Could not publish this reel.' : 'Could not unpublish this reel.'));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!reelId || !confirm('Delete this reel? This cannot be undone.')) return;
    setProblem(null);
    setBusy('delete');
    try {
      await api.delete(`/api/admin/reels/${reelId}`);
      queryClient.removeQueries({ queryKey: ['reel', reelId] });
      queryClient.invalidateQueries({ queryKey: ['reels'] });
      navigate('/reels', { replace: true });
    } catch (error) {
      setProblem(problemFrom(error, 'Could not delete this reel.'));
      setBusy(null);
    }
  }

  // Signed links expire. Fetch fresh ones without touching anything else.
  async function reloadMedia() {
    if (!reelId) return;
    try {
      const { data } = await api.get<ReelDetail>(`/api/admin/reels/${reelId}`);
      queryClient.setQueryData(['reel', data.id], data);
      replace(withUrlsFrom(docRef.current, docFromReel(data)));
    } catch (error) {
      setProblem(problemFrom(error, 'Could not reload the media links.'));
    }
  }

  // ── page ─────────────────────────────────────────────────────────────────

  const noCreator = creators.length === 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={back}>
          <ArrowLeft className="h-4 w-4" />
          Reels
        </Button>
        <h2 className="text-lg font-semibold">{reelId ? 'Edit reel' : `New ${MEDIA_LABEL[doc.mediaType].toLowerCase()} reel`}</h2>
        {!reelId && (
          <Select className="w-36" aria-label="Reel type" value={doc.mediaType} onChange={(e) => changeMediaType(e.target.value as MediaType)}>
            {MEDIA_TYPES.map((type) => (
              <option key={type} value={type}>
                {MEDIA_LABEL[type]}
              </option>
            ))}
          </Select>
        )}
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
        {dirty && <span className="text-xs font-medium text-amber-600">Unsaved changes</span>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canWrite && (
            <>
              <Button variant="outline" size="icon" aria-label="Undo" title="Undo (Ctrl/⌘ Z)" disabled={!canUndo} onClick={undo}>
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Redo" title="Redo (Ctrl/⌘ Shift Z)" disabled={!canRedo} onClick={redo}>
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => void save()} disabled={busy !== null || noCreator || (!!reelId && !dirty)}>
                {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {reelId ? 'Save' : 'Save draft'}
              </Button>
            </>
          )}
          {canPublish && reelId && (
            <Button
              variant={live ? 'outline' : 'default'}
              onClick={() => void setPublished(!live)}
              disabled={busy !== null || (dirty && !canWrite)}
            >
              {busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : live ? <EyeOff className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {live ? 'Unpublish' : dirty ? 'Save & publish' : 'Publish'}
            </Button>
          )}
          {canDelete && reelId && !live && (
            <Button variant="outline" size="icon" aria-label="Delete reel" className="text-destructive" onClick={() => void remove()} disabled={busy !== null}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {!canWrite && <Notice tone="info">You can look at this reel but not change it.</Notice>}
      {noCreator && <Notice tone="error">There is no approved creator to publish reels as. Approve a creator profile first.</Notice>}
      {live && canWrite && <Notice tone="info">This reel is live — saving changes updates it for everyone straight away.</Notice>}
      {reel?.templateId && (
        <Notice tone="info">
          Made automatically from a verse. Its verse text boxes are filled from the verse each time the reel is shown, so they follow the reader&apos;s language.
        </Notice>
      )}
      {problem && (
        <Notice tone="error">
          <p>{problem.message}</p>
          {problem.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {problem.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      <ReelDesigner
        history={history}
        canWrite={canWrite}
        initialTab={reel ? 'text' : 'media'}
        onSave={() => {
          if (dirty || !reelId) void save();
        }}
        onReloadMedia={reelId ? reloadMedia : undefined}
        details={({ openVersePicker }) => <ReelDetailsPanel doc={doc} creators={creators} set={set} onPickVerse={openVersePicker} />}
      />
    </div>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'error'; children: React.ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'
          : 'rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground'
      }
    >
      {children}
    </div>
  );
}
