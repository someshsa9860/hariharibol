'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/states';
import { webApi } from '@/lib/api/client';
import { creditName, verseCitation } from '@/lib/format';
import { usePrefs } from '@/lib/prefs/prefs-provider';
import type { Verse, WebVerse } from '@/lib/types';

/** Every translator's rendering of one verse, side by side. */
export function CompareSheet({ verse, onClose }: { verse: Verse; onClose: () => void }) {
  const { readingLanguage } = usePrefs();
  const [data, setData] = useState<WebVerse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    webApi<WebVerse>(`/content/verses/${verse.verseId}`, { lang: readingLanguage }).then(setData).catch(() => setFailed(true));
  }, [verse.verseId, readingLanguage]);

  return (
    <Sheet title={`Translations · ${verseCitation(verse)}`} onClose={onClose} wide>
      {failed && <div className="notice notice-error">The translations could not be loaded.</div>}
      {!data && !failed && <div className="center-state"><Spinner /></div>}
      {data && (
        <ul className="compare-list">
          {data.translations.filter((t) => t.meaning).map((t, index) => {
            const credit = creditName(t.translator);
            return (
              <li key={index}>
                <span className="badge">{t.languageCode.toUpperCase()}</span>
                {credit && <strong>{credit}</strong>}
                <p>{t.meaning}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
