'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-provider';
import { localDate } from '@/lib/format';
import { CATEGORIES, PRESETS, SLOTS, TIMING_LABEL, formatMinutes, parseTime, rowsFor, stripDays, timeValue, timingOf, type Category, type Row, type Slot } from './routine-store';
import { useRoutine, type NewItem } from './use-routine';

const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });
const LONG = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const at = (day: string) => new Date(`${day}T12:00:00`);

export function RoutineView() {
  const { user, openSignIn } = useAuth();
  const { state, ready, addTask, addDaily, toggle, remove } = useRoutine();
  const today = useMemo(() => localDate(), []);
  const [day, setDay] = useState(today);
  const [adding, setAdding] = useState(false);
  const rows = ready ? rowsFor(state, day) : [];
  const done = rows.filter((r) => r.done).length;
  const percent = rows.length ? Math.round((done / rows.length) * 100) : 0;

  return (
    <div className="page-narrow routine">
      <header className="page-title">
        <p className="eyebrow">Daily rhythm</p>
        <h1>Routine</h1>
        <p>Shape your day around what matters. It works offline{user ? ' and follows you to every device' : ''}.</p>
      </header>

      {!ready ? <div className="skeleton" style={{ height: 220, marginTop: 16 }} aria-hidden="true" /> : <>
      <div className="date-strip" role="tablist" aria-label="Day">
        {stripDays(today).map((d) => (
          <button key={d} role="tab" aria-selected={d === day} className={clsx('date-chip', d === today && 'is-today')} onClick={() => setDay(d)}>
            <small>{WEEKDAY.format(at(d))}</small><strong>{at(d).getDate()}</strong>
          </button>
        ))}
      </div>

      <div className="routine-head">
        <div><h2>{day === today ? 'Today' : LONG.format(at(day))}</h2><p className="muted">{day === today ? LONG.format(at(day)) : ''}</p></div>
        <div className="routine-progress" aria-label={`${done} of ${rows.length} done`}>
          <span>{done}/{rows.length}</span>
          <i><b style={{ width: `${percent}%` }} /></i>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="A clear day" motif="sun" action={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add something</button>}>
          Add tasks for today, or set a daily routine that repeats.
        </EmptyState>
      ) : (
        <ul className="task-list">
          {rows.map((row) => <TaskRow key={`${row.kind}-${row.id}`} row={row} onToggle={() => toggle(row.kind, row.id, day)} onRemove={() => remove(row.kind, row.id, day)} />)}
        </ul>
      )}

      </>}

      <button className="fab btn btn-primary btn-lg" onClick={() => setAdding(true)}><Icon name="plus" size={20} /> Add</button>

      {!user && <p className="muted small-note center-text">Kept in this browser. <button className="link-btn" onClick={() => openSignIn('Sign in to keep your routine on every device.')}>Sign in</button> to take it with you.</p>}

      {adding && <AddSheet onClose={() => setAdding(false)} onAddTask={(item) => addTask(day, item)} onAddDaily={(item) => addDaily(day, item)} />}
    </div>
  );
}

function TaskRow({ row, onToggle, onRemove }: { row: Row; onToggle: () => void; onRemove: () => void }) {
  const timing = timingOf(row);
  return (
    <li className={clsx('task', row.done && 'is-done')}>
      <button className="check" role="checkbox" aria-checked={row.done} aria-label={`${row.title}, ${row.done ? 'done' : 'not done'}`} onClick={onToggle}>
        <Icon name="check" size={18} />
      </button>
      <div className="task-body">
        <strong>{row.title}</strong>
        <small className="muted">
          {row.windowStart !== undefined && row.windowEnd !== undefined ? `${formatMinutes(row.windowStart)} – ${formatMinutes(row.windowEnd)}` : SLOTS.find((s) => s.value === row.slot)?.label}
          {' · '}{CATEGORIES.find((c) => c.value === row.category)?.label}{row.kind === 'daily' ? ' · every day' : ''}
        </small>
      </div>
      {timing && <span className={clsx('timing', `timing-${timing}`)}><Icon name="check" size={12} /> {TIMING_LABEL[timing]}{row.doneAt != null ? ` · ${formatMinutes(row.doneAt)}` : ''}</span>}
      <button className="icon-btn" onClick={onRemove} aria-label={`Remove ${row.title}`}><Icon name="trash" size={18} /></button>
    </li>
  );
}

function AddSheet({ onClose, onAddTask, onAddDaily }: { onClose: () => void; onAddTask: (item: NewItem) => void; onAddDaily: (item: NewItem) => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('devotion');
  const [slot, setSlot] = useState<Slot>('anytime');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [daily, setDaily] = useState(false);
  const [error, setError] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const windowStart = parseTime(start);
    const windowEnd = parseTime(end);
    if (!title.trim()) return setError('Give it a name.');
    if ((windowStart === undefined) !== (windowEnd === undefined)) return setError('Set both a start and an end time, or neither.');
    if (windowStart !== undefined && windowEnd !== undefined && windowEnd <= windowStart) return setError('The end time must be after the start.');
    const item: NewItem = { title: title.trim().slice(0, 200), category, slot, ...(windowStart !== undefined ? { windowStart, windowEnd } : {}) };
    (daily ? onAddDaily : onAddTask)(item);
    onClose();
  };

  return (
    <Sheet title="Add to your day" onClose={onClose}>
      <div className="chip-row" aria-label="Standard routines">
        {PRESETS.map((p) => (
          <button key={p.title} type="button" className="chip" onClick={() => { setTitle(p.title); setCategory(p.category); setSlot(p.slot); setStart(timeValue(p.start)); setEnd(timeValue(p.end)); setDaily(true); }}>{p.title}</button>
        ))}
      </div>
      <form className="settings-stack" onSubmit={submit}>
        <div><label className="field-label" htmlFor="rt-title">What</label><input id="rt-title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Read one chapter" autoFocus /></div>
        <div className="two">
          <div><label className="field-label" htmlFor="rt-cat">Kind</label><select id="rt-cat" className="select" value={category} onChange={(e) => setCategory(e.target.value as Category)}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
          <div><label className="field-label" htmlFor="rt-slot">When</label><select id="rt-slot" className="select" value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>{SLOTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        </div>
        <div className="two">
          <div><label className="field-label" htmlFor="rt-start">From (optional)</label><input id="rt-start" type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label className="field-label" htmlFor="rt-end">To</label><input id="rt-end" type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <label className="toggle"><input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} /><span className="switch" aria-hidden="true" />Repeat every day (daily routine)</label>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block">Add</button>
      </form>
    </Sheet>
  );
}
