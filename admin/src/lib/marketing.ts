// Everything the Marketing page asks of the API (backend/routes/admin/marketing*.js). The database row is the truth;
// the websocket (`marketing.run`, `marketing.activity`) only makes the queries current sooner, and polling covers a
// socket that is not there — the same shape as lib/etiquette.ts.

import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent, useSocketStatus } from './socket';
import type { PickerProvider } from '@/components/model-picker';

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export const ACTIVE: CampaignStatus[] = ['QUEUED', 'RUNNING', 'PAUSED'];
export const STATUS_VARIANT: Record<CampaignStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  DRAFT: 'secondary', SCHEDULED: 'default', QUEUED: 'default', RUNNING: 'default', PAUSED: 'warning', COMPLETED: 'success', FAILED: 'destructive', CANCELLED: 'secondary',
};

export type AudienceFilter = {
  readingLanguages?: string[]; appLanguages?: string[]; countries?: string[]; states?: string[]; plans?: string[];
  donors?: boolean; premium?: boolean; joinedWithinDays?: number; joinedBeforeDays?: number; activeWithinDays?: number; lapsedDays?: number;
  chantedWithinDays?: number; neverChanted?: boolean; minStreak?: number; mantraIds?: string[]; bookSlugs?: string[]; platforms?: ('android' | 'ios' | 'web')[];
};
export type Audience = { users?: AudienceFilter | null; lists?: string[] };

export type Totals = { recipients: number; pending: number; sent: number; delivered: number; read: number; bounced: number; complained: number; failed: number; skipped: number };

export type Campaign = {
  id: string; name: string; channel: 'EMAIL' | 'WHATSAPP'; status: CampaignStatus; mode: 'MERGE' | 'AI_PER_USER';
  templateId: string | null; segmentId: string | null; audience: Audience | null; provider: string | null; model: string | null;
  maxCostUsd: number | null; ratePerMinute: number | null; scheduledAt: string | null;
  pauseReason: string | null; statusMessage: string | null; resumeAt: string | null; cancelRequested: boolean; pauseRequested: boolean;
  sampleApproved: boolean; materialised: boolean; totals: Totals; progress: { total: number; done: number; percent: number };
  usage: { inputTokens: number; outputTokens: number; calls: number; costUsd: number };
  createdAt: string; startedAt: string | null; finishedAt: string | null; heartbeatAt: string | null; stalled: boolean;
  template?: { id: string; name: string } | null;
};

export type FeedLine = { at: string; level?: string; text?: string; message?: string };
export type CampaignDetail = {
  campaign: Campaign; template: { id: string; name: string } | null; segment: { id: string; name: string } | null; audienceSummary: string | null;
  links: { position: number; kind: 'WEB' | 'APP'; target: string; label: string | null; clicks: number }[];
  funnel: { recipients: number; sent: number; delivered: number; opened: number; clicked: number; bounced: number; complained: number; failed: number; skipped: number; botClicks: number };
  skipReasons: Record<string, number>;
  failures: { id: string; status: string; error: string | null; language: string | null; email: string }[];
  attributions: Record<string, number>;
  samples: { id: string; language: string; subject: string | null; aiBlocks: unknown }[];
  problems: string[]; feed: FeedLine[];
};

export type Overview = {
  counts: Record<string, number>;
  setup: { email: { configured: boolean; own: boolean; from: string; replyTo: string | null; configurationSet: string | null; webhookConfigured: boolean; verified: unknown }; postalAddress: string | null; workerOnline: boolean };
  limits: { ratePerMinute: number; dailyCap: number; weeklyCap: number; aiMaxCostUsd: number | null; maxLinks: number; maxBlocks: number };
  ai: { providers: PickerProvider[]; defaultProvider: string; model: string; sampleSize: number };
  languages: { code: string; name: string; endonym: string }[];
  mergeFields: { key: string; label: string; sample: string }[];
  appTargets: { key: string; label: string; params?: string[] }[];
  active: Campaign[];
};

export type Block = { type: string; [key: string]: unknown };
export type Variant = {
  id: string; language: string; subject: string; preheader: string | null; blocks: Block[]; status: 'DRAFT' | 'APPROVED'; source: string;
  editedByHuman: boolean; approvedByName: string | null; fields: string[]; linkSlots: number[];
};
export type Template = { id: string; name: string; brief: string | null; updatedAt: string; campaigns: number; variants: Pick<Variant, 'language' | 'status' | 'source' | 'editedByHuman'>[] };
export type TemplateDetail = Omit<Template, 'variants' | 'campaigns'> & { variants: Variant[] };

export type Segment = { id: string; name: string; filter: AudienceFilter; summary: string; lastCount: number | null; lastCountAt: string | null };
export type ContactList = { id: string; name: string; description: string | null; memberCount: number };

export const FILTER_FIELDS = {
  numbers: [
    ['activeWithinDays', 'Seen in the last … days'], ['lapsedDays', 'Not seen for … days'], ['chantedWithinDays', 'Chanted in the last … days'],
    ['joinedWithinDays', 'Joined in the last … days'], ['joinedBeforeDays', 'Joined more than … days ago'], ['minStreak', 'Streak of at least … days'],
  ],
  lists: [
    ['readingLanguages', 'Reading languages (codes, e.g. hi, mr)'], ['appLanguages', 'App languages'], ['countries', 'Countries (e.g. IN, US)'],
    ['states', 'States'], ['plans', 'Plans (slugs)'], ['bookSlugs', 'Has read in book (slugs)'],
  ],
} as const;

/** Keeps the campaign queries current: a socket event refreshes at once, polling covers a missing socket. */
export function useMarketingLive() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['marketing-campaigns'] });
    void qc.invalidateQueries({ queryKey: ['marketing-overview'] });
    void qc.invalidateQueries({ queryKey: ['marketing-campaign'] });
  };
  useSocketEvent<Campaign>('marketing.run', refresh);
  useSocketEvent<unknown>('marketing.activity', () => void qc.invalidateQueries({ queryKey: ['marketing-campaign'] }));
  return useSocketStatus() !== 'live';
}

export const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 1000) / 10}%` : '—');
