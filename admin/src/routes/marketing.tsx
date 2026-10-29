// Marketing: email campaigns to readers and invitees. Tabs: Campaigns, Templates, Audiences. Reaching people needs
// `marketing.send` (super admin by default); preparing needs `marketing.manage`. See "Marketing" in admin/CLAUDE.md.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useResource, useResourceList } from '@/lib/use-resource';
import { STATUS_VARIANT, useMarketingLive, type Campaign, type Overview, type Template } from '@/lib/marketing';
import { CampaignDetailDialog, CampaignEditor } from '@/components/marketing-campaign';
import { TemplateEditor } from '@/components/marketing-template-editor';
import { MarketingAudiences } from '@/components/marketing-audiences';

function SetupCard({ o }: { o: Overview }) {
  const problems = [
    !o.setup.email.configured && 'No email server is set (MARKETING_SMTP_* or the SMTP_* values).',
    !o.setup.email.webhookConfigured && 'Bounces and complaints are not wired (MARKETING_SNS_TOPIC_ARN): without them the list is not protected.',
    !o.setup.postalAddress && 'No postal address in settings (marketing.postal_address); every email must carry one.',
    !o.setup.workerOnline && 'The worker is not running, so nothing would be sent.',
  ].filter(Boolean) as string[];
  if (problems.length === 0) return <p className="text-sm text-muted-foreground">Sending as {o.setup.email.from}. {o.limits.ratePerMinute} a minute, {o.limits.dailyCap.toLocaleString()} a day, {o.limits.weeklyCap} a week per reader.</p>;
  return <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><p className="font-medium">Before the first send</p><ul className="mt-1 list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul></div>;
}

export function MarketingPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('marketing.manage');
  const canSend = hasPermission('marketing.send');
  const qc = useQueryClient();
  const polling = useMarketingLive();
  const overview = useResource<Overview>(['marketing-overview'], '/api/admin/marketing/overview', undefined, { refetchInterval: polling ? 10_000 : false });
  const [status, setStatus] = useState('');
  const campaigns = useResourceList<Campaign>('marketing-campaigns', '/api/admin/marketing/campaigns', { status: status || undefined, pageSize: 50 });
  const templates = useResource<Template[]>(['marketing-templates'], '/api/admin/marketing/templates');
  const [editing, setEditing] = useState<string | null | undefined>(undefined); // undefined: closed, null: new
  const [open, setOpen] = useState<string | null>(null);
  const [tpl, setTpl] = useState<string | null>(null);
  const [newTpl, setNewTpl] = useState('');
  const o = overview.data;

  return (
    <div>
      <PageHeader title="Marketing" description="Email to readers and invitees, with consent, tracking and a guard on the sender’s reputation." actions={canManage && <Button onClick={() => setEditing(null)}>New campaign</Button>} />
      {o && <div className="mb-4"><SetupCard o={o} /></div>}
      {o && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {([['campaigns', 'campaigns'], ['running', 'running'], ['scheduled', 'scheduled'], ['sentThisMonth', 'sent this month'], ['contacts', 'invitees'], ['suppressed', 'blocked']] as const).map(([k, label]) => <Badge key={k} variant="secondary">{(o.counts[k] ?? 0).toLocaleString()} {label}</Badge>)}
        </div>
      )}
      <Tabs defaultValue="campaigns">
        <TabsList><TabsTrigger value="campaigns">Campaigns</TabsTrigger><TabsTrigger value="templates">Templates</TabsTrigger><TabsTrigger value="audiences">Audiences</TabsTrigger></TabsList>

        <TabsContent value="campaigns" className="space-y-3">
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {['DRAFT', 'SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="grid gap-2">
            {campaigns.data?.items.map((c) => (
              <Card key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setOpen(c.id)}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.template?.name ?? 'No template'} · {new Date(c.createdAt).toLocaleDateString()}{c.scheduledAt ? ` · scheduled ${new Date(c.scheduledAt).toLocaleString()}` : ''}</p></div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{c.totals.sent.toLocaleString()} / {c.totals.recipients.toLocaleString()} sent</span>
                    {c.pauseReason && <Badge variant="warning">{c.pauseReason}</Badge>}
                    <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {campaigns.data?.items.length === 0 && <p className="text-sm text-muted-foreground">No campaigns yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-3">
          {canManage && (
            <div className="flex gap-2">
              <Input className="max-w-xs" placeholder="New template name" value={newTpl} onChange={(e) => setNewTpl(e.target.value)} />
              <Button disabled={!newTpl.trim()} onClick={async () => { const res = await api.post<Template>('/api/admin/marketing/templates', { name: newTpl }); setNewTpl(''); void qc.invalidateQueries({ queryKey: ['marketing-templates'] }); setTpl(res.data.id); }}>Add template</Button>
            </div>
          )}
          <div className="grid gap-2">
            {templates.data?.map((t) => (
              <Card key={t.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setTpl(t.id)}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div><p className="font-medium">{t.name}</p><p className="text-xs text-muted-foreground">Used by {t.campaigns} campaign{t.campaigns === 1 ? '' : 's'}</p></div>
                  <div className="flex flex-wrap gap-1">{t.variants.map((v) => <Badge key={v.language} variant={v.status === 'APPROVED' ? 'success' : 'secondary'}>{v.language}</Badge>)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audiences"><MarketingAudiences canManage={canManage} /></TabsContent>
      </Tabs>

      {o && editing !== undefined && <CampaignEditor campaignId={editing} overview={o} onClose={() => setEditing(undefined)} onSaved={(id) => { setEditing(undefined); void qc.invalidateQueries({ queryKey: ['marketing-campaigns'] }); void qc.invalidateQueries({ queryKey: ['marketing-campaign', id] }); setOpen(id); }} />}
      {open && editing === undefined && <CampaignDetailDialog id={open} canSend={canSend} canManage={canManage} onClose={() => setOpen(null)} onEdit={() => setEditing(open)} />}
      {o && tpl && <TemplateEditor templateId={tpl} overview={o} onClose={() => setTpl(null)} />}
    </div>
  );
}
