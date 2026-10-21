'use client';

import { Sheet } from '@/components/ui/sheet';
import { Icon } from '@/components/ui/icon';
import { ReadingLanguageSelect, ThemeSwitch } from '@/components/layout/settings-menu';
import { FONT_SCALE_MAX, FONT_SCALE_MIN, usePrefs, type ReaderSettings } from '@/lib/prefs/prefs-provider';

const TOGGLES: { key: keyof Omit<ReaderSettings, 'fontScale' | 'mode' | 'storyPart' | 'storyNumbers'>; label: string }[] = [
  { key: 'showSanskrit', label: 'Sanskrit' },
  { key: 'showTransliteration', label: 'Transliteration' },
  { key: 'showWordMeanings', label: 'Word meanings, always open' },
  { key: 'showPurport', label: 'Purport' },
];

export function ReaderSettingsSheet({ onClose, bookSlug }: { onClose: () => void; bookSlug?: string }) {
  const { reader, setReader } = usePrefs();
  return (
    <Sheet title="Reading settings" onClose={onClose}>
      <div className="settings-stack">
        <div>
          <label className="field-label" htmlFor="read-language">Read in</label>
          <ReadingLanguageSelect id="read-language" bookSlug={bookSlug} />
        </div>

        <div>
          <span className="field-label">Text size</span>
          <div className="size-row">
            <button className="icon-btn" aria-label="Smaller text" onClick={() => setReader({ fontScale: reader.fontScale - 0.1 })}><Icon name="minus" /></button>
            <input type="range" min={FONT_SCALE_MIN} max={FONT_SCALE_MAX} step={0.05} value={reader.fontScale} aria-label="Text size" onChange={(event) => setReader({ fontScale: Number(event.target.value) })} />
            <button className="icon-btn" aria-label="Larger text" onClick={() => setReader({ fontScale: reader.fontScale + 0.1 })}><Icon name="plus" /></button>
          </div>
        </div>

        <div>
          <span className="field-label">Reading style</span>
          <div className="seg" role="radiogroup" aria-label="Reading style">
            <button role="radio" aria-checked={reader.mode === 'verse'} className={reader.mode === 'verse' ? 'on' : ''} onClick={() => setReader({ mode: 'verse' })}>Verse by verse</button>
            <button role="radio" aria-checked={reader.mode === 'story'} className={reader.mode === 'story' ? 'on' : ''} onClick={() => setReader({ mode: 'story' })}>Story</button>
          </div>
          {reader.mode === 'story' && (
            <label className="toggle">
              <input type="checkbox" checked={reader.storyNumbers} onChange={(event) => setReader({ storyNumbers: event.target.checked })} />
              <span className="switch" aria-hidden="true" />
              Verse numbers
            </label>
          )}
        </div>

        {reader.mode === 'verse' && <fieldset className="toggle-list">
          <legend className="field-label">Show</legend>
          {TOGGLES.map((toggle) => (
            <label key={toggle.key} className="toggle">
              <input type="checkbox" checked={reader[toggle.key]} onChange={(event) => setReader({ [toggle.key]: event.target.checked })} />
              <span className="switch" aria-hidden="true" />
              {toggle.label}
            </label>
          ))}
        </fieldset>}

        <div>
          <span className="field-label">Appearance</span>
          <ThemeSwitch />
        </div>
      </div>
    </Sheet>
  );
}
