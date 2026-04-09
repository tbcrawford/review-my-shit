import { select, input } from '@inquirer/prompts';
import type { AgentModelSpec } from './schemas.js';

type Variant = 'high_thinking' | 'no_thinking';
type Tier = 'max' | 'high' | 'medium' | 'low';

interface ModelEntry {
  model: string;
  variant: Variant;
}

/** Tier → model+variant mapping for the copilot provider (Phase 19 models) */
const TIER_MODELS: Record<Tier, ModelEntry> = {
  max:    { model: 'github-copilot/claude-opus-4.6',  variant: 'high_thinking' },
  high:   { model: 'github-copilot/gpt-5.4',          variant: 'high_thinking' },
  medium: { model: 'github-copilot/claude-sonnet-4.6', variant: 'high_thinking' },
  low:    { model: 'github-copilot/claude-haiku-4.5', variant: 'no_thinking'   },
};

const TIERS: Tier[] = ['max', 'high', 'medium', 'low'];
const CUSTOM_VALUE = '__custom__';

/**
 * Show an interactive model picker for one agent.
 *
 * @param agent   - 'reviewer' | 'validator' | 'writer' (used for display only)
 * @param current - current AgentModelSpec (to annotate current selection), or undefined
 * @returns       resolved AgentModelSpec — always model + optional variant
 *
 * Picker shows variant tiers (max/high/medium/low) mapped to copilot models.
 * Includes a 'Enter custom model…' option for advanced users.
 *
 * Throws ExitPromptError if non-TTY or user cancels — callers should handle.
 */
export async function runModelPicker(
  agent: 'reviewer' | 'validator' | 'writer',
  current?: AgentModelSpec,
): Promise<AgentModelSpec> {
  // Build choice list: tiers first, then custom
  const choices = TIERS.map((tier) => {
    const entry = TIER_MODELS[tier];
    const isCurrent = current?.model === entry.model;
    return {
      name: `${tier.padEnd(6)}  ${entry.model} [${entry.variant}]${isCurrent ? '  (current)' : ''}`,
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
      message: 'Model spec (e.g., github-copilot/my-model or github-copilot/my-model:high_thinking):',
    });
    // Parse variant suffix if present
    const VALID_VARIANTS = ['high_thinking', 'no_thinking'];
    const lastColon = raw.lastIndexOf(':');
    if (lastColon !== -1) {
      const suffix = raw.slice(lastColon + 1);
      if (VALID_VARIANTS.includes(suffix)) {
        const model = raw.slice(0, lastColon);
        return { model, variant: suffix as Variant };
      }
    }
    // No valid variant suffix — plain model ID
    return { model: raw };
  }

  // Tier selection
  const selectedTier = selection as Tier;
  const entry = TIER_MODELS[selectedTier];
  return { model: entry.model, variant: entry.variant };
}
