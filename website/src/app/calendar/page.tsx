import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarGlyph, KIND_LABEL } from '@/components/calendar/calendar-glyph';
import { ErrorState } from '@/components/ui/states';
import { Icon } from '@/components/ui/icon';
import { serverGet } from '@/lib/api/server';

export const metadata: Metadata = {
  title: 'Hindu calendar — Ekadashi, Chaturthi and festivals',
  description: 'The panchang for every day — tithi, nakshatra, month — with Ekadashi, Chaturthi, Purnima, Amavasya and the festivals marked.',
  alternates: { canonical: '/calendar' },
};

interface Day {
  date: string;
  tithi: { number: number; name: string; paksha: 'SHUKLA' | 'KRISHNA' };
  nakshatra: { name: string };
  yoga: string;
  karana: string;
  month: string;
  isAdhika: boolean;
  vikramSamvat: number;
  sunrise: string | null;
  sunset: string | null;
  notes: string | null;
}
interface Festival {
  date: string;
  slug: string;
  kind: string;
  name: string;
  paksha: string | null;
  vaishnavaDate: string | null;
}
interface Range {
  location: { name: string; timezone: string };
  today: string;
  days: Day[];
  festivals: Festival[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// What the grid hides: a plain pradosh or sankranti is in the day's details, not on its tile.
const QUIET = new Set(['PRADOSH', 'SANKRANTI']);

function monthOf(value: string | undefined, fallback: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? { y: Number(m[1]), m: Number(m[2]) } : { y: Number(fallback.slice(0, 4)), m: Number(fallback.slice(5, 7)) };
}
const shift = ({ y, m }: { y: number; m: number }, by: number) => {
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
const clock = (iso: string | null, zone: string) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true }) : '');

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const { m, d } = await searchParams;
  // The API names "today" for the calendar's place, so ask for the default month first only when none is chosen.
  const first = m ? null : await serverGet<Range>('/api/app/calendar', { revalidate: 300 }).catch(() => null);
  const { y, m: mo } = monthOf(m, first?.today ?? new Date().toISOString().slice(0, 10));
  const key = `${y}-${pad(mo)}`;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const data = first && !m ? first : await serverGet<Range>('/api/app/calendar', { query: { from: `${key}-01`, to: `${key}-${pad(last)}` }, revalidate: 300 }).catch(() => null);
  if (!data) {
    return (
      <div className="page">
        <ErrorState message="The calendar could not be loaded right now." />
      </div>
    );
  }

  const zone = data.location.timezone;
  const lead = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length: last }, (_, i) => `${key}-${pad(i + 1)}`)];
  const dayOf = (date: string) => data.days.find((x) => x.date === date);
  const festivalsOn = (date: string) => data.festivals.filter((f) => f.date === date);
  const selected = d && d.startsWith(key) ? d : data.today.startsWith(key) ? data.today : `${key}-01`;
  const sel = dayOf(selected);
  const title = new Date(Date.UTC(y, mo - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const highlights = data.festivals.filter((f) => !QUIET.has(f.kind));

  return (
    <div className="page">
      <header className="page-title">
        <p className="eyebrow">Calendar</p>
        <h1>Hindu calendar</h1>
        <p>
          Tithi, nakshatra and month for every day, with Ekadashi, Chaturthi and the festivals marked. Worked out from the sun and moon for {data.location.name}; a printed
          panchang from your own city can differ by a day where a tithi changes near sunrise.
        </p>
      </header>

      <nav className="cal-nav" aria-label="Month">
        <Link className="btn btn-ghost" href={`/calendar?m=${shift({ y, m: mo }, -1)}`} aria-label="Previous month"><Icon name="left" size={18} /></Link>
        <h2>{title}</h2>
        <Link className="btn btn-ghost" href={`/calendar?m=${shift({ y, m: mo }, 1)}`} aria-label="Next month"><Icon name="right" size={18} /></Link>
      </nav>

      {data.days.length === 0 ? (
        <p className="cal-empty">The calendar for {title} is not filled in yet.</p>
      ) : (
        <div className="cal-layout">
          <div className="cal-grid" role="grid" aria-label={title}>
            {WEEK.map((w) => <div key={w} className="cal-head" role="columnheader">{w}</div>)}
            {cells.map((date, i) => {
              if (!date) return <div key={`b${i}`} className="cal-blank" />;
              const day = dayOf(date);
              const fests = festivalsOn(date).filter((f) => !QUIET.has(f.kind));
              return (
                <Link
                  key={date}
                  href={`/calendar?m=${key}&d=${date}`}
                  scroll={false}
                  role="gridcell"
                  aria-label={`${Number(date.slice(8))} ${title}${day ? `, ${day.tithi.name}` : ''}${fests.length ? `, ${fests.map((f) => f.name).join(', ')}` : ''}`}
                  className={`cal-cell${date === data.today ? ' is-today' : ''}${date === selected ? ' is-selected' : ''}${fests.length ? ' has-festival' : ''}`}
                >
                  <span className="cal-date">{Number(date.slice(8))}</span>
                  {day && <span className="cal-tithi">{day.tithi.paksha === 'SHUKLA' ? 'S' : 'K'} {day.tithi.name}</span>}
                  <span className="cal-marks">
                    {fests.slice(0, 3).map((f) => <CalendarGlyph key={f.slug} kind={f.kind} size={16} />)}
                  </span>
                </Link>
              );
            })}
          </div>

          <aside className="card cal-detail" aria-live="polite">
            {sel && (
              <>
                <h3>{new Date(`${selected}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</h3>
                <dl>
                  <div><dt>Tithi</dt><dd>{sel.tithi.paksha === 'SHUKLA' ? 'Shukla' : 'Krishna'} {sel.tithi.name}</dd></div>
                  <div><dt>Nakshatra</dt><dd>{sel.nakshatra.name}</dd></div>
                  <div><dt>Yoga · Karana</dt><dd>{sel.yoga} · {sel.karana}</dd></div>
                  <div><dt>Month</dt><dd>{sel.month}{sel.isAdhika ? ' (Adhika)' : ''} · Vikram {sel.vikramSamvat}</dd></div>
                  <div><dt>Sunrise · Sunset</dt><dd>{clock(sel.sunrise, zone)} · {clock(sel.sunset, zone)}</dd></div>
                </dl>
                {sel.notes && <p className="cal-note">{sel.notes}</p>}
                <ul className="cal-festivals">
                  {festivalsOn(selected).map((f) => (
                    <li key={f.slug}>
                      <CalendarGlyph kind={f.kind} size={22} />
                      <span><strong>{f.name}</strong><small>{KIND_LABEL[f.kind]}{f.vaishnavaDate ? ` · Vaishnavas keep it on ${f.vaishnavaDate}` : ''}</small></span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      )}

      {highlights.length > 0 && (
        <section className="cal-list" aria-label={`Days to remember in ${title}`}>
          <h2>This month</h2>
          <ul>
            {highlights.map((f) => (
              <li key={`${f.date}-${f.slug}`}>
                <CalendarGlyph kind={f.kind} size={20} />
                <span className="cal-list-date">{new Date(`${f.date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'UTC' })}</span>
                <span>{f.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="cal-foot">Calendar for {data.location.name}. Tithi shown is the one running at sunrise.</p>
    </div>
  );
}
