import { Badge } from '@/components/ui/badge';

// Which provider and model answers a call, and what is tried if it does not. The API lists the engines a call would
// try right now (backend/services/ai/index.js, `describeChain`): the first is used, and each next one only when the one
// before it fails. Shown on the AI usage page and on the Ask Sakha page, so staff can see what is behind a reply; the
// number is the order, and both pages say so in the words around the list.

export type Engine = { provider: string; model: string; source: string };

const PROVIDERS: Record<string, string> = { gemini: 'Gemini', openai: 'OpenAI' };
export const providerName = (provider: string) => PROVIDERS[provider.toLowerCase()] ?? provider;

// `source` is the rule that put the engine in the list.
const SOURCES: Record<string, { label: string; hint: string; variant: 'success' | 'secondary' | 'warning' }> = {
  'free-tier': { label: 'free tier', hint: 'OpenAI’s free daily tokens — the switch on the AI usage page', variant: 'success' },
  settings: { label: 'Settings page', hint: 'The provider and model saved on the Settings page', variant: 'secondary' },
  env: { label: '.env', hint: 'The provider and model in the server’s .env', variant: 'secondary' },
  fallback: { label: 'fallback', hint: 'AI_FALLBACK_MODEL — used only when the engine before it is not working', variant: 'warning' },
};

export function EngineChain({ engines }: { engines: Engine[] }) {
  if (engines.length === 0) {
    return <p className="text-sm text-destructive">No AI provider is configured — add an API key to the server’s .env.</p>;
  }
  return (
    <ol className="space-y-1">
      {engines.map((engine, i) => {
        const source = SOURCES[engine.source] ?? { label: engine.source, hint: '', variant: 'secondary' as const };
        return (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-4 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
            <span>{providerName(engine.provider)}</span>
            <span className="font-mono text-xs">{engine.model}</span>
            <Badge variant={source.variant} title={source.hint}>
              {source.label}
            </Badge>
          </li>
        );
      })}
    </ol>
  );
}
