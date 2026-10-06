import { EyeOff, Film, Headphones, Images, MoreHorizontal, Pencil, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect } from '@/components/table-filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useResource } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateOnly } from '@/lib/utils';
import { MEDIA_LABEL, STATUS_LABEL, STATUS_VARIANT, type MediaType, type ReelStatus } from '@/lib/reel-doc';
import type { Creator } from '@/components/reel-details-panel';

type ReelRow = {
  id: string;
  status: ReelStatus;
  mediaType: MediaType;
  caption: string | null;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  publishedAt: string | null;
  creator: { id: string; displayName: string };
  verse: { verseId: string } | null;
};

const MEDIA_ICON = { VIDEO: Film, IMAGE: Images, AUDIO: Headphones } as const;

export function ReelsPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const table = useDataTable<ReelRow>({
    id: 'reels',
    path: '/api/admin/reels',
    filters: ['status', 'mediaType', 'creatorId'],
  });
  const creators = useResource<Creator[]>(['reel-creators'], '/api/admin/reels/creators');

  const canWrite = hasPermission('reel.write');
  const canPublish = hasPermission('reel.publish');
  const canDelete = hasPermission('reel.delete');

  const create = (type: MediaType) => navigate(`/reels/new?type=${type}`);
  const edit = (reel: ReelRow) => navigate(`/reels/${reel.id}`);

  // The API refuses to publish a reel whose media is missing or whose creator
  // is not approved — a bulk publish reports those as failures and leaves them selected.
  const publish = (reels: ReelRow[], isPublished: boolean) =>
    table.runBulk(
      reels.filter((r) => (r.status === 'PUBLISHED') !== isPublished),
      isPublished ? 'Published' : 'Unpublished',
      (r) => api.post(`/api/admin/reels/${r.id}/publish`, { isPublished })
    );

  const remove = (reels: ReelRow[]) => {
    const deletable = reels.filter((r) => r.status !== 'PUBLISHED');
    if (deletable.length === 0) return;
    const skipped = reels.length - deletable.length;
    const what = deletable.length === 1 ? 'this reel' : `${deletable.length} reels`;
    if (!confirm(`Delete ${what}?${skipped ? ` (${skipped} published reel${skipped === 1 ? ' is' : 's are'} skipped — unpublish first.)` : ''}`)) return;
    table.runBulk(deletable, 'Deleted', (r) => api.delete(`/api/admin/reels/${r.id}`));
  };

  const columns: Column<ReelRow>[] = [
    {
      key: 'reel',
      header: 'Reel',
      fixed: true,
      csv: (r) => r.caption,
      render: (r) => {
        const Icon = MEDIA_ICON[r.mediaType];
        return (
          <div className="flex items-center gap-3">
            <div className="flex aspect-[9/16] h-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
              {r.thumbnailUrl ? <img src={r.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Icon className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 max-w-xs font-medium">{r.caption || <span className="text-muted-foreground">No caption</span>}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {MEDIA_LABEL[r.mediaType]}
                {r.verse ? ` · ${r.verse.verseId}` : ''}
              </p>
            </div>
          </div>
        );
      },
    },
    { key: 'creator', header: 'Creator', csv: (r) => r.creator.displayName, render: (r) => r.creator.displayName },
    {
      key: 'status',
      header: 'Status',
      sort: 'status',
      csv: (r) => STATUS_LABEL[r.status],
      render: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
    },
    { key: 'views', header: 'Views', sort: 'views', csv: (r) => r.viewCount, render: (r) => r.viewCount.toLocaleString() },
    { key: 'likes', header: 'Likes', sort: 'likes', csv: (r) => r.likeCount, render: (r) => r.likeCount.toLocaleString() },
    { key: 'comments', header: 'Comments', sort: 'comments', csv: (r) => r.commentCount, defaultHidden: true, render: (r) => r.commentCount.toLocaleString() },
    { key: 'created', header: 'Created', sort: 'createdAt', csv: (r) => r.createdAt, render: (r) => formatDateOnly(r.createdAt) },
    {
      key: 'published',
      header: 'Published',
      sort: 'publishedAt',
      csv: (r) => r.publishedAt,
      defaultHidden: true,
      render: (r) => (r.publishedAt ? formatDateOnly(r.publishedAt) : '—'),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Row actions" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => edit(r)}>
              <Pencil className="mr-2 h-4 w-4" />
              {canWrite ? 'Open editor' : 'View'}
            </DropdownMenuItem>
            {canPublish && (
              <DropdownMenuItem onClick={() => publish([r], r.status !== 'PUBLISHED')}>
                {r.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
              </DropdownMenuItem>
            )}
            {canDelete && r.status !== 'PUBLISHED' && (
              <DropdownMenuItem className="text-destructive" onClick={() => remove([r])}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reels"
        description="Build a reel from video, photos or a recitation, lay text and verses over it, then publish it to the feed."
      />

      <DataTable
        table={table}
        columns={columns}
        exportName="reels"
        searchPlaceholder="Search captions…"
        onRowClick={edit}
        filters={
          <>
            <FilterSelect
              table={table}
              name="status"
              label="Any status"
              options={(Object.keys(STATUS_LABEL) as ReelStatus[]).map((value) => ({ value, label: STATUS_LABEL[value] }))}
            />
            <FilterSelect
              table={table}
              name="mediaType"
              label="Any type"
              className="w-36"
              options={(Object.keys(MEDIA_LABEL) as MediaType[]).map((value) => ({ value, label: MEDIA_LABEL[value] }))}
            />
            <FilterSelect
              table={table}
              name="creatorId"
              label="Any creator"
              options={(creators.data ?? []).map((c) => ({ value: c.id, label: c.displayName }))}
            />
          </>
        }
        actions={
          canWrite && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  New reel
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => create('VIDEO')}>
                  <Film className="mr-2 h-4 w-4" />
                  Video reel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => create('IMAGE')}>
                  <Images className="mr-2 h-4 w-4" />
                  Photo slideshow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => create('AUDIO')}>
                  <Headphones className="mr-2 h-4 w-4" />
                  Audio reel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/reels/recipe')}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  From a book’s verses…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
        bulkActions={
          canPublish || canDelete
            ? (reels) => (
                <>
                  {canPublish && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => publish(reels, true)}>
                        <Send className="h-4 w-4" />
                        Publish
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => publish(reels, false)}>
                        <EyeOff className="h-4 w-4" />
                        Unpublish
                      </Button>
                    </>
                  )}
                  {canDelete && (
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => remove(reels)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </>
              )
            : undefined
        }
      />
    </div>
  );
}
