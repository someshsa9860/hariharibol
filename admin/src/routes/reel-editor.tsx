import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, EyeOff, Loader2, Redo2, Save, Send, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReelStage } from '@/components/reel-stage';
import { ReelLayers } from '@/components/reel-layers';
import { ReelTextInspector } from '@/components/reel-text-inspector';
import { ReelMediaPanel } from '@/components/reel-media-panel';
import { ReelDetailsPanel, type Creator } from '@/components/reel-details-panel';
import { VersePicker, type VerseInsert } from '@/components/verse-picker';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/use-resource';
import {
  MAX_OVERLAYS,
  MEDIA_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
  bodyFromDoc,
  docFromReel,
  duplicateOverlay,
  emptyDoc,
  newOverlay,
  useReelHistory,
  type MediaType,
  type Overlay,
  type ReelDetail,
  type ReelDoc,
  type ReelStatus,
} from '@/lib/reel-doc';

type Tab = 'text' | 'media' | 'details';
type Problem = { message: string; details: string[] };

const MEDIA_TYPES = Object.keys(MEDIA_LABEL) as MediaType[];
const snapshot = (doc: ReelDoc) => JSON.stringify(bodyFromDoc(doc));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

  return <Editor key={id ?? 'new'} reel={id ? reel.data! : null} creators={creators.data} mediaType={mediaType} />;
}

function Editor({ reel, creators, mediaType }: { reel: ReelDetail | null; creators: Creator[]; mediaType: MediaType }) {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [initial] = useState(() =>
    reel ? docFromReel(reel) : emptyDoc(mediaType, (creators.find((c) => c.isOfficial) ?? creators[0])?.id ?? '')
  );
  const { doc, set, replace, undo, redo, canUndo, canRedo, beginGesture, endGesture } = useReelHistory(initial);

  const [saved, setSaved] = useState(() => snapshot(initial));
  const [status, setStatus] = useState<ReelStatus>(reel?.status ?? 'DRAFT');
  const [busy, setBusy] = useState<'save' | 'publish' | 'delete' | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(reel ? 'text' : 'media');
  const [slide, setSlide] = useState(0);
  const [showGuides, setShowGuides] = useState(false);
  const [snap, setSnap] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const reelId = reel?.id ?? null;
  const canWrite = hasPermission('reel.write');
  const canPublish = hasPermission('reel.publish');
  const canDelete = hasPermission('reel.delete');

  const dirty = useMemo(() => snapshot(doc) !== saved, [doc, saved]);
  const selected = doc.overlays.find((overlay) => overlay.id === selectedId) ?? null;
  const live = status === 'PUBLISHED';

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

  // ── text boxes ───────────────────────────────────────────────────────────

  const patchOverlay = (id: string, patch: Partial<Overlay>, key?: string) =>
    set((d) => ({ ...d, overlays: d.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)) }), key);

  function focusText() {
    setTab('text');
    // The Text tab may have just mounted; wait for its textarea.
    setTimeout(() => {
      textRef.current?.focus();
      textRef.current?.select();
    }, 50);
  }

  function addOverlay(partial: Partial<Overlay> = {}) {
    if (doc.overlays.length >= MAX_OVERLAYS) return null;
    const overlay = newOverlay(doc.overlays, partial);
    set((d) => ({ ...d, overlays: [...d.overlays, overlay] }));
    setSelectedId(overlay.id);
    return overlay;
  }

  function addText() {
    if (addOverlay()) focusText();
  }

  function removeOverlay(id: string) {
    set((d) => ({ ...d, overlays: d.overlays.filter((o) => o.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function copyOverlay(id: string) {
    const source = doc.overlays.find((o) => o.id === id);
    if (!source || doc.overlays.length >= MAX_OVERLAYS) return;
    const copy = duplicateOverlay(source);
    set((d) => ({ ...d, overlays: [...d.overlays, copy] }));
    setSelectedId(copy.id);
  }

  // Later in the list is drawn on top, so "forward" is +1.
  function moveOverlay(id: string, direction: 1 | -1) {
    set((d) => {
      const from = d.overlays.findIndex((o) => o.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= d.overlays.length) return d;
      const overlays = [...d.overlays];
      [overlays[from], overlays[to]] = [overlays[to], overlays[from]];
      return { ...d, overlays };
    });
  }

  // One undo step per click: the text box and the verse link go in together.
  function insertVerse(insert: VerseInsert) {
    const translation = insert.kind === 'translation';
    const overlay = insert.text
      ? newOverlay(doc.overlays, {
          text: insert.text.slice(0, 2000),
          style: translation ? 'body' : 'verse',
          size: translation ? 4 : 4.5,
          x: 8,
          width: 84,
          source: { verseId: insert.verse.verseId, label: insert.verse.label },
        })
      : null;

    if (overlay && doc.overlays.length >= MAX_OVERLAYS) {
      setProblem({ message: `A reel holds at most ${MAX_OVERLAYS} text boxes.`, details: [] });
      return;
    }

    set((d) => ({
      ...d,
      verse: insert.link ? insert.verse : d.verse,
      overlays: overlay ? [...d.overlays, overlay] : d.overlays,
    }));
    if (overlay) setSelectedId(overlay.id);
  }

  function changeMediaType(next: MediaType) {
    if (next === doc.mediaType) return;
    const hasMedia = doc.videoPath || doc.images.length || doc.audioPath || doc.thumbnailPath;
    if (hasMedia && !confirm('Switching type drops the media you have uploaded. Continue?')) return;
    setSlide(0);
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

  function accept(fresh: ReelDetail) {
    const next = docFromReel(fresh);
    replace(next);
    setSaved(snapshot(next));
    setStatus(fresh.status);
    queryClient.setQueryData(['reel', fresh.id], fresh);
    queryClient.invalidateQueries({ queryKey: ['reels'] });
  }

  async function save(): Promise<string | null> {
    setProblem(null);
    setBusy('save');
    try {
      const body = bodyFromDoc(doc);
      const { data } = reelId
        ? await api.patch<ReelDetail>(`/api/admin/reels/${reelId}`, body)
        : await api.post<ReelDetail>('/api/admin/reels', body);
      accept(data);
      // A new reel now has an id; move to its own address so a refresh keeps it.
      if (!reelId) navigate(`/reels/${data.id}`, { replace: true });
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

  // ── keyboard ─────────────────────────────────────────────────────────────
  // Registered on every render so the handler always sees the current document.

  useEffect(() => {
    if (!canWrite) return;

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (pickerOpen || target?.closest('input, textarea, select, [contenteditable], [role="dialog"], [role="menu"]')) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === 's') {
        event.preventDefault();
        if (dirty || !reelId) void save();
      } else if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && key === 'y') {
        event.preventDefault();
        redo();
      } else if (mod && key === 'd' && selected) {
        event.preventDefault();
        copyOverlay(selected.id);
      } else if (!mod && selected) {
        const step = event.shiftKey ? 5 : 1;
        const nudge = (dx: number, dy: number) => {
          event.preventDefault();
          patchOverlay(
            selected.id,
            { x: clamp(selected.x + dx, 0, Math.max(0, 100 - selected.width)), y: clamp(selected.y + dy, 0, 95) },
            `${selected.id}:nudge`
          );
        };
        if (event.key === 'ArrowLeft') nudge(-step, 0);
        else if (event.key === 'ArrowRight') nudge(step, 0);
        else if (event.key === 'ArrowUp') nudge(0, -step);
        else if (event.key === 'ArrowDown') nudge(0, step);
        else if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          removeOverlay(selected.id);
        } else if (event.key === 'Escape') setSelectedId(null);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)_24rem]">
        <aside>
          <fieldset disabled={!canWrite} className="min-w-0">
            <h3 className="mb-3 text-sm font-semibold">Text on the frame</h3>
            <ReelLayers
              overlays={doc.overlays}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setTab('text');
              }}
              onAdd={addText}
              onAddVerse={() => setPickerOpen(true)}
              onDuplicate={copyOverlay}
              onDelete={removeOverlay}
              onMove={moveOverlay}
            />
          </fieldset>
        </aside>

        <section className="flex min-w-0 flex-col items-center gap-3 lg:sticky lg:top-0 lg:self-start">
          <ReelStage
            doc={doc}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={canWrite ? (id, patch) => patchOverlay(id, patch) : () => undefined}
            onGestureStart={canWrite ? beginGesture : () => undefined}
            onGestureEnd={canWrite ? endGesture : () => undefined}
            onEditText={(id) => {
              setSelectedId(id);
              focusText();
            }}
            slide={slide}
            onSlide={setSlide}
            showGuides={showGuides}
            snap={snap}
            videoRef={videoRef}
          />
          <div className="flex gap-5 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />
              Show app overlays
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={snap} onChange={(e) => setSnap(e.target.checked)} />
              Snap to centre
            </label>
          </div>
        </section>

        <aside className="min-w-0">
          <fieldset disabled={!canWrite} className="min-w-0">
            <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
              <TabsList className="w-full">
                <TabsTrigger value="text" className="flex-1 justify-center">
                  Text
                </TabsTrigger>
                <TabsTrigger value="media" className="flex-1 justify-center">
                  Media
                </TabsTrigger>
                <TabsTrigger value="details" className="flex-1 justify-center">
                  Details
                </TabsTrigger>
              </TabsList>
              <TabsContent value="text">
                <ReelTextInspector overlay={selected} onChange={patchOverlay} onDuplicate={copyOverlay} onDelete={removeOverlay} textRef={textRef} />
              </TabsContent>
              <TabsContent value="media">
                <ReelMediaPanel doc={doc} set={set} videoRef={videoRef} />
              </TabsContent>
              <TabsContent value="details">
                <ReelDetailsPanel doc={doc} creators={creators} set={set} onPickVerse={() => setPickerOpen(true)} />
              </TabsContent>
            </Tabs>
          </fieldset>
        </aside>
      </div>

      <VersePicker open={pickerOpen} onOpenChange={setPickerOpen} onInsert={insertVerse} />
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
