import { ProgressLogger } from 'ropegeo-common/helpers';
import { runLegendContextModel } from './runLegendContextModel';
import { errorToMessage } from '../util/errorToMessage';
import type { LegendItemInput, ModelConfig, ModelRunResult } from '../types/relevanceTypes';

/**
 * Calls runLegendContextModel, retrying on failure up to maxAttempts (inclusive of the first try).
 */
export async function runLegendContextModelWithRetries(
    modelConfig: ModelConfig,
    systemPrompt: string,
    userPrompt: string,
    maxAttempts: number,
    logger: ProgressLogger,
    jobId: string,
    legendItem: LegendItemInput,
): Promise<ModelRunResult> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await runLegendContextModel(modelConfig, systemPrompt, userPrompt);
        } catch (error) {
            lastError = error;
            logger.logError(
                `Relevance job ${jobId}: runLegendContextModel failed for "${legendItem.name}" (${legendItem.id}) attempt ${attempt}/${maxAttempts} — ${errorToMessage(error)}`,
            );
        }
    }
    throw lastError instanceof Error ? lastError : new Error(errorToMessage(lastError));
}
