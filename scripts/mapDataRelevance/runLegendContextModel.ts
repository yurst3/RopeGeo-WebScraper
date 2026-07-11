import { createGateway, generateObject, type LanguageModel } from 'ai';
import { legendContextSchema } from './legendContextSchema';
import { estimateCostUsd } from './loadConfig';
import type { ModelConfig, ModelRunResult, TokenUsage } from './types';

let gateway: ReturnType<typeof createGateway> | null = null;

function getGateway(): ReturnType<typeof createGateway> {
    if (gateway == null) {
        const apiKey = process.env.AI_GATEWAY_API_KEY;
        if (apiKey == null || apiKey.trim().length === 0) {
            throw new Error('AI_GATEWAY_API_KEY is required');
        }
        gateway = createGateway({ apiKey });
    }
    return gateway;
}

function resolveLanguageModel(config: ModelConfig): LanguageModel {
    return getGateway()(config.gatewayModel);
}

function normalizeUsage(usage: {
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    totalTokens?: number | undefined;
    promptTokens?: number | undefined;
    completionTokens?: number | undefined;
}): TokenUsage {
    const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
    const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0;
    const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;
    return { inputTokens, outputTokens, totalTokens };
}

export async function runLegendContextModel(
    config: ModelConfig,
    systemPrompt: string,
    userPrompt: string,
): Promise<ModelRunResult> {
    const model = resolveLanguageModel(config);
    const startedAt = Date.now();

    const { object, usage } = await generateObject({
        model,
        schema: legendContextSchema,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0,
    });

    const durationMs = Date.now() - startedAt;
    const normalizedUsage = normalizeUsage(usage);
    const estimatedCostUsd = estimateCostUsd(normalizedUsage, config);

    return {
        response: object,
        usage: normalizedUsage,
        durationMs,
        estimatedCostUsd,
    };
}
