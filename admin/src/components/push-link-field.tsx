import { Input, Label, Select } from '@/components/ui/input';
import { PUSH_TARGETS, type PushLink } from '@/lib/push-link';

/** Picks where a tap goes, from the app's own list, and asks for the values that one needs. */
export function PushLinkField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PushLink | null;
  onChange: (link: PushLink | null) => void;
}) {
  const target = PUSH_TARGETS.find((t) => t.key === value?.target);
  return (
    <div>
      <Label>{label}</Label>
      <Select
        className="mt-1"
        value={value?.target ?? ''}
        onChange={(e) => onChange(e.target.value ? { target: e.target.value } : null)}
      >
        <option value="">Just open the app</option>
        {PUSH_TARGETS.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label} — {t.key}
          </option>
        ))}
      </Select>
      {target && target.params.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {target.params.map((param) => (
            <Input
              key={param.name}
              placeholder={param.required ? param.label : `${param.label} (optional)`}
              value={value?.[param.name] ?? ''}
              onChange={(e) => onChange({ ...value!, [param.name]: e.target.value })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
