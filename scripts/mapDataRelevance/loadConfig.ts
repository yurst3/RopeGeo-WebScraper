import { readFileSync } from 'fs';
import { join } from 'path';
import type { ModelConfig, ModelConfigsFile } from './types';

const CONFIG_DIR = __dirname;

export function loadModelConfigs(configPath?: string): ModelConfigsFile {
    const path = configPath ?? join(CONFIG_DIR, 'modelConfigs.json');
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as ModelConfigsFile;
}

export function loadSystemPrompt(promptPath?: string): string {
    const path = promptPath ?? join(CONFIG_DIR, 'systemPrompt.txt');
    return readFileSync(path, 'utf-8').trim();
}

export function resolveModelConfig(
    configs: ModelConfigsFile,
    modelKey?: string,
): { key: string; config: ModelConfig } {
    const key = modelKey ?? configs.defaultModel;
    const config = configs.models[key];
    if (config == null) {
        const available = Object.keys(configs.models).join(', ');
        throw new Error(`Unknown model key "${key}". Available: ${available}`);
    }
    return { key, config };
}

export function estimateCostUsd(
    usage: { inputTokens: number; outputTokens: number },
    config: ModelConfig,
): number {
    const inputCost = (usage.inputTokens / 1_000_000) * config.inputPricePerMillion;
    const outputCost = (usage.outputTokens / 1_000_000) * config.outputPricePerMillion;
    return inputCost + outputCost;
}
