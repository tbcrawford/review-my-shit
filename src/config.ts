import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { RmsConfigSchema, type RmsConfig, type AgentModelSpec } from './schemas.js';
import { generateText } from 'ai';

/**
 * Returns the canonical config file path: ~/.config/rms/config.json
 */
export function getConfigPath(): string {
  return join(homedir(), '.config', 'rms', 'config.json');
}

/**
 * Loads rms config from the given path (defaults to ~/.config/rms/config.json).
 *
 * Returns null if the file does not exist — callers should fall back to env vars.
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

  const result = RmsConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid rms config at ${resolvedPath}: ${result.error.message}`);
  }

  return result.data;
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
 * Mirrors the provider-switching logic in index.ts resolveModel(), but takes
 * an explicit spec rather than reading from environment variables.
 */
export async function resolveAgentModel(
  spec: AgentModelSpec,
): Promise<Parameters<typeof generateText>[0]['model']> {
  if (spec.provider === 'copilot') {
    const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
    const token = await resolveCopilotToken();
    const copilot = createOpenAICompatible({
      name: 'github-copilot',
      baseURL: 'https://api.githubcopilot.com',
      apiKey: token,
    });
    return copilot.chatModel(spec.model);
  } else if (spec.provider === 'anthropic') {
    const { anthropic } = await import('@ai-sdk/anthropic');
    return anthropic(spec.model);
  } else if (spec.provider === 'google') {
    const { google } = await import('@ai-sdk/google');
    return google(spec.model);
  } else {
    const { openai } = await import('@ai-sdk/openai');
    return openai(spec.model);
  }
}
