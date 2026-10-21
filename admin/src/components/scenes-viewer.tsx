// One chapter's scene prompts, laid out like the book reading page: the chapter's title and summary first, then the
// look of the film and who is in it, then each scene as a card with its verses, the prompt for the video generator, the
// narrator's Hindi and the spoken lines. Every part can be copied, and the whole chapter can be copied or downloaded
// exactly as it is stored in S3.

import { useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, Clapperboard, Copy, Download, FileJson, Loader2, Mic, Music2, RefreshCw, Users, Volume2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api';
import { fetchStoredFile, useSceneFile, type Scene, type SceneFile } from '@/lib/scenes';
import { cn, formatDate } from '@/lib/utils';
import { formatCount } from './translation-bits';

/** Copies text; the browser may refuse (no permission, an insecure page), so the answer says whether it worked. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand('copy');
    area.remove();
    return done;
  }
}

function saveAs(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** A button that copies `text` (or whatever `get` returns) and says so for a moment. */
export function CopyButton({ text, label = 'Copy', size = 'sm', variant = 'outline', className }: { text: string; label?: string; size?: 'sm' | 'default'; variant?: 'outline' | 'ghost' | 'default'; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={async () => {
        setState((await copyText(text)) ? 'copied' : 'failed');
        setTimeout(() => setState('idle'), 1800);
      }}
    >
      {state === 'copied' ? <Check className="text-success" /> : <Copy />}
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : label}
    </Button>
  );
}

function Tag({ icon: Icon, label, children }: { icon: typeof Camera; label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <span className="inline-flex items-start gap-1.5 rounded-md bg-muted px-2 py-1 text-xs" title={label}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={label} />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

function SceneCard({ scene, file }: { scene: Scene; file: SceneFile }) {
  return (
    <Card id={`scene-${scene.number}`} className="scroll-mt-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{scene.number}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" lang="hi">
            {scene.title || `Scene ${scene.number}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {file.meta.chapterRef} · verse{scene.verseRefs.length > 1 ? 's' : ''} {scene.verseRefs.join(', ')} · {scene.durationSec}s
          </p>
        </div>
        <CopyButton text={scene.promptText} label="Copy scene prompt" />
      </div>
      <CardContent className="space-y-4 p-4">
        {scene.setting && <p className="text-xs uppercase tracking-wide text-muted-foreground">{scene.setting}</p>}

        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Clapperboard className="h-3.5 w-3.5" /> Visual prompt
          </p>
          <p className="text-[15px] leading-7">{scene.visualPrompt}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag icon={Camera} label="Camera">
              {scene.camera}
            </Tag>
            <Tag icon={Volume2} label="Mood">
              {scene.mood}
            </Tag>
            <Tag icon={Music2} label="Sound">
              {scene.sound}
            </Tag>
          </div>
        </div>

        {scene.narration && (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Mic className="h-3.5 w-3.5" /> Narrator
            </p>
            <p lang="hi" className="border-l-4 border-primary/40 pl-3 text-lg font-medium leading-9">
              {scene.narration}
            </p>
          </div>
        )}

        {scene.dialogues.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Dialogue
            </p>
            {scene.dialogues.map((d, i) => (
              <div key={i} className="grid grid-cols-[7rem_1fr] items-baseline gap-3">
                <span className="truncate text-right text-sm font-semibold text-primary">{d.speaker}</span>
                <p lang="hi" className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-base leading-8">
                  {d.line}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ScenesViewer({ chapter, label, onOpen, onWriteAgain, neighbours }: { chapter: number; label: string; onOpen: (chapter: number) => void; onWriteAgain?: (chapter: number) => void; neighbours: { previous: number | null; next: number | null } }) {
  const query = useSceneFile(chapter);
  const file = query.data;
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const notWritten = query.error instanceof ApiRequestError && query.error.status === 404;

  const download = async () => {
    setSaving(true);
    setProblem(null);
    try {
      saveAs(file?.meta.file ?? 'scenes.json', await fetchStoredFile(chapter), 'application/json');
    } catch (err) {
      setProblem(err instanceof ApiRequestError ? err.message : 'The file could not be downloaded.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => onOpen(0)}>
          <ArrowLeft /> All chapters
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!neighbours.previous} onClick={() => neighbours.previous && onOpen(neighbours.previous)}>
            <ArrowLeft /> Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!neighbours.next} onClick={() => neighbours.next && onOpen(neighbours.next)}>
            Next <ArrowRight />
          </Button>
        </div>
      </div>

      {query.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {notWritten && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Clapperboard className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Chapter {label} has no scene prompts yet</p>
            <p className="max-w-md text-sm text-muted-foreground">Start a run for it and the storyboard appears here as soon as the model has written it.</p>
            {onWriteAgain && (
              <Button onClick={() => onWriteAgain(chapter)}>
                <Clapperboard /> Write chapter {label}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {query.isError && !notWritten && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-destructive">{query.error instanceof ApiRequestError ? query.error.message : 'The scene file could not be loaded.'}</p>
            <Button size="sm" variant="outline" onClick={() => query.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {file && (
        <>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-primary/10 via-transparent to-transparent p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {file.meta.bookTitle} · {file.meta.chapterRef}
              </p>
              <h3 lang="hi" className="mt-1 text-2xl font-semibold leading-snug">
                {file.chapterTitle || file.meta.chapterName}
              </h3>
              {file.meta.chapterName && file.chapterTitle && <p className="text-sm text-muted-foreground">{file.meta.chapterName}</p>}
              {file.summary && (
                <p lang="hi" className="mt-3 max-w-3xl text-base leading-8 text-foreground/90">
                  {file.summary}
                </p>
              )}
            </div>
            <CardContent className="space-y-4 border-t p-4">
              <div className="flex flex-wrap gap-2">
                <CopyButton text={file.promptText} label="Copy all prompts" size="default" variant="default" />
                <Button variant="outline" onClick={download} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Download />} Download {file.meta.file}
                </Button>
                <CopyButton text={JSON.stringify({ ...file, promptText: undefined, scenes: file.scenes.map(({ promptText: _p, ...scene }) => scene) }, null, 2)} label="Copy JSON" size="default" />
                {onWriteAgain && (
                  <Button variant="ghost" onClick={() => onWriteAgain(chapter)} title="Writes this chapter again; the file now in storage is kept as a backup">
                    <RefreshCw /> Write again
                  </Button>
                )}
              </div>
              {problem && (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {problem}
                </p>
              )}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                {[
                  ['Scenes', file.meta.sceneCount],
                  ['Film length', `${Math.floor(file.meta.totalSeconds / 60)}m ${String(file.meta.totalSeconds % 60).padStart(2, '0')}s`],
                  ['Verses', file.meta.verseCount],
                  ['Tokens', `${formatCount(file.meta.usage.inputTokens)} in · ${formatCount(file.meta.usage.outputTokens)} out`],
                  ['Written by', `${file.meta.provider} ${file.meta.model}`],
                  ['Written', formatDate(file.meta.generatedAt)],
                  ['Source', 'Hindi verse meanings'],
                  ['Prompt version', file.meta.promptVersion],
                ].map(([term, value]) => (
                  <div key={term} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{term}</dt>
                    <dd className="truncate text-sm font-medium" title={String(value)}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {file.meta.missingHindi.length > 0 && (
                <p role="status" className="flex gap-2 rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {file.meta.missingHindi.length} verse{file.meta.missingHindi.length > 1 ? 's' : ''} had no Hindi meaning when this was written and are not in the storyboard ({file.meta.missingHindi.slice(0, 6).join(', ')}
                  {file.meta.missingHindi.length > 6 ? '…' : ''}). Write it again after translating them.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Look of the film</p>
                <p className="text-[15px] leading-7">{file.style || '—'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Characters
                </p>
                {file.characters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None named.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {file.characters.map((c) => (
                      <li key={c.name} className="text-sm leading-6">
                        <span className="font-semibold">{c.name}</span> <span className="text-muted-foreground">— {c.look}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <nav aria-label="Scenes" className="flex flex-wrap gap-1.5">
            {file.scenes.map((scene) => (
              <a key={scene.number} href={`#scene-${scene.number}`} className={cn('grid h-8 min-w-8 place-items-center rounded-md border px-2 text-xs font-medium hover:bg-accent')} title={scene.title}>
                {scene.number}
              </a>
            ))}
            <Badge variant="outline" className="ml-1 gap-1">
              <FileJson className="h-3 w-3" /> {file.meta.file}
            </Badge>
          </nav>

          <div className="space-y-4">
            {file.scenes.map((scene) => (
              <SceneCard key={scene.number} scene={scene} file={file} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
