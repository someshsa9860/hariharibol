import { useState } from 'react';
import { Eye, Send } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/data-table';
import { DetailDialog, JsonValue } from '@/components/detail-dialog';
import { useResourceList, useResourceMutation } from '@/lib/use-resource';
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

export function NotificationsPage() {
  const [target, setTarget] = useState<'audience' | 'topic' | 'user'>('audience');
  const [audience, setAudience] = useState('active');
  const [topicKey, setTopicKey] = useState('');
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Notification | null>(null);

  const list = useResourceList<Notification>('notifications', '/api/admin/notifications', { page, pageSize: 20 });
  const mutate = useResourceMutation('notifications');

  function send() {
    if (target === 'audience') {
      mutate.mutate({ path: '/api/admin/notifications/audience', method: 'post', body: { audience, title, body } });
    } else if (target === 'topic') {
      mutate.mutate({ path: '/api/admin/notifications/topic', method: 'post', body: { topicKey, title, body } });
    } else {
      mutate.mutate({ path: `/api/admin/notifications/user/${userId}`, method: 'post', body: { title, body } });
    }
    setTitle('');
    setBody('');
  }

  const columns: Column<Notification>[] = [
    { key: 'title', header: 'Title', render: (n) => <p className="font-medium">{n.title}</p> },
    { key: 'body', header: 'Body', render: (n) => <p className="max-w-md truncate text-muted-foreground">{n.body}</p> },
    { key: 'type', header: 'Type', render: (n) => <Badge variant="outline">{n.type}</Badge> },
    { key: 'user', header: 'Recipient', render: (n) => n.user?.email ?? 'Broadcast' },
    { key: 'when', header: 'Sent', render: (n) => formatDate(n.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (n) => (
        <Button variant="ghost" size="icon" onClick={(e) => (e.stopPropagation(), setViewing(n))}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Notifications" description="Broadcast to a topic or an audience, or message one user." />

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
              <Label>User id</Label>
              <Input className="mt-1 w-64" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
          )}

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

          <Button
            onClick={send}
            disabled={
              !title ||
              !body ||
              (target === 'topic' && !topicKey) ||
              (target === 'user' && !userId) ||
              mutate.isPending
            }
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
        </CardContent>
      </Card>

      <h3 className="mb-2 text-sm font-medium">History</h3>
      <DataTable columns={columns} page={list.data} isLoading={list.isLoading} isError={list.isError} onPageChange={setPage} />

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.title}
        description={viewing?.user?.email ?? 'Broadcast'}
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
