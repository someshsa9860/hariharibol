'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { AudioButton } from '@/components/read/audio-button';
import { ShareButton, mantraTarget } from '@/components/share/share-button';
import { useChantSync } from './use-chant-sync';
import { useFavorite } from '@/lib/favorites';
import { BEADS_PER_ROUND, loadProgress, saveProgress } from '@/lib/jap-store';
import { claimAudio, releaseAudio } from '@/lib/audio-bus';
import { useLocalState } from '@/lib/use-local-state';
import { localDate } from '@/lib/format';
import type { Mantra } from '@/lib/types';

type Mode = 'tap' | 'along';

/** The chant counter: tap (or press Space) once per chant; a full round is 108. */
export function Counter({ mantra }: { mantra: Mantra }) {
  const toast = useToast();
  const sync = useChantSync(mantra.id);
  const { isFavorite, toggle: toggleFavorite } = useFavorite('mantra', mantra.id);
  const [settings, setSettings] = useLocalState('hhb.jap.settings', { vibrate: true, keepAwake: true, showMeaning: false, showTransliteration: true });

  const [beads, setBeads] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [sitting, setSitting] = useState(0); // rounds finished in this sitting
  const [prayerDone, setPrayerDone] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const [mode, setMode] = useState<Mode>('tap');
  const [ready, setReady] = useState(false);
  const state = useRef({ beads: 0, rounds: 0 });

  const mala = mantra.malaAudioUrl && mantra.malaAudioStartMs != null && mantra.malaAudioEndMs != null
    ? { url: mantra.malaAudioUrl, start: mantra.malaAudioStartMs, end: mantra.malaAudioEndMs }
    : null;
  const chantsInMala = mantra.standardCount && mantra.standardCount > 0 ? mantra.standardCount : BEADS_PER_ROUND;

  // The round in progress is kept per mantra, so a closed tab costs nothing.
  useEffect(() => {
    const saved = loadProgress(mantra.slug);
    state.current = { beads: saved.beads, rounds: saved.rounds };
    setBeads(saved.beads);
    setRounds(saved.rounds);
    setReady(true);
  }, [mantra.slug]);

  const add = useCallback((count = 1) => {
    let { beads: b, rounds: r } = state.current;
    let finished = 0;
    for (let i = 0; i < count; i += 1) {
      b += 1;
      if (b >= BEADS_PER_ROUND) { b = 0; r += 1; finished += 1; }
    }
    state.current = { beads: b, rounds: r };
    setBeads(b);
    setRounds(r);
    saveProgress(mantra.slug, { beads: b, rounds: r, date: localDate() });
    sync.update(r, b, finished > 0);
    if (finished > 0) {
      setSitting((s) => s + finished);
      setCelebrate((c) => c + 1);
      setPrayerDone(false);
      if (settings.vibrate && navigator.vibrate) navigator.vibrate([40, 60, 40]);
    } else if (settings.vibrate && navigator.vibrate) {
      navigator.vibrate(8);
    }
  }, [mantra.slug, settings.vibrate, sync]);

  const undo = () => {
    let { beads: b, rounds: r } = state.current;
    if (b === 0) return;
    b -= 1;
    state.current = { beads: b, rounds: r };
    setBeads(b);
    saveProgress(mantra.slug, { beads: b, rounds: r, date: localDate() });
  };

  const reset = () => {
    state.current = { beads: 0, rounds: state.current.rounds };
    setBeads(0);
    saveProgress(mantra.slug, { beads: 0, rounds: state.current.rounds, date: localDate() });
    toast('This round was cleared');
  };

  const prayerBlocking = Boolean(mantra.prayer) && !prayerDone && beads === 0 && mode === 'tap';

  // Space or Enter counts, like a bead under the thumb.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,select,button,a,[role="dialog"]')) return;
      if (event.code === 'Space' && mode === 'tap' && !prayerBlocking) { event.preventDefault(); add(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [add, mode, prayerBlocking]);

  // Keep the screen on while counting.
  useEffect(() => {
    if (!settings.keepAwake || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => navigator.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => undefined);
    void acquire();
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); void lock?.release(); };
  }, [settings.keepAwake]);

  const percent = Math.round((beads / BEADS_PER_ROUND) * 100);
  const text = mantra.text;

  return (
    <div className="counter">
      <div className="counter-modes" role="tablist" aria-label="Counting mode">
        <button role="tab" aria-selected={mode === 'tap'} className="chip" onClick={() => setMode('tap')}>Tap to count</button>
        {mala && <button role="tab" aria-selected={mode === 'along'} className="chip" onClick={() => setMode('along')}>Chant along</button>}
      </div>

      {mantra.prayer && mode === 'tap' && (
        <div className={clsx('prayer card', prayerBlocking && 'is-waiting')}>
          <span className="eyebrow">Opening prayer · {mantra.prayer.name}</span>
          <p className="deva" lang={mantra.prayer.textLanguage}>{mantra.prayer.text}</p>
          {prayerBlocking
            ? <button className="btn btn-primary btn-sm" onClick={() => setPrayerDone(true)}>I have chanted it <Icon name="check" size={16} /></button>
            : <small className="muted">Chant it again before each round.</small>}
        </div>
      )}

      {mode === 'tap' ? (
        <div className="bead-stage">
          <button
            className={clsx('bead-button', celebrate > 0 && 'celebrate')}
            key={celebrate}
            onPointerDown={(event) => { if (event.pointerType !== 'mouse' || event.button === 0) { if (!prayerBlocking) add(); } }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (!prayerBlocking) add(); } }}
            disabled={!ready || prayerBlocking}
            aria-label={`Count a chant. ${beads} of ${BEADS_PER_ROUND} in round ${rounds + 1}`}
            style={{ '--p': percent } as React.CSSProperties}
          >
            <span className="bead-ring" />
            <span className="bead-inner">
              <strong>{beads}</strong>
              <small>of {BEADS_PER_ROUND}</small>
            </span>
          </button>
          <p className="muted bead-hint">Tap the circle or press Space once for each chant.</p>
        </div>
      ) : (
        mala && <ChantAlong mala={mala} chants={chantsInMala} onBeads={add} />
      )}

      <div className="counter-stats">
        <div><strong>{rounds}</strong><small>rounds today</small></div>
        <div><strong>{sitting}</strong><small>this sitting</small></div>
        <div><strong>{rounds * BEADS_PER_ROUND + beads}</strong><small>chants today</small></div>
      </div>

      <div className="counter-actions">
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={beads === 0}><Icon name="minus" size={16} /> Undo one</button>
        <button className="btn btn-ghost btn-sm" onClick={reset} disabled={beads === 0}><Icon name="refresh" size={16} /> Clear round</button>
        <button className="btn btn-ghost btn-sm" onClick={toggleFavorite} aria-pressed={isFavorite}><Icon name="heart" size={16} solid={isFavorite} /> {isFavorite ? 'Saved' : 'Save'}</button>
        <ShareButton target={mantraTarget(mantra)} className="btn btn-ghost btn-sm" label=" Share" />
        <button className="btn btn-primary btn-sm" onClick={async () => { await sync.finish(); toast(sitting > 0 ? `${sitting} ${sitting === 1 ? 'round' : 'rounds'} recorded. Hari Bol!` : 'Sitting ended'); setSitting(0); }}>End sitting</button>
      </div>

      <MantraText mantra={mantra} text={text} settings={settings} setSettings={setSettings} />
    </div>
  );
}

function MantraText({ mantra, text, settings, setSettings }: { mantra: Mantra; text: string; settings: { vibrate: boolean; keepAwake: boolean; showMeaning: boolean; showTransliteration: boolean }; setSettings: (v: typeof settings) => void }) {
  const toggles = useMemo(() => [
    { key: 'showTransliteration', label: 'Transliteration' },
    { key: 'showMeaning', label: 'Meaning' },
    { key: 'vibrate', label: 'Vibrate on each chant' },
    { key: 'keepAwake', label: 'Keep screen on' },
  ] as const, []);
  return (
    <section className="mantra-text card" aria-label="The mantra">
      <p className="deva mantra-big" lang={mantra.textLanguage}>{mantra.text || text}</p>
      {settings.showTransliteration && mantra.transliteration && <p className="v-translit">{mantra.transliteration}</p>}
      {settings.showMeaning && mantra.meaning && <p className="mantra-meaning">{mantra.meaning}</p>}
      <div className="mantra-text-bar">
        {mantra.audioUrl && <AudioButton src={mantra.audioUrl} label="Listen" />}
        <div className="chip-row">
          {toggles.map((toggle) => (
            <button key={toggle.key} className="chip" aria-pressed={settings[toggle.key]} onClick={() => setSettings({ ...settings, [toggle.key]: !settings[toggle.key] })}>{toggle.label}</button>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Plays the whole-mala recording and counts a chant as each one in it finishes. */
function ChantAlong({ mala, chants, onBeads }: { mala: { url: string; start: number; end: number }; chants: number; onBeads: (count: number) => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0); // 0..1 through the chanting
  const counted = useRef(0);
  const span = mala.end - mala.start;
  const countRef = useRef(onBeads);
  countRef.current = onBeads;

  useEffect(() => {
    const element = new Audio(mala.url);
    audio.current = element;
    const onTime = () => {
      const t = Math.min(Math.max(element.currentTime * 1000 - mala.start, 0), span);
      setPosition(t / span);
      const done = Math.floor((t / span) * chants);
      if (done > counted.current) { countRef.current(done - counted.current); counted.current = done; }
      if (element.currentTime * 1000 >= mala.end) { element.pause(); setPlaying(false); counted.current = 0; setPosition(0); element.currentTime = mala.start / 1000; }
    };
    element.addEventListener('timeupdate', onTime);
    element.addEventListener('pause', () => setPlaying(false));
    return () => { element.pause(); element.removeEventListener('timeupdate', onTime); releaseAudio(element); };
  }, [mala, span, chants]);

  const toggle = async () => {
    const element = audio.current;
    if (!element) return;
    if (playing) return element.pause();
    claimAudio(element);
    if (element.currentTime * 1000 < mala.start) element.currentTime = mala.start / 1000;
    try { await element.play(); setPlaying(true); } catch { setPlaying(false); }
  };
  const seek = (value: number) => {
    const element = audio.current;
    if (!element) return;
    element.currentTime = (mala.start + value * span) / 1000;
    counted.current = Math.floor(value * chants);
    setPosition(value);
  };

  return (
    <div className="along card">
      <button className={clsx('play-big', playing && 'is-playing')} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        <Icon name={playing ? 'pause' : 'play'} size={34} />
      </button>
      <input type="range" min={0} max={1} step={0.001} value={position} onChange={(event) => seek(Number(event.target.value))} aria-label="Position in the recording" />
      <p className="muted">Chant with the recording. One chant is counted as each finishes.</p>
    </div>
  );
}
