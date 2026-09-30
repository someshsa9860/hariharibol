import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource, useResourceMutation } from '@/lib/use-resource';
import { ApiRequestError } from '@/lib/api';

type Setting = { key: string; label: string; help: string; options?: string[]; value: string | null; isSecret: boolean; isSet: boolean };
type SettingsData = { settings: Setting[]; unknown: { key: string }[] };

export function SettingsPage() {
  const data = useResource<SettingsData>(['settings'], '/api/admin/settings');
  const mutate = useResourceMutation('settings');
  const [q, setQ] = useState('');
  // Only what has been touched. A field shows its edit if it has one and the
  // server's value otherwise — so saving one setting can't wipe another's
  // half-typed change the way resetting every field from the refetch would.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const settings = data.data?.settings ?? [];
  const serverValue = (s: Setting) => s.value ?? '';
  const valueOf = (s: Setting) => edits[s.key] ?? serverValue(s);
  // A secret's stored value is never sent back, so any non-empty entry is a change.
  const isDirty = (s: Setting) => s.key in edits && edits[s.key] !== serverValue(s);
  const canSave = (s: Setting) => isDirty(s) && edits[s.key] !== '';

  const dirty = settings.filter(isDirty);
  const needle = q.trim().toLowerCase();
  const visible = settings.filter(
    (s) => !needle || s.label.toLowerCase().includes(needle) || s.key.toLowerCase().includes(needle) || s.help.toLowerCase().includes(needle)
  );

  const revert = (key: string) =>
    setEdits((prev) => {
      const { [key]: _drop, ...rest } = prev;
      return rest;
    });

  async function save(targets: Setting[]) {
    setSaving(true);
    setNotice(null);
    const results = await Promise.allSettled(
      targets.map((s) =>
        mutate.mutateAsync({ path: `/api/admin/settings/${s.key}`, method: 'put', body: { value: edits[s.key], isSecret: s.isSecret } })
      )
    );
    // A saved setting stops being an edit; a failed one stays, so nothing typed is lost.
    setEdits((prev) => {
      const next = { ...prev };
      results.forEach((r, i) => r.status === 'fulfilled' && delete next[targets[i].key]);
      return next;
    });
    setSaving(false);

    const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [{ key: targets[i].key, reason: r.reason }] : []));
    if (failed.length === 0) {
      setNotice({ tone: 'success', text: targets.length === 1 ? `Saved ${targets[0].label}.` : `Saved ${targets.length} settings.` });
    } else {
      const why = failed[0].reason instanceof ApiRequestError ? failed[0].reason.message : 'request failed';
      setNotice({ tone: 'error', text: `Could not save ${failed.map((f) => f.key).join(', ')} — ${why}` });
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Runtime configuration — takes effect without a deploy."
        actions={
          dirty.length > 0 ? (
            <>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => setEdits({})}>
                Discard {dirty.length}
              </Button>
              <Button size="sm" disabled={saving || !dirty.every(canSave)} onClick={() => save(dirty)}>
                Save {dirty.length} {dirty.length === 1 ? 'change' : 'changes'}
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search settings…" />
        {data.data && (
          <span className="text-sm text-muted-foreground">
            {visible.length} of {settings.length}
          </span>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            notice.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          {notice.text}
        </p>
      )}

      {data.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.length === 0 && <p className="text-sm text-muted-foreground">No settings match.</p>}
          {visible.map((s) => (
            <Card key={s.key} className={isDirty(s) ? 'border-primary/50' : undefined}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{s.label}</p>
                    {s.isSecret && <Badge variant="secondary">Secret</Badge>}
                    {!s.isSet && <Badge variant="warning">Unset</Badge>}
                    {isDirty(s) && <Badge variant="outline">Unsaved</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.help}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{s.key}</p>
                </div>

                <div className="flex items-center gap-2">
                  {s.options ? (
                    <Select
                      className="w-44"
                      value={valueOf(s)}
                      onChange={(e) => setEdits({ ...edits, [s.key]: e.target.value })}
                    >
                      <option value="" disabled>
                        Choose…
                      </option>
                      {s.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type={s.isSecret ? 'password' : 'text'}
                      className="w-52"
                      placeholder={s.isSecret && s.isSet ? '••••••••' : ''}
                      value={valueOf(s)}
                      onChange={(e) => setEdits({ ...edits, [s.key]: e.target.value })}
                    />
                  )}
                  {isDirty(s) && (
                    <Button size="sm" variant="ghost" disabled={saving} onClick={() => revert(s.key)}>
                      Revert
                    </Button>
                  )}
                  <Button size="sm" disabled={!canSave(s) || saving} onClick={() => save([s])}>
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
