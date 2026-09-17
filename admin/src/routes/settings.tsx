import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource, useResourceMutation } from '@/lib/use-resource';

type Setting = { key: string; label: string; help: string; options?: string[]; value: string | null; isSecret: boolean; isSet: boolean };
type SettingsData = { settings: Setting[]; unknown: { key: string }[] };

export function SettingsPage() {
  const data = useResource<SettingsData>(['settings'], '/api/admin/settings');
  const mutate = useResourceMutation('settings');
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data.data) {
      setValues(Object.fromEntries(data.data.settings.map((s) => [s.key, s.value ?? ''])));
    }
  }, [data.data]);

  return (
    <div>
      <PageHeader title="Settings" description="Runtime configuration — takes effect without a deploy." />

      {data.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {data.data?.settings.map((s) => (
            <Card key={s.key}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{s.label}</p>
                    {s.isSecret && <Badge variant="secondary">Secret</Badge>}
                    {!s.isSet && <Badge variant="warning">Unset</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.help}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{s.key}</p>
                </div>

                <div className="flex items-center gap-2">
                  {s.options ? (
                    <Select className="w-44" value={values[s.key] ?? ''} onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}>
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
                      value={values[s.key] ?? ''}
                      onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
                    />
                  )}
                  <Button
                    size="sm"
                    disabled={!values[s.key] || mutate.isPending}
                    onClick={() =>
                      mutate.mutate({ path: `/api/admin/settings/${s.key}`, method: 'put', body: { value: values[s.key], isSecret: s.isSecret } })
                    }
                  >
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
