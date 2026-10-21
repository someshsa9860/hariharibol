import { useState } from 'react';
import { Eye, Plus, Send, X } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { UserPicker, type PickedUser } from '@/components/user-picker';
import { ImageUploadField } from '@/components/image-upload-field';
import { PushLinkField } from '@/components/push-link-field';
import { PushPreview } from '@/components/push-preview';
import { readyLink, type PushLink } from '@/lib/push-link';
import { NotificationStats } from '@/components/notification-stats';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect } from '@/components/table-filters';
import { DetailDialog, JsonValue } from '@/components/detail-dialog';
import { useResourceMutation } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
import { ApiRequestError } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
  user: { email: string } | null;
};

const AUDIENCES = ['all', 'premium', 'free', 'active'];
type ActionButton = { label: string; link: PushLink | null };

const TYPES = ['ANNOUNCEMENT', 'SYSTEM', 'SLOKA', 'SADHANA', 'REEL'];

export function NotificationsPage() {
  const [target, setTarget] = useState<'audience' | 'topic' | 'user'>('audience');
  const [audience, setAudience] = useState('active');
  const [topicKey, setTopicKey] = useState('');
  const [user, setUser] = useState<PickedUser | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  // Beyond the words: a picture (an uploaded key, or a pasted https link), how it
  // is drawn, how loud it is, where a tap goes, and up to two buttons.
  const [imageKey, setImageKey] = useState('');
  const [imageLocal, setImageLocal] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [style, setStyle] = useState<'auto' | 'picture' | 'text'>('auto');
  const [importance, setImportance] = useState<'urgent' | 'quiet'>('urgent');
  const [link, setLink] = useState<PushLink | null>(null);
  const [buttons, setButtons] = useState<ActionButton[]>([]);
  const [viewing, setViewing] = useState<Notification | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const table = useDataTable<Notification>({
    id: 'notifications',
    path: '/api/admin/notifications',
    filters: ['type'],
    defaultSort: { key: 'createdAt', dir: 'desc' },
  });
  const mutate = useResourceMutation('notifications');

  const imageUrl = imageLocal ?? (/^https:\/\//i.test(imageKey) ? imageKey : null);
  const buttonsReady = buttons.every((b) => b.label.trim() && readyLink(b.link));
  const linkReady = !link?.target || !!readyLink(link);

  // What the send adds to the title and body. Empty fields are left out.
  function look() {
    return {
      ...(imageKey ? { image: imageKey } : {}),
      style,
      importance,
      ...(readyLink(link) ? { link } : {}),
      ...(buttons.length ? { actions: buttons.map((b) => ({ label: b.label.trim(), link: b.link })) } : {}),
    };
  }

  async function send() {
    if (
      target === 'audience' &&
      !confirm(`Send "${title}" to everyone in the "${audience}" audience? Each person gets it in their app.`)
    ) {
      return;
    }
    setResult(null);
    try {
      if (target === 'audience') {
        const res = await mutate.mutateAsync({ path: '/api/admin/notifications/audience', method: 'post', body: { audience, title, body, ...look() } });
        const sent = (res.data as { recipients?: number } | undefined)?.recipients;
        setResult({ tone: 'success', text: sent === undefined ? 'Sent.' : `Sent to ${sent.toLocaleString()} ${sent === 1 ? 'person' : 'people'}.` });
      } else if (target === 'topic') {
        await mutate.mutateAsync({ path: '/api/admin/notifications/topic', method: 'post', body: { topicKey, title, body, ...look() } });
        setResult({ tone: 'success', text: `Sent to topic "${topicKey}".` });
      } else {
        await mutate.mutateAsync({ path: `/api/admin/notifications/user/${user?.id}`, method: 'post', body: { title, body, ...look() } });
        setResult({ tone: 'success', text: `Sent to ${user?.email}.` });
      }
      // Only a sent message is cleared — a failed one stays in the form to fix and retry.
      setTitle('');
      setBody('');
      setImageKey('');
      setImageLocal(null);
      setLink(null);
      setButtons([]);
    } catch (error) {
      setResult({ tone: 'error', text: error instanceof ApiRequestError ? error.message : 'Could not send.' });
    }
  }

  const columns: Column<Notification>[] = [
    { key: 'title', header: 'Title', sort: 'title', fixed: true, csv: (n) => n.title, render: (n) => <p className="font-medium">{n.title}</p> },
    { key: 'body', header: 'Body', csv: (n) => n.body, render: (n) => <p className="max-w-md truncate text-muted-foreground">{n.body}</p> },
    { key: 'type', header: 'Type', sort: 'type', csv: (n) => n.type, render: (n) => <Badge variant="outline">{n.type}</Badge> },
    { key: 'user', header: 'Recipient', csv: (n) => n.user?.email ?? 'Broadcast', render: (n) => n.user?.email ?? 'Broadcast' },
    {
      key: 'delivery',
      header: 'Delivery',
      csv: (n) => (n.readAt ? 'Read' : n.sentAt ? 'Pushed' : 'In-app only'),
      defaultHidden: true,
      render: (n) => (n.readAt ? <Badge variant="success">Read</Badge> : n.sentAt ? <Badge variant="outline">Pushed</Badge> : '—'),
    },
    { key: 'when', header: 'Sent', sort: 'createdAt', csv: (n) => n.createdAt, render: (n) => formatDate(n.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (n) => (
        <Button variant="ghost" size="icon" aria-label="View details" onClick={(e) => (e.stopPropagation(), setViewing(n))}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Notifications" description="Broadcast to a topic or an audience, or message one user — with a picture, a tap target and buttons if you like." />

      <Card className="mb-6">
        <CardContent className="space-y-3 py-4">
          <div className="flex gap-2">
            {(['audience', 'topic', 'user'] as const).map((t) => (
              <Button key={t} size="sm" variant={target === t ? 'default' : 'outline'} onClick={() => setTarget(t)}>
                {t === 'audience' ? 'Audience' : t === 'topic' ? 'Topic' : 'One user'}
              </Button>
            ))}
          </div>

          {target === 'audience' && (
            <div>
              <Label>Audience</Label>
              <Select className="mt-1 w-48" value={audience} onChange={(e) => setAudience(e.target.value)}>
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {target === 'topic' && (
            <div>
              <Label>Topic key</Label>
              <Input className="mt-1 w-48" value={topicKey} onChange={(e) => setTopicKey(e.target.value)} />
            </div>
          )}
          {target === 'user' && (
            <div>
              <Label>User</Label>
              <UserPicker value={user} onChange={setUser} />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Title</Label>
                  <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
                </div>
                <div>
                  <Label>Body</Label>
                  <Textarea className="mt-1" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} />
                </div>
              </div>

              <ImageUploadField
                label="Picture (optional)"
                hint="Shown on Android and iPhone. A wide image, about 2:1, works best; JPEG, PNG or WebP."
                kind="pushImage"
                ratio="2 / 1"
                previewUrl={imageUrl}
                hasImage={!!imageKey}
                onBusyChange={setUploading}
                onUploaded={(key, local) => (setImageKey(key), setImageLocal(local))}
                onRemoved={() => (setImageKey(''), setImageLocal(null))}
              />
              <div>
                <Label>…or a picture link</Label>
                <Input
                  className="mt-1"
                  placeholder="https://"
                  value={imageLocal ? '' : imageKey}
                  onChange={(e) => (setImageKey(e.target.value.trim()), setImageLocal(null))}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Style</Label>
                  <Select className="mt-1" value={style} onChange={(e) => setStyle(e.target.value as typeof style)}>
                    <option value="auto">Automatic — big picture if there is one</option>
                    <option value="picture">Big picture</option>
                    <option value="text">Big text (no picture on Android)</option>
                  </Select>
                </div>
                <div>
                  <Label>Importance</Label>
                  <Select className="mt-1" value={importance} onChange={(e) => setImportance(e.target.value as typeof importance)}>
                    <option value="urgent">Urgent — pops up with sound</option>
                    <option value="quiet">Quiet — appears in the tray</option>
                  </Select>
                </div>
              </div>

              <PushLinkField label="When tapped, open" value={link} onChange={setLink} />

              <div>
                <Label>Buttons (up to two)</Label>
                {buttons.map((button, index) => (
                  <div key={index} className="mt-2 grid grid-cols-[1fr_1.4fr_auto] items-start gap-2">
                    <Input
                      placeholder="Label"
                      maxLength={24}
                      value={button.label}
                      onChange={(e) => setButtons(buttons.map((b, i) => (i === index ? { ...b, label: e.target.value } : b)))}
                    />
                    <PushLinkField
                      label=""
                      value={button.link}
                      onChange={(next) => setButtons(buttons.map((b, i) => (i === index ? { ...b, link: next } : b)))}
                    />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove button" onClick={() => setButtons(buttons.filter((_, i) => i !== index))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {buttons.length < 2 && (
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setButtons([...buttons, { label: '', link: null }])}>
                    <Plus className="h-4 w-4" />
                    Add button
                  </Button>
                )}
                {buttons.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Android draws buttons from the app itself, so they show on a phone that has this version of the app.
                  </p>
                )}
              </div>
            </div>

            <PushPreview title={title} body={body} imageUrl={imageUrl} style={style} buttons={buttons.map((b) => b.label.trim()).filter(Boolean)} />
          </div>

          <Button
            onClick={send}
            disabled={
              !title ||
              !body ||
              (target === 'topic' && !topicKey) ||
              (target === 'user' && !user) ||
              uploading ||
              !linkReady ||
              !buttonsReady ||
              mutate.isPending
            }
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
          {result && (
            <p role="status" className={result.tone === 'success' ? 'text-sm text-emerald-600' : 'text-sm text-destructive'}>
              {result.text}
            </p>
          )}
        </CardContent>
      </Card>

      <NotificationStats />

      <h3 className="mb-2 text-sm font-medium">History, person by person</h3>
      <DataTable
        table={table}
        columns={columns}
        exportName="notifications"
        searchPlaceholder="Search title or message…"
        emptyMessage="Nothing has been sent yet."
        onRowClick={setViewing}
        filters={<FilterSelect table={table} name="type" label="All types" options={TYPES} />}
      />

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.title}
        description={viewing?.user?.email ?? 'Broadcast'}
        audit={viewing ? { entityType: 'Notification', entityId: viewing.id } : undefined}
        fields={
          viewing
            ? [
                { label: 'Body', value: viewing.body, full: true },
                { label: 'Type', value: <Badge variant="outline">{viewing.type}</Badge> },
                { label: 'Sent', value: formatDate(viewing.createdAt) },
                { label: 'Push delivered', value: viewing.sentAt ? formatDate(viewing.sentAt) : '—' },
                { label: 'Read', value: viewing.readAt ? formatDate(viewing.readAt) : 'Not yet' },
                { label: 'Data payload', value: <JsonValue value={viewing.data} />, full: true },
                { label: 'Notification ID', value: <span className="font-mono text-xs">{viewing.id}</span> },
              ]
            : []
        }
      />
    </div>
  );
}
