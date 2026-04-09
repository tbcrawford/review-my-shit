/**
 * @deprecated Phase 17: runSettingsTui() is no longer called from index.ts.
 * Model selection is now handled by src/model-picker.ts via rms reviewer/validator/writer subcommands.
 * This file is kept for reference only and will be deleted in a future cleanup.
 */
import { select } from '@inquirer/prompts';
import { loadRmsConfig, saveRmsConfig, getConfigPath } from './config.js';
import type { AgentModelSpec } from './schemas.js';

const MODELS: Record<string, Array<{ name: string; value: string }>> = {
  openai: [
    { name: 'gpt-4o', value: 'gpt-4o' },
    { name: 'gpt-4o-mini', value: 'gpt-4o-mini' },
    { name: 'o3', value: 'o3' },
    { name: 'o4-mini', value: 'o4-mini' },
  ],
  anthropic: [
    { name: 'claude-opus-4-5', value: 'claude-opus-4-5' },
    { name: 'claude-sonnet-4-5', value: 'claude-sonnet-4-5' },
    { name: 'claude-haiku-3-5', value: 'claude-haiku-3-5' },
  ],
  google: [
    { name: 'gemini-2.5-pro', value: 'gemini-2.5-pro' },
    { name: 'gemini-2.5-flash', value: 'gemini-2.5-flash' },
  ],
  copilot: [
    { name: 'claude-opus-4.6', value: 'claude-opus-4.6' },
    { name: 'claude-sonnet-4.6', value: 'claude-sonnet-4.6' },
    { name: 'gpt-4o', value: 'gpt-4o' },
    { name: 'o4-mini', value: 'o4-mini' },
    { name: 'gemini-2.5-pro', value: 'gemini-2.5-pro' },
  ],
};

function printFallbackHelp(): void {
  console.log('rms settings interactive picker requires a TTY.');
  console.log('');
  console.log('Set models with flags:');
  console.log('  rms settings --reviewer copilot:claude-opus-4.6');
  console.log(
    '  rms settings --reviewer github-copilot/claude-opus-4.6  (copy-paste from opencode models)',
  );
  console.log('  rms settings --reviewer anthropic:claude-opus-4-5');
  console.log('  rms settings --validator anthropic:claude-sonnet-4-5');
  console.log('  rms settings --writer openai:gpt-4o');
  console.log('');
  console.log('Supported providers: copilot, anthropic, openai, google');
  console.log('View current config: rms settings --help');
}

export async function runSettingsTui(): Promise<void> {
  try {
    // Step 1: Which agent?
    const agent = await select<'reviewer' | 'validator' | 'writer'>({
      message: 'Which agent do you want to configure?',
      choices: [
        { name: 'Reviewer', value: 'reviewer' },
        { name: 'Validator', value: 'validator' },
        { name: 'Writer', value: 'writer' },
      ],
    });

    // Step 2: Which provider?
    const provider = await select<AgentModelSpec['provider']>({
      message: 'Which provider?',
      choices: [
        { name: 'copilot  — GitHub Copilot (uses GITHUB_TOKEN)', value: 'copilot' },
        { name: 'anthropic — Direct Anthropic API key', value: 'anthropic' },
        { name: 'openai   — Direct OpenAI API key', value: 'openai' },
        { name: 'google   — Direct Google AI API key', value: 'google' },
      ],
    });

    // Step 3: Which model?
    const model = await select<string>({
      message: 'Which model?',
      choices: MODELS[provider] ?? [],
    });

    // Load existing config (or use defaults)
    const existing = await loadRmsConfig();
    const defaults = {
      reviewer: { provider: 'openai' as const, model: 'gpt-4o' },
      validator: { provider: 'openai' as const, model: 'gpt-4o' },
      writer: { provider: 'openai' as const, model: 'gpt-4o' },
    };
    const base = existing ?? defaults;

    // Apply the selection to the chosen agent key
    const updated = {
      ...base,
      [agent]: { provider, model },
    };

    await saveRmsConfig(updated);

    console.log(`Config saved: ${agent} → ${provider}:${model}`);
    console.log(`  Path: ${getConfigPath()}`);
  } catch {
    // ExitPromptError from non-TTY or Ctrl+C — fall through to help text
    printFallbackHelp();
  }
}
