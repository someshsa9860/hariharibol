'use client';

import { useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { describeError } from '@/lib/api/client';

/** Rounds chanted away from the screen, on a mala, entered afterwards. */
export function ManualSheet({ mantras, onClose, onSave }: { mantras: { id: string; name: string }[]; onClose: () => void; onSave: (rounds: number, mantraId?: string) => Promise<void> }) {
  const [rounds, setRounds] = useState(1);
  const [mantraId, setMantraId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave(rounds, mantraId || undefined);
      onClose();
    } catch (failure) {
      setError(describeError(failure));
      setBusy(false);
    }
  };

  return (
    <Sheet title="Add rounds from beads" onClose={onClose}>
      <form className="settings-stack" onSubmit={submit}>
        <div>
          <label className="field-label" htmlFor="manual-rounds">Rounds of 108</label>
          <input id="manual-rounds" className="input" type="number" min={1} max={200} value={rounds} onChange={(event) => setRounds(Math.max(1, Math.min(200, Number(event.target.value) || 1)))} />
        </div>
        <div>
          <label className="field-label" htmlFor="manual-mantra">Mantra (optional)</label>
          <select id="manual-mantra" className="select" value={mantraId} onChange={(event) => setMantraId(event.target.value)}>
            <option value="">Not specified</option>
            {mantras.map((mantra) => <option key={mantra.id} value={mantra.id}>{mantra.name}</option>)}
          </select>
        </div>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Adding…' : 'Add rounds'}</button>
      </form>
    </Sheet>
  );
}
