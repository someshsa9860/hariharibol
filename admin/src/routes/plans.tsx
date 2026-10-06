import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Pencil, Users as UsersIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResource } from '@/lib/use-resource';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatMinorUnits } from '@/lib/utils';

type Price = {
  id: string;
  planId: string;
  provider: string;
  productId: string;
  priceMinor: number;
  currency: string;
  periodDays: number;
  trialDays: number;
  isActive: boolean;
};
type Feature = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  kind: 'FLAG' | 'LIMIT';
  unit: string | null;
  defaultEnabled: boolean;
  sortOrder: number;
  isActive: boolean;
};
type PlanFeature = { featureId: string; enabled: boolean; limit: number | null };
type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tier: number;
  isFree: boolean;
  grantedToDonors: boolean;
  isActive: boolean;
  prices: Price[];
  features: PlanFeature[];
  _count: { subscriptions: number };
};

// What a provider is called on screen. A provider added on the backend with no
// entry here still shows up — under its key.
const PROVIDER_LABELS: Record<string, string> = {
  GOOGLE_PLAY: 'Google Play',
  APPLE_APP_STORE: 'App Store',
  RAZORPAY: 'Razorpay',
};
const providerLabel = (key: string) => PROVIDER_LABELS[key] ?? key;

const periodLabel = (days: number) =>
  days === 7 ? 'week' : days === 30 ? 'month' : days === 90 ? '3 months' : days === 180 ? '6 months' : days === 365 ? 'year' : `${days} days`;

// The panel edits money in whole currency units; the API wants minor units.
const toMinor = (major: string) => Math.round(parseFloat(major || '0') * 100);
const toMajor = (minor: number) => String(minor / 100);

function useWrite() {
  const queryClient = useQueryClient();
  return async (method: 'post' | 'patch' | 'put' | 'delete', path: string, body?: unknown) => {
    await api[method](path, body);
    await queryClient.invalidateQueries({ queryKey: ['plans'] });
    await queryClient.invalidateQueries({ queryKey: ['features'] });
  };
}

const errorText = (error: unknown) => (error instanceof ApiRequestError ? error.message : 'Could not save.');

function FormError({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

// ── Plan dialog ────────────────────────────────────────────────────────────

function PlanDialog({ plan, onClose }: { plan: Plan | 'new' | null; onClose: () => void }) {
  const write = useWrite();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState('1');
  const [donors, setDonors] = useState(false);
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isNew = plan === 'new';
  const free = plan && plan !== 'new' && plan.isFree;

  useEffect(() => {
    setError('');
    if (plan === 'new') {
      setSlug('');
      setName('');
      setDescription('');
      setTier('1');
      setDonors(false);
      setActive(true);
    } else if (plan) {
      setSlug(plan.slug);
      setName(plan.name);
      setDescription(plan.description ?? '');
      setTier(String(plan.tier));
      setDonors(plan.grantedToDonors);
      setActive(plan.isActive);
    }
  }, [plan]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const body = { name, description: description || null, tier: Number(tier), grantedToDonors: donors, isActive: active };
      if (isNew) await write('post', '/api/admin/plans', { ...body, slug, description: description || undefined });
      else if (plan) await write('patch', `/api/admin/plans/${plan.id}`, free ? { name, description: description || null } : body);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!plan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New plan' : `Edit ${(plan as Plan)?.name}`}</DialogTitle>
          <DialogDescription>A plan is a tier. Prices and feature values are set separately.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {isNew ? (
            <div>
              <Label>Slug</Label>
              <Input className="mt-1" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="gold" />
            </div>
          ) : (
            <div>
              <Label>Slug</Label>
              <Input className="mt-1" value={slug} disabled />
            </div>
          )}
          <div>
            <Label>Tier</Label>
            <Input className="mt-1" type="number" min={free ? 0 : 1} value={tier} disabled={!!free} onChange={(e) => setTier(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Higher wins when someone holds more than one.</p>
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {!free && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={donors} onChange={(e) => setDonors(e.target.checked)} />
              Donors get this plan permanently
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active (shown in the app)
            </label>
          </div>
        )}
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name || (isNew && !slug)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Price dialog ───────────────────────────────────────────────────────────

type PriceTarget = { plan: Plan; price: Price | null } | null;

function PriceDialog({ target, onClose }: { target: PriceTarget; onClose: () => void }) {
  const write = useWrite();
  const providers = useResource<string[]>(['plans', 'providers'], '/api/admin/plans/providers');
  const [provider, setProvider] = useState('');
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [period, setPeriod] = useState('30');
  const [trial, setTrial] = useState('0');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = target?.price ?? null;

  useEffect(() => {
    setError('');
    const p = target?.price;
    setProvider(p?.provider ?? '');
    setProductId(p?.productId ?? '');
    setAmount(p ? toMajor(p.priceMinor) : '');
    setCurrency(p?.currency ?? 'INR');
    setPeriod(String(p?.periodDays ?? 30));
    setTrial(String(p?.trialDays ?? 0));
    setActive(p?.isActive ?? true);
  }, [target]);

  async function save() {
    if (!target) return;
    setSaving(true);
    setError('');
    try {
      const body = { productId, priceMinor: toMinor(amount), currency, periodDays: Number(period), trialDays: Number(trial), isActive: active };
      if (editing) await write('patch', `/api/admin/prices/${editing.id}`, body);
      else await write('post', `/api/admin/plans/${target.plan.id}/prices`, { ...body, provider });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit price' : 'Add price'} · {target?.plan.name}
          </DialogTitle>
          <DialogDescription>
            One store product for one billing period. Changing a price does not change what current subscribers pay.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Provider</Label>
            <Select className="mt-1" value={provider} disabled={!!editing} onChange={(e) => setProvider(e.target.value)}>
              <option value="">Choose…</option>
              {(providers.data ?? []).map((key) => (
                <option key={key} value={key}>
                  {providerLabel(key)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Store product id</Label>
            <Input className="mt-1" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="premium_monthly" />
          </div>
          <div>
            <Label>Price</Label>
            <Input className="mt-1" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Currency</Label>
            <Input className="mt-1" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>Billing period (days)</Label>
            <Input className="mt-1" type="number" min={1} value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div>
            <Label>Free trial (days)</Label>
            <Input className="mt-1" type="number" min={0} value={trial} onChange={(e) => setTrial(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          The store enforces the trial and charges its own localised price; these are what the app shows beforehand.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (offered in the app)
        </label>
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !productId || amount === '' || (!editing && !provider)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Feature values for one plan ────────────────────────────────────────────

function PlanFeaturesDialog({ plan, features, onClose }: { plan: Plan | null; features: Feature[]; onClose: () => void }) {
  const write = useWrite();
  const [values, setValues] = useState<Record<string, { enabled: boolean; limit: string }>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setError('');
    if (!plan) return;
    const next: Record<string, { enabled: boolean; limit: string }> = {};
    for (const f of features) {
      const v = plan.features.find((x) => x.featureId === f.id);
      next[f.id] = { enabled: v ? v.enabled : f.defaultEnabled, limit: v?.limit == null ? '' : String(v.limit) };
    }
    setValues(next);
  }, [plan, features]);

  const set = (id: string, patch: Partial<{ enabled: boolean; limit: string }>) =>
    setValues((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  async function save() {
    if (!plan) return;
    setSaving(true);
    setError('');
    try {
      await write('put', `/api/admin/plans/${plan.id}/features`, {
        values: features.map((f) => ({
          featureId: f.id,
          enabled: values[f.id].enabled,
          limit: f.kind === 'LIMIT' && values[f.id].limit !== '' ? Number(values[f.id].limit) : null,
        })),
      });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!plan} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Features · {plan?.name}</DialogTitle>
          <DialogDescription>What this plan unlocks. For a limit, leave the number empty for unlimited.</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {features.length === 0 && <p className="text-sm text-muted-foreground">No features yet — add some on the Features tab.</p>}
          {features.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={values[f.id]?.enabled ?? false} onChange={(e) => set(f.id, { enabled: e.target.checked })} />
                <span>
                  <span className="font-medium">{f.name}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{f.key}</span>
                </span>
              </label>
              {f.kind === 'LIMIT' && (
                <div className="flex items-center gap-1.5">
                  <Input
                    className="h-8 w-24"
                    type="number"
                    min={0}
                    placeholder="∞"
                    disabled={!values[f.id]?.enabled}
                    value={values[f.id]?.limit ?? ''}
                    onChange={(e) => set(f.id, { limit: e.target.value })}
                  />
                  <span className="text-xs text-muted-foreground">{f.unit}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || features.length === 0}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Plans tab ──────────────────────────────────────────────────────────────

function PlansTab({ features }: { features: Feature[] }) {
  const plans = useResource<Plan[]>(['plans'], '/api/admin/plans');
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('plan.manage');
  const write = useWrite();

  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const [pricing, setPricing] = useState<PriceTarget>(null);
  const [valuing, setValuing] = useState<Plan | null>(null);
  const [message, setMessage] = useState('');

  async function removePrice(price: Price) {
    if (!confirm(`Delete the ${providerLabel(price.provider)} price ${price.productId}?`)) return;
    setMessage('');
    try {
      await write('delete', `/api/admin/prices/${price.id}`);
    } catch (e) {
      setMessage(errorText(e));
    }
  }

  const activeFeatures = features.filter((f) => f.isActive);

  return (
    <div>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            New plan
          </Button>
        </div>
      )}
      {message && (
        <p role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      )}

      {plans.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {plans.data?.map((plan) => {
            const onCount = activeFeatures.filter((f) => {
              const v = plan.features.find((x) => x.featureId === f.id);
              return v ? v.enabled : f.defaultEnabled;
            }).length;
            return (
              <Card key={plan.id}>
                <CardContent className="space-y-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-base font-semibold">{plan.name}</p>
                        <Badge variant="outline">Tier {plan.tier}</Badge>
                        {plan.isFree && <Badge variant="secondary">Free baseline</Badge>}
                        {plan.grantedToDonors && <Badge variant="secondary">Donor plan</Badge>}
                        {!plan.isActive && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{plan.description || plan.slug}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Subscriptions">
                      <UsersIcon className="h-3.5 w-3.5" />
                      {plan._count.subscriptions}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prices</p>
                      {canEdit && !plan.isFree && (
                        <Button variant="outline" size="sm" onClick={() => setPricing({ plan, price: null })}>
                          <Plus className="h-3.5 w-3.5" />
                          Add price
                        </Button>
                      )}
                    </div>
                    {plan.isFree ? (
                      <p className="text-sm text-muted-foreground">Not sold — every user is on it by default.</p>
                    ) : plan.prices.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No prices yet — this plan cannot be bought.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {plan.prices.map((price) => (
                          <div key={price.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                            <div>
                              <p className="font-medium">
                                {providerLabel(price.provider)} ·{' '}
                                {formatMinorUnits(price.priceMinor, price.currency)} / {periodLabel(price.periodDays)}
                                {price.trialDays > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{price.trialDays}-day free trial</span>}
                                {!price.isActive && <Badge variant="secondary" className="ml-2">Inactive</Badge>}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">{price.productId}</p>
                            </div>
                            {canEdit && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" aria-label="Edit price" onClick={() => setPricing({ plan, price })}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-destructive" aria-label="Delete price" onClick={() => removePrice(price)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <p className="text-sm text-muted-foreground">
                      {onCount} of {activeFeatures.length} features on
                    </p>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setValuing(plan)}>
                          Features
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditing(plan)}>
                          Edit plan
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PlanDialog plan={editing} onClose={() => setEditing(null)} />
      <PriceDialog target={pricing} onClose={() => setPricing(null)} />
      <PlanFeaturesDialog plan={valuing} features={activeFeatures} onClose={() => setValuing(null)} />
    </div>
  );
}

// ── Features tab ───────────────────────────────────────────────────────────

function FeatureDialog({ feature, onClose }: { feature: Feature | 'new' | null; onClose: () => void }) {
  const write = useWrite();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'FLAG' | 'LIMIT'>('FLAG');
  const [unit, setUnit] = useState('');
  const [defaultEnabled, setDefaultEnabled] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isNew = feature === 'new';

  useEffect(() => {
    setError('');
    const f = feature && feature !== 'new' ? feature : null;
    setKey(f?.key ?? '');
    setName(f?.name ?? '');
    setDescription(f?.description ?? '');
    setKind(f?.kind ?? 'FLAG');
    setUnit(f?.unit ?? '');
    setDefaultEnabled(f?.defaultEnabled ?? true);
    setSortOrder(String(f?.sortOrder ?? 0));
    setActive(f?.isActive ?? true);
  }, [feature]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const body = { name, description: description || null, kind, unit: unit || null, defaultEnabled, sortOrder: Number(sortOrder), isActive: active };
      if (isNew) await write('post', '/api/admin/features', { ...body, key, description: description || undefined, unit: unit || undefined });
      else if (feature) await write('patch', `/api/admin/features/${feature.id}`, body);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!feature} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New feature' : `Edit ${(feature as Feature)?.name}`}</DialogTitle>
          <DialogDescription>
            A feature is something the app can do for a plan. Code asks about it by key, so the key cannot change.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Key</Label>
            <Input className="mt-1 font-mono" value={key} disabled={!isNew} onChange={(e) => setKey(e.target.value)} placeholder="downloads.offline" />
          </div>
          <div>
            <Label>Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Kind</Label>
            <Select className="mt-1" value={kind} onChange={(e) => setKind(e.target.value as 'FLAG' | 'LIMIT')}>
              <option value="FLAG">On / off</option>
              <option value="LIMIT">Limit (a number)</option>
            </Select>
          </div>
          <div>
            <Label>Unit</Label>
            <Input className="mt-1" value={unit} disabled={kind !== 'LIMIT'} onChange={(e) => setUnit(e.target.value)} placeholder="per day" />
          </div>
          <div>
            <Label>Display order</Label>
            <Input className="mt-1" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={defaultEnabled} onChange={(e) => setDefaultEnabled(e.target.checked)} />
            On for plans with no value set
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
        </div>
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name || (isNew && !key)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeaturesTab({ features, plans }: { features: Feature[]; plans: Plan[] }) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('plan.manage');
  const write = useWrite();
  const [editing, setEditing] = useState<Feature | 'new' | null>(null);
  const [message, setMessage] = useState('');

  async function remove(feature: Feature) {
    if (!confirm(`Delete "${feature.name}"? Its value is removed from every plan. Deactivating is gentler.`)) return;
    setMessage('');
    try {
      await write('delete', `/api/admin/features/${feature.id}`);
    } catch (e) {
      setMessage(errorText(e));
    }
  }

  const valueOn = (plan: Plan, f: Feature) => {
    const v = plan.features.find((x) => x.featureId === f.id);
    const enabled = v ? v.enabled : f.defaultEnabled;
    if (!enabled) return '—';
    if (f.kind === 'LIMIT') return v?.limit == null ? '∞' : String(v.limit);
    return '✓';
  };

  return (
    <div>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            New feature
          </Button>
        </div>
      )}
      {message && (
        <p role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      )}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Feature</th>
              <th className="px-3 py-2">Kind</th>
              {plans.map((p) => (
                <th key={p.id} className="px-3 py-2 text-center">
                  {p.name}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {features.length === 0 && (
              <tr>
                <td colSpan={plans.length + 3} className="px-3 py-6 text-center text-muted-foreground">
                  No features yet. Add one when the app grows a benefit worth giving.
                </td>
              </tr>
            )}
            {features.map((f) => (
              <tr key={f.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <p className="font-medium">
                    {f.name} {!f.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{f.key}</p>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{f.kind === 'LIMIT' ? `Limit${f.unit ? ` · ${f.unit}` : ''}` : 'On/off'}</Badge>
                </td>
                {plans.map((p) => (
                  <td key={p.id} className="px-3 py-2 text-center">
                    {valueOn(p, f)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" aria-label={`Delete ${f.name}`} onClick={() => remove(f)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Set a plan's value for each feature from the Plans tab.</p>
      <FeatureDialog feature={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

const TABS = ['plans', 'features'];

export function PlansPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') ?? '';
  const tab = TABS.includes(requested) ? requested : 'plans';
  const features = useResource<Feature[]>(['features'], '/api/admin/features');
  const plans = useResource<Plan[]>(['plans'], '/api/admin/plans');

  return (
    <div>
      <PageHeader
        title="Plans"
        description="Tiers, what each costs on each store, and the benefits each one unlocks. Free users are never restricted — paid plans add."
      />
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="plans">Plans & pricing</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>
        <TabsContent value="plans">
          <PlansTab features={features.data ?? []} />
        </TabsContent>
        <TabsContent value="features">
          <FeaturesTab features={features.data ?? []} plans={plans.data ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
