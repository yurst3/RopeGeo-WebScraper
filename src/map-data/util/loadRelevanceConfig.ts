import { readFileSync } from 'fs';
import { join } from 'path';
import type { ModelConfig } from '../types/relevanceTypes';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (value == null || value.trim().length === 0) {
        throw new Error(`${name} environment variable is required`);
    }
    return value.trim();
}

function requirePositiveNumberEnv(name: string): number {
    const raw = requireEnv(name);
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${name} must be a non-negative number, got: ${JSON.stringify(raw)}`);
    }
    return value;
}

/**
 * Default prompt from legendContextModelSystemPrompt.txt.
 * SAM esbuild inlines this require when Loader includes `.txt=text`.
 * Local ts-node without a .txt hook falls back to reading the file from disk.
 */
function loadDefaultSystemPrompt(): string {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const bundled = require('../configs/legendContextModelSystemPrompt.txt') as
            | string
            | { default: string };
        const text = typeof bundled === 'string' ? bundled : bundled.default;
        if (typeof text === 'string' && text.trim().length > 0) {
            return text.trim();
        }
    } catch {
        // Node/ts-node without a .txt require hook (or empty export)
    }

    return readFileSync(
        join(__dirname, '..', 'configs', 'legendContextModelSystemPrompt.txt'),
        'utf-8',
    ).trim();
}

/**
 * Loads model pricing/gateway settings from environment variables.
 * Requires MAP_DATA_RELEVANCE_GATEWAY_MODEL, MAP_DATA_RELEVANCE_INPUT_PRICE_PER_MILLION,
 * and MAP_DATA_RELEVANCE_OUTPUT_PRICE_PER_MILLION.
 */
export function loadModelConfigFromEnv(): ModelConfig {
    return {
        gatewayModel: requireEnv('MAP_DATA_RELEVANCE_GATEWAY_MODEL'),
        inputPricePerMillion: requirePositiveNumberEnv('MAP_DATA_RELEVANCE_INPUT_PRICE_PER_MILLION'),
        outputPricePerMillion: requirePositiveNumberEnv('MAP_DATA_RELEVANCE_OUTPUT_PRICE_PER_MILLION'),
    };
}

/**
 * Loads the legend-context system prompt.
 * Default content comes from legendContextModelSystemPrompt.txt (inlined by SAM esbuild Loader).
 * Optional `promptPath` overrides from disk (local scripts).
 */
export function loadSystemPrompt(promptPath?: string): string {
    if (promptPath != null && promptPath.trim() !== '') {
        return readFileSync(promptPath, 'utf-8').trim();
    }
    return loadDefaultSystemPrompt();
}

export function estimateCostUsd(
    usage: { inputTokens: number; outputTokens: number },
    config: ModelConfig,
): number {
    const inputCost = (usage.inputTokens / 1_000_000) * config.inputPricePerMillion;
    const outputCost = (usage.outputTokens / 1_000_000) * config.outputPricePerMillion;
    return inputCost + outputCost;
}
