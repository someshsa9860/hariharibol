import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useResource, useResourceMutation } from '@/lib/use-resource';
import { formatDateOnly } from '@/lib/utils';

type Pool = { total: number; byBook: { bookNumber: number; count: number }[]; mappedToIssues: number; notMappedToIssues: number; isTooSmall: boolean };
type Delivery = { date: string; picked: number; notified: number; seen: number; openRate: number };
type SlokaRow = { date: string; isPublished: boolean; sentAt: string | null; verse: { verseId: string; sanskrit: string | null; book: { title: string } } };
type Range = { from: string; to: string; slokas: SlokaRow[]; unset: string[] };

export function SlokasPage() {
  const pool = useResource<Pool>(['sloka-pool'], '/api/admin/slokas/pool');
  const delivery = useResource<Delivery>(['sloka-delivery'], '/api/admin/slokas/delivery');
  const range = useResource<Range>(['sloka-range'], '/api/admin/slokas');
  const mutate = useResourceMutation('sloka-range');

  const [editDate, setEditDate] = useState<string | null>(null);
  const [verseId, setVerseId] = useState('');

  return (
    <div>
      <PageHeader title="Daily sloka" description="The verse of the day — pool health, delivery and the calendar." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Pool</CardTitle>
          </CardHeader>
          <CardContent>
            {pool.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <p className="text-2xl font-semibold">{pool.data?.total}</p>
                <p className="text-xs text-muted-foreground">eligible verses</p>
                {pool.data?.isTooSmall && <Badge variant="warning" className="mt-2">Pool is thin — repeats likely</Badge>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {pool.data?.mappedToIssues} mapped to issues · {pool.data?.notMappedToIssues} not
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's delivery</CardTitle>
          </CardHeader>
          <CardContent>
            {delivery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <p className="text-2xl font-semibold">{delivery.data ? Math.round(delivery.data.openRate * 100) : 0}%</p>
                <p className="text-xs text-muted-foreground">open rate</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {delivery.data?.picked} picked · {delivery.data?.notified} notified · {delivery.data?.seen} seen
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unset days</CardTitle>
          </CardHeader>
          <CardContent>
            {range.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : range.data?.unset.length ? (
              <div className="flex flex-wrap gap-1">
                {range.data.unset.map((d) => (
                  <Badge key={d} variant="warning" className="cursor-pointer" onClick={() => (setEditDate(d), setVerseId(''))}>
                    {formatDateOnly(d)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Every day in range is set.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Verse</TableHead>
              <TableHead>Book</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {range.data?.slokas.map((s) => (
              <TableRow key={s.date}>
                <TableCell>{formatDateOnly(s.date)}</TableCell>
                <TableCell className="font-mono text-xs">{s.verse.verseId}</TableCell>
                <TableCell>{s.verse.book.title}</TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    <Badge variant={s.isPublished ? 'success' : 'secondary'}>{s.isPublished ? 'Published' : 'Draft'}</Badge>
                    {s.sentAt && <Badge variant="outline">Sent</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => (setEditDate(s.date), setVerseId(s.verse.verseId))}>
                    Edit
                  </Button>
                  {!s.sentAt && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Clear the sloka set for ${formatDateOnly(s.date)}?`)) {
                          mutate.mutate({ path: `/api/admin/slokas/${s.date.slice(0, 10)}`, method: 'delete' });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editDate} onOpenChange={(o) => !o && setEditDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set sloka for {editDate && formatDateOnly(editDate)}</DialogTitle>
          </DialogHeader>
          <Label>Verse id</Label>
          <Input className="mt-1" value={verseId} onChange={(e) => setVerseId(e.target.value)} placeholder="e.g. 2.13" />
          <p className="mt-1 text-xs text-muted-foreground">Must be from Bhagavad Gita or Srimad Bhagavatam and sloka-eligible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDate(null)}>
              Cancel
            </Button>
            <Button
              disabled={!verseId}
              onClick={() => {
                if (!editDate) return;
                mutate.mutate({ path: `/api/admin/slokas/${editDate.slice(0, 10)}`, method: 'put', body: { verseId, isPublished: true } });
                setEditDate(null);
              }}
            >
              <Plus className="h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
