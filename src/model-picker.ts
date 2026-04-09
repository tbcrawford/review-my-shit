import { select, input } from '@inquirer/prompts';
import type { AgentModelSpec } from './schemas.js';

type Provider = AgentModelSpec['provider'];
type Tier = 'max' | 'high' | 'medium' | 'low';

/** Per-provider tier → model mapping from CONTEXT.md design decisions */
const TIER_MODELS: Record<Provider, Record<Tier, string>> = {
  copilot:   { max: 'claude-opus-4-5',  high: 'claude-sonnet-4-5', medium: 'claude-haiku-3-5', low: 'claude-haiku-3-5' },
  anthropic: { max: 'claude-opus-4-5',  high: 'claude-sonnet-4-5', medium: 'claude-haiku-3-5', low: 'claude-haiku-3-5' },
  openai:    { max: 'o3',               high: 'gpt-4o',            medium: 'gpt-4o-mini',       low: 'gpt-4o-mini' },
  google:    { max: 'gemini-2.5-pro',   high: 'gemini-2.0-pro',    medium: 'gemini-2.0-flash',  low: 'gemini-flash-1.5' },
};

const TIERS: Tier[] = ['max', 'high', 'medium', 'low'];
const CUSTOM_VALUE = '__custom__';

/**
 * Show an interactive model picker for one agent.
 *
 * @param agent   - 'reviewer' | 'validator' | 'writer' (used for display only)
 * @param current - current AgentModelSpec (to annotate current selection), or undefined
 * @returns       resolved AgentModelSpec — always provider + model
 *
 * Picker shows variant tiers (max/high/medium/low) for the copilot provider by default
 * since that's the configured default. Shows which model each tier maps to.
 * Includes a 'Enter custom model…' option for advanced users.
 *
 * Throws ExitPromptError if non-TTY or user cancels — callers should handle.
 */
export async function runModelPicker(
  agent: 'reviewer' | 'validator' | 'writer',
  current?: AgentModelSpec,
): Promise<AgentModelSpec> {
  // Default to copilot provider tiers (the configured default provider)
  const provider: Provider = 'copilot';
  const tierMap = TIER_MODELS[provider];

  // Build choice list: tiers first, then custom
  const choices = TIERS.map((tier) => {
    const model = tierMap[tier];
    const isCurrent =
      current?.provider === provider && current?.model === model;
    return {
      name: `${tier.padEnd(6)}  github-copilot/${model}${isCurrent ? '  (current)' : ''}`,
      value: tier as string,
    };
  });

  // Separator then custom option
  const allChoices = [
    ...choices,
    { name: '──────────────────────────────', value: '__sep__', disabled: true },
    { name: 'Enter custom model…', value: CUSTOM_VALUE },
  ];

  const selection = await select<string>({
    message: `Set ${agent} model:`,
    choices: allChoices,
  });

  if (selection === CUSTOM_VALUE) {
    const raw = await input({
      message: 'Model ID (e.g., github-copilot/my-model or anthropic:claude-opus-4-5):',
    });
    // github-copilot/model-id format → copilot provider
    if (raw.startsWith('github-copilot/')) {
      return { provider: 'copilot', model: raw.slice('github-copilot/'.length) };
    }
    // provider:model-id format
    const colonIdx = raw.indexOf(':');
    if (colonIdx !== -1) {
      const p = raw.slice(0, colonIdx) as Provider;
      const m = raw.slice(colonIdx + 1);
      return { provider: p, model: m };
    }
    // bare model ID — default to copilot
    return { provider: 'copilot', model: raw };
  }

  // Tier selection
  const selectedTier = selection as Tier;
  return { provider, model: tierMap[selectedTier] };
}
