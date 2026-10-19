'use client';

import { Sheet } from '@/components/ui/sheet';
import { Icon } from '@/components/ui/icon';
import { ReadingLanguageSelect, ThemeSwitch } from '@/components/layout/settings-menu';
import { FONT_SCALE_MAX, FONT_SCALE_MIN, usePrefs, type ReaderSettings } from '@/lib/prefs/prefs-provider';

const TOGGLES: { key: keyof Omit<ReaderSettings, 'fontScale'>; label: string }[] = [
  { key: 'showSanskrit', label: 'Sanskrit' },
  { key: 'showTransliteration', label: 'Transliteration' },
  { key: 'showWordMeanings', label: 'Word meanings, always open' },
  { key: 'showPurport', label: 'Purport' },
];

export function ReaderSettingsSheet({ onClose }: { onClose: () => void }) {
  const { reader, setReader } = usePrefs();
  return (
    <Sheet title="Reading settings" onClose={onClose}>
      <div className="settings-stack">
        <div>
          <label className="field-label" htmlFor="read-language">Read in</label>
          <ReadingLanguageSelect id="read-language" />
        </div>

        <div>
          <span className="field-label">Text size</span>
          <div className="size-row">
            <button className="icon-btn" aria-label="Smaller text" onClick={() => setReader({ fontScale: reader.fontScale - 0.1 })}><Icon name="minus" /></button>
            <input type="range" min={FONT_SCALE_MIN} max={FONT_SCALE_MAX} step={0.05} value={reader.fontScale} aria-label="Text size" onChange={(event) => setReader({ fontScale: Number(event.target.value) })} />
            <button className="icon-btn" aria-label="Larger text" onClick={() => setReader({ fontScale: reader.fontScale + 0.1 })}><Icon name="plus" /></button>
          </div>
        </div>

        <fieldset className="toggle-list">
          <legend className="field-label">Show</legend>
          {TOGGLES.map((toggle) => (
            <label key={toggle.key} className="toggle">
              <input type="checkbox" checked={reader[toggle.key]} onChange={(event) => setReader({ [toggle.key]: event.target.checked })} />
              <span className="switch" aria-hidden="true" />
              {toggle.label}
            </label>
          ))}
        </fieldset>

        <div>
          <span className="field-label">Appearance</span>
          <ThemeSwitch />
        </div>
      </div>
    </Sheet>
  );
}
