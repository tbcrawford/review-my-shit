import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import {
  RmsConfigSchema,
  FlatRmsConfigSchema,
  type RmsConfig,
  type AgentModelSpec,
} from './schemas.js';
import { generateText, wrapLanguageModel, defaultSettingsMiddleware } from 'ai';

/**
 * Returns the canonical config file path: ~/.config/rms/config.json
 */
export function getConfigPath(): string {
  return join(homedir(), '.config', 'rms', 'config.json');
}

/**
 * Migrates an old flat config to the new nested shape.
 * Both opencode and cursor sections get the same models from the flat config.
 * Provider is discarded — variant defaults to undefined (best-effort migration).
 */
function migrateFromFlat(flat: { reviewer: { model: string }; validator: { model: string }; writer: { model: string } }): RmsConfig {
  return {
    opencode: {
      reviewer:  { model: flat.reviewer.model },
      validator: { model: flat.validator.model },
      writer:    { model: flat.writer.model },
    },
    cursor: {
      reviewer:  { model: flat.reviewer.model },
      validator: { model: flat.validator.model },
      writer:    { model: flat.writer.model },
    },
  };
}

/**
 * Loads rms config from the given path (defaults to ~/.config/rms/config.json).
 *
 * Returns null if the file does not exist.
 * Migrates old flat config shape (Phase 8 era) to the new nested shape on load.
 * Throws with a clear "Invalid rms config" message on parse or validation failure.
 */
export async function loadRmsConfig(configPath?: string): Promise<RmsConfig | null> {
  const resolvedPath = configPath ?? getConfigPath();

  if (!existsSync(resolvedPath)) return null;

  let raw: string;
  try {
    raw = await readFile(resolvedPath, 'utf8');
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid rms config at ${resolvedPath}: malformed JSON`);
  }

  // Try new nested shape first
  const newResult = RmsConfigSchema.safeParse(parsed);
  if (newResult.success) {
    return newResult.data;
  }

  // Try old flat shape — migrate silently
  const flatResult = FlatRmsConfigSchema.safeParse(parsed);
  if (flatResult.success) {
    return migrateFromFlat(flatResult.data);
  }

  // Neither shape matched
  throw new Error(`Invalid rms config at ${resolvedPath}: ${newResult.error.message}`);
}

/**
 * Saves rms config to the given path (defaults to ~/.config/rms/config.json).
 * Creates parent directories if they do not exist.
 */
export async function saveRmsConfig(config: RmsConfig, configPath?: string): Promise<void> {
  const resolvedPath = configPath ?? getConfigPath();
  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * The default config from Phase 19.
 * OpenCode uses model + variant for thinking control.
 * Cursor uses plain model IDs (thinking intent encoded in name).
 */
export const DEFAULT_RMS_CONFIG: RmsConfig = {
  opencode: {
    reviewer:  { model: 'github-copilot/claude-opus-4.6',  variant: 'high_thinking' },
    validator: { model: 'github-copilot/gpt-5.4',          variant: 'high_thinking' },
    writer:    { model: 'github-copilot/claude-haiku-4.5', variant: 'no_thinking'   },
  },
  cursor: {
    reviewer:  { model: 'claude-4.6-opus-high-thinking' },
    validator: { model: 'gpt-5.4-high'                  },
    writer:    { model: 'gpt-5.4-mini-none'             },
  },
};

/**
 * Creates ~/.config/rms/config.json with DEFAULT_RMS_CONFIG if it does not
 * already exist. Safe to call on every install — never overwrites existing config.
 *
 * @returns 'created' if the file was written, 'exists' if it already existed.
 */
export async function ensureDefaultConfig(configPath?: string): Promise<'created' | 'exists'> {
  const resolvedPath = configPath ?? getConfigPath();
  if (existsSync(resolvedPath)) return 'exists';
  await saveRmsConfig(DEFAULT_RMS_CONFIG, resolvedPath);
  return 'created';
}

/**
 * Resolves a GitHub token for the copilot provider.
 *
 * Priority:
 * 1. GITHUB_TOKEN environment variable (same token used for PR diffs)
 * 2. OpenCode auth.json at ~/.local/share/opencode/auth.json
 *
 * Throws with a clear actionable message if no token is available.
 */
export async function resolveCopilotToken(): Promise<string> {
  // Priority 1: GITHUB_TOKEN env var (same token used for PR diffs)
  if (process.env['GITHUB_TOKEN']) return process.env['GITHUB_TOKEN'];

  // Priority 2: opencode auth.json
  const authPath = join(homedir(), '.local', 'share', 'opencode', 'auth.json');
  try {
    const raw = await readFile(authPath, 'utf8');
    const auth = JSON.parse(raw) as Record<string, unknown>;
    const copilotAuth = auth['github-copilot'] as Record<string, unknown> | undefined;
    const token = copilotAuth?.['access'];
    if (typeof token === 'string' && token.length > 0) return token;
  } catch {
    // File not found or unreadable — fall through to error
  }

  throw new Error(
    '[rms] copilot provider requires a GitHub token.\n' +
    '  Set GITHUB_TOKEN or authenticate with OpenCode (opencode auth login).',
  );
}

/**
 * Resolves a Vercel AI SDK LanguageModel instance from an AgentModelSpec.
 *
 * All models route through the GitHub Copilot provider.
 * When spec.variant is set, providerOptions.thinking is passed to chatModel().
 */
export async function resolveAgentModel(
  spec: AgentModelSpec,
): Promise<Parameters<typeof generateText>[0]['model']> {
  const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
  const token = await resolveCopilotToken();
  const copilot = createOpenAICompatible({
    name: 'github-copilot',
    baseURL: 'https://api.githubcopilot.com',
    apiKey: token,
  });

  const baseModel = copilot.chatModel(spec.model);

  if (spec.variant === 'high_thinking') {
    return wrapLanguageModel({
      model: baseModel,
      middleware: defaultSettingsMiddleware({
        settings: { providerOptions: { thinking: { type: 'enabled', budgetTokens: 10000 } } },
      }),
    });
  }

  if (spec.variant === 'no_thinking') {
    return wrapLanguageModel({
      model: baseModel,
      middleware: defaultSettingsMiddleware({
        settings: { providerOptions: { thinking: { type: 'disabled' } } },
      }),
    });
  }

  return baseModel;
}
