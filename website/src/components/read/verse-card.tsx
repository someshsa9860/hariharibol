'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { AudioButton } from './audio-button';
import { CompareSheet } from './compare-sheet';
import { NotesSheet } from './notes-sheet';
import { useAuth } from '@/lib/auth/auth-provider';
import { SITE_URL } from '@/lib/config';
import { useFavorite } from '@/lib/favorites';
import { creditName, verseCitation, verseRef } from '@/lib/format';
import { verseHref } from '@/lib/links';
import { usePrefs } from '@/lib/prefs/prefs-provider';
import { copyText } from '@/lib/share';
import { ShareButton, verseTarget } from '@/components/share/share-button';
import type { Verse } from '@/lib/types';

interface Props {
  verse: Verse;
  /** The verse page shows everything, with no collapsing. */
  expanded?: boolean;
  /** Bring this verse to the front: used by the chapter reader's auto-play. */
  active?: boolean;
  onAudioEnded?: () => void;
}

function VerseCardInner({ verse, expanded, active, onAudioEnded }: Props) {
  const { reader } = usePrefs();
  const toast = useToast();
  const { isFavorite, toggle } = useFavorite('verse', verse.id);
  const { requireSignIn } = useAuth();
  const [comparing, setComparing] = useState(false);
  const [noting, setNoting] = useState(false);
  const [showWords, setShowWords] = useState(true);
  const [showPurport, setShowPurport] = useState(true);

  const translation = verse.translation;
  const credit = creditName(translation?.translator);
  const words = verse.wordMeanings ?? [];
  const citation = verseCitation(verse);
  const hasPurport = Boolean(translation?.purport);
  const wordsOpen = expanded || reader.showWordMeanings || showWords;

  const onCopy = async () => toast((await copyText(`${verse.sanskrit ?? ''}\n\n${verse.transliteration ?? ''}\n\n${translation?.meaning ?? ''}\n— ${citation}`)) ? 'Verse copied' : 'Could not copy');

  return (
    <article id={`v-${verse.verseNumber}`} className={clsx('verse-card', active && 'is-active', expanded && 'is-expanded')} style={{ '--scale': reader.fontScale } as React.CSSProperties}>
      <header className="verse-head">
        <Link href={`#v-${verse.verseNumber}`} className="verse-no" aria-label={`Verse ${verseRef(verse)}`}>{verseRef(verse)}</Link>
        <div className="verse-tools">
          {verse.audioUrl && <AudioButton compact src={verse.audioUrl} onEnded={onAudioEnded} label="Listen to this verse" />}
          <button className="icon-btn" onClick={toggle} aria-pressed={isFavorite} aria-label={isFavorite ? 'Remove from favourites' : 'Save to favourites'}>
            <Icon name="heart" solid={isFavorite} />
          </button>
          <button className="icon-btn" onClick={() => requireSignIn('Sign in to keep notes on verses.') && setNoting(true)} aria-label="My notes on this verse"><Icon name="text" /></button>
          <ShareButton target={verseTarget(verse)} ariaLabel="Share this verse" />
          <button className="icon-btn" onClick={onCopy} aria-label="Copy this verse"><Icon name="copy" /></button>
        </div>
      </header>

      <div className="v-main">
      {reader.showSanskrit && verse.sanskrit && <p className="v-sanskrit deva" lang="sa">{verse.sanskrit}</p>}
      {reader.showTransliteration && verse.transliteration && <p className="v-translit">{verse.transliteration}</p>}


      {words.length > 0 && (
        <div className="v-words">
          {!expanded && !reader.showWordMeanings && (
            <button className="text-link" onClick={() => setShowWords((v) => !v)} aria-expanded={wordsOpen}>
              Word meanings <Icon name={wordsOpen ? 'up' : 'down'} size={16} />
            </button>
          )}
          {wordsOpen && (
            <dl className="word-list">
              {words.map((word, index) => (
                <div key={index}>
                  {word.word && <dt lang="sa">{word.word}</dt>}
                  <dd>{word.meaning}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      </div>
      <div className="v-side">
      {translation?.meaning && (
        <div className="v-translation">
          <p>{translation.meaning}</p>
          {credit && <small>— {credit}</small>}
        </div>
      )}

      {hasPurport && reader.showPurport && (
        <div className="v-purport">
          <button className="text-link" onClick={() => setShowPurport((v) => !v)} aria-expanded={showPurport}>
            Purport <Icon name={showPurport ? 'up' : 'down'} size={16} />
          </button>
          {showPurport && <div className="purport-text">{translation?.purport?.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>}
        </div>
      )}

      {verse.explanation && <p className="v-explain"><strong>In simple words</strong>{verse.explanation.text}</p>}

      </div>

      <footer className="verse-foot">
        {verse.availableTranslations.length > 1 && (
          <button className="btn btn-quiet btn-sm" onClick={() => setComparing(true)}>Compare translations</button>
        )}
        <Link className="btn btn-quiet btn-sm" href={verseHref(verse.verseId)}>Open verse page</Link>
      </footer>
      {noting && <NotesSheet verse={verse} onClose={() => setNoting(false)} />}
      {comparing && <CompareSheet verse={verse} onClose={() => setComparing(false)} />}
    </article>
  );
}

export const VerseCard = memo(VerseCardInner);
