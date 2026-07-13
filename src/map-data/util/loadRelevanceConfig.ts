import { readFileSync } from 'fs';
import { join } from 'path';
import type { ModelConfig } from '../types/relevanceTypes';

const CONFIG_DIR = join(__dirname, '..', 'configs');

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

export function loadSystemPrompt(promptPath?: string): string {
    const path = promptPath ?? join(CONFIG_DIR, 'legendContextModelSystemPrompt.txt');
    return readFileSync(path, 'utf-8').trim();
}

export function estimateCostUsd(
    usage: { inputTokens: number; outputTokens: number },
    config: ModelConfig,
): number {
    const inputCost = (usage.inputTokens / 1_000_000) * config.inputPricePerMillion;
    const outputCost = (usage.outputTokens / 1_000_000) * config.outputPricePerMillion;
    return inputCost + outputCost;
}
