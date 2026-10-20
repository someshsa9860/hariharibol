/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { Markdown } from '@/lib/markdown';
import { chapterHref } from '@/lib/links';
import { copyText } from '@/lib/share';
import type { Action, Line } from './use-sakha';

const PAGE_PATH: Record<string, string> = { home: '/', jap: '/jap', reels: '/reels', read: '/read', routine: '/routine', settings: '/me', plans: '/plans', search: '/search' };

function actionTarget(action: Action): { href: string; label: string } {
  if (action.type === 'page') return { href: PAGE_PATH[action.page] ?? '/', label: action.page === 'settings' ? 'Settings' : action.page.charAt(0).toUpperCase() + action.page.slice(1) };
  if (action.type === 'mantra') return { href: `/jap/${action.slug}`, label: action.title };
  return { href: chapterHref(action.bookSlug, action.canto, action.chapter, action.verse), label: action.title };
}

interface Props {
  line: Line;
  isLast: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onRetry: () => void;
}

export function MessageBubble({ line, isLast, canRegenerate, onRegenerate, onRetry }: Props) {
  const router = useRouter();
  const toast = useToast();
  const mine = line.role === 'user';
  const target = line.action ? actionTarget(line.action) : null;

  return (
    <div className={clsx('msg', mine ? 'msg-me' : 'msg-sakha')}>
      {!mine && <span className="msg-avatar" aria-hidden="true"><Icon name="sakha" size={16} /></span>}
      <div className="msg-col">
        {(mine || line.content || line.imageUrl || line.streaming) && <div className="bubble">
          {line.imageUrl && <img className="bubble-image" src={line.imageUrl} alt="A picture you shared" />}
          {mine ? (
            line.content && <p>{line.content}</p>
          ) : line.content ? (
            <div className="md"><Markdown text={line.content} />{line.streaming && <span className="caret" aria-hidden="true" />}</div>
          ) : line.streaming ? (
            <span className="typing" aria-label="Sakha is writing"><i /><i /><i /></span>
          ) : null}
          {line.status === 'STOPPED' && !mine && <small className="muted bubble-note">Stopped</small>}
          {line.status === 'PARTIAL' && line.problem && line.content && <small className="muted bubble-note">The reply was cut short</small>}
        </div>}

        {target && !line.streaming && (
          <button className="offer card-hover" onClick={() => router.push(target.href)}>
            <Icon name="arrow" size={16} /> Open {target.label}
          </button>
        )}

        {line.problem && (
          <div className="problem" role="alert">
            <p>{line.problem.text}</p>
            <div className="problem-actions">
              {line.problem.retry && <button className="btn btn-ghost btn-sm" onClick={onRetry}><Icon name="refresh" size={14} /> Try again</button>}
              {line.problem.upgrade && <Link className="btn btn-primary btn-sm" href="/plans">See plans</Link>}
            </div>
          </div>
        )}

        {!mine && !line.streaming && line.content && !line.problem && (
          <div className="msg-tools">
            <button className="icon-btn" aria-label="Copy reply" onClick={async () => toast((await copyText(line.content)) ? 'Copied' : 'Could not copy')}><Icon name="copy" size={16} /></button>
            {isLast && canRegenerate && <button className="icon-btn" aria-label="Answer again" onClick={onRegenerate}><Icon name="refresh" size={16} /></button>}
          </div>
        )}
      </div>
    </div>
  );
}
