// Choosing the AI provider and model for a run: a provider list (with a note where its key is missing) and, under it, the
// provider's own models with their prices. A model the provider cannot run the way a run calls it is listed but cannot be
// picked, with the reason. Used by the Scenes and Hindu calendar start dialogs; the catalogue comes from the server
// (backend/scripts/lib/translate-providers.js), so a new model appears here without a deploy of the panel.

import { useEffect, useState } from 'react';
import { Input, Label, Select } from '@/components/ui/input';

export type PickerModel = { id: string; inputPerMillion: number | null; outputPerMillion: number | null; unusableReason: string | null };
export type PickerProvider = {
  id: string;
  label: string;
  company: string;
  keyEnv: string;
  apiKeyConfigured: boolean;
  defaultModel: string;
  models?: PickerModel[];
};

const OTHER = '__other__';

const dollars = (n: number) => `$${n < 1 ? n.toFixed(2) : n.toFixed(n % 1 === 0 ? 0 : 2)}`;

function priceOf(model: PickerModel) {
  if (model.inputPerMillion == null || model.outputPerMillion == null) return null;
  return `${dollars(model.inputPerMillion)} in / ${dollars(model.outputPerMillion)} out per 1M tokens`;
}

/** The model a run would use: the one chosen, else the provider's default. */
export function modelFor(providers: PickerProvider[], provider: string, model: string) {
  return model.trim() || providers.find((p) => p.id === provider)?.defaultModel || '';
}

/** Why the chosen model cannot be used, from the catalogue; null when it can or when the catalogue does not know it. */
export function unusableReasonFor(providers: PickerProvider[], provider: string, model: string) {
  const id = modelFor(providers, provider, model);
  return providers.find((p) => p.id === provider)?.models?.find((m) => m.id === id)?.unusableReason ?? null;
}

export function ModelPicker({ idPrefix, providers, provider, model, onChange, disabled }: {
  idPrefix: string;
  providers: PickerProvider[];
  provider: string;
  /** Blank means the provider's default. */
  model: string;
  onChange: (next: { provider: string; model: string }) => void;
  disabled?: boolean;
}) {
  const info = providers.find((p) => p.id === provider);
  const models = info?.models ?? [];
  const known = models.some((m) => m.id === model);
  // "Other…" has to be remembered apart from the text, because choosing it leaves the text empty.
  const [other, setOther] = useState(model !== '' && !known);
  useEffect(() => {
    if (model !== '' && !known) setOther(true);
  }, [model, known]);

  const chosen = other ? OTHER : model;
  const picked = models.find((m) => m.id === model);
  const defaultModel = models.find((m) => m.id === info?.defaultModel);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-provider`}>AI provider</Label>
          <Select
            id={`${idPrefix}-provider`}
            className="w-full"
            value={provider}
            disabled={disabled}
            onChange={(ev) => {
              setOther(false);
              onChange({ provider: ev.target.value, model: '' });
            }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.company}
                {p.apiKeyConfigured ? '' : ' (no key)'}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-model`}>Model</Label>
          <Select
            id={`${idPrefix}-model`}
            className="w-full"
            value={chosen}
            disabled={disabled}
            onChange={(ev) => {
              if (ev.target.value === OTHER) {
                setOther(true);
                onChange({ provider, model: '' });
              } else {
                setOther(false);
                onChange({ provider, model: ev.target.value });
              }
            }}
          >
            <option value="">Default · {info?.defaultModel ?? ''}</option>
            {models
              .filter((m) => m.id !== info?.defaultModel)
              .map((m) => (
                <option key={m.id} value={m.id} disabled={!!m.unusableReason}>
                  {m.id}
                  {m.unusableReason ? ' (cannot be used here)' : ''}
                </option>
              ))}
            <option value={OTHER}>Other…</option>
          </Select>
        </div>
      </div>

      {other && (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-custom`}>Model name</Label>
          <Input
            id={`${idPrefix}-custom`}
            value={model}
            disabled={disabled}
            onChange={(ev) => onChange({ provider, model: ev.target.value })}
            placeholder={info?.defaultModel ?? ''}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">Exactly as {info?.company ?? 'the provider'} names it. A name the provider does not serve fails on the first request.</p>
        </div>
      )}

      {!other && (picked ?? (model === '' ? defaultModel : undefined)) && (() => {
        const shown = picked ?? defaultModel!;
        const price = priceOf(shown);
        return price ? <p className="text-xs text-muted-foreground">{shown.id} — {price}.</p> : null;
      })()}
      {!other && picked?.unusableReason && <p className="text-xs text-destructive">{picked.unusableReason}</p>}
    </div>
  );
}
