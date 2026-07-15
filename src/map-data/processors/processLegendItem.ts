import type { Queryable } from 'zapatos/db';
import { ProgressLogger } from 'ropegeo-common/helpers';
import { formatPageRelevanceUserPrompt } from '../util/formatPageRelevancePayload';
import { runLegendContextModelWithRetries } from '../http/runLegendContextModelWithRetries';
import { validateLegendContext } from '../util/validateLegendContextResponse';
import { contextToDbJson, hasRelevantContextContent } from '../util/contextToDbJson';
import upsertRelevantContext from '../database/upsertRelevantContext';
import { errorToMessage } from '../util/errorToMessage';
import type {
    LegendItemInput,
    ModelConfig,
    ModelRunResult,
    PageRelevanceInput,
    RelevanceJobError,
} from '../types/relevanceTypes';

export type LegendItemOutcome =
    | { ok: true; result: ModelRunResult }
    | { ok: false; error: RelevanceJobError };

/**
 * Runs the legend-context model for one item (with retries), validates the response,
 * and upserts relevant context when the response is non-empty.
 */
export async function processLegendItem(
    conn: Queryable,
    mapDataId: string,
    jobId: string,
    pageName: string,
    input: PageRelevanceInput,
    legendItem: LegendItemInput,
    modelConfig: ModelConfig,
    systemPrompt: string,
    maxAttempts: number,
    logger: ProgressLogger,
): Promise<LegendItemOutcome> {
    const userPrompt = formatPageRelevanceUserPrompt(input, legendItem);
    try {
        const result = await runLegendContextModelWithRetries(
            modelConfig,
            systemPrompt,
            userPrompt,
            maxAttempts,
            logger,
            jobId,
            legendItem,
        );
        const validated = validateLegendContext(result.response, input);
        if (hasRelevantContextContent(validated)) {
            const dbJson = contextToDbJson(validated);
            await upsertRelevantContext(conn, mapDataId, legendItem.id, jobId, dbJson);
        }
        return { ok: true, result };
    } catch (error) {
        return {
            ok: false,
            error: {
                pageName,
                legendItemId: legendItem.id,
                legendItemName: legendItem.name,
                message: errorToMessage(error),
            },
        };
    }
}
