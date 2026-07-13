import type { Queryable } from 'zapatos/db';
import { ProgressLogger } from 'ropegeo-common/helpers';
import { loadModelConfigFromEnv, loadSystemPrompt } from '../util/loadRelevanceConfig';
import { formatPageRelevanceUserPrompt } from '../util/formatPageRelevancePayload';
import { runLegendContextModel } from '../http/runLegendContextModel';
import { validateLegendContext } from '../util/validateLegendContextResponse';
import { contextToDbJson } from '../util/contextToDbJson';
import { loadRelevanceInput } from '../hook-functions/loadRelevanceInput';
import upsertRelevantContext from '../database/upsertRelevantContext';
import softDeleteRelevantContextNotInLegend from '../database/softDeleteRelevantContextNotInLegend';
import getLegendItemIdsCompletedForJob from '../database/getLegendItemIdsCompletedForJob';
import getRelevantContextJobById from '../database/getRelevantContextJobById';
import setRelevantContextJobError from '../database/setRelevantContextJobError';
import deleteRelevantContextJob from '../database/deleteRelevantContextJob';
import type { RelevanceJobEvent } from '../types/relevanceJobEvent';
import type { RelevanceJobResult, TokenUsage } from '../types/relevanceTypes';

const LEGEND_ITEM_BATCH_SIZE = 5;

function addUsage(total: TokenUsage, next: TokenUsage): TokenUsage {
    return {
        inputTokens: total.inputTokens + next.inputTokens,
        outputTokens: total.outputTokens + next.outputTokens,
        totalTokens: total.totalTokens + next.totalTokens,
    };
}

function errorToMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Runs one MapData relevance job: for each legend item, ask the LLM which page
 * measurements / beta excerpts / images are relevant, then persist the result.
 *
 * High-level flow:
 * 1. Confirm the job row still exists; if not, return `missing_job` (caller deletes SQS message).
 * 2. Load page + map input for the job.
 * 3. Skip legend items already checkpointed for this job (`MapDataRelevantContext.jobId`).
 * 4. Process remaining items in small parallel batches, upserting each result with `jobId`.
 * 5. If Lambda time is too low to start another batch, return `partial` so the SQS
 *    handler can requeue (visibility 0) and a later invoke can resume from checkpoints.
 * 6. On LLM / processing failure, write `errorMessage` on the job (keep the row) and return `failed`
 *    so the SQS handler can defer the message (long visibility timeout) for a later retry.
 * 7. On full success (or nothing left to do), soft-delete stale context rows, delete
 *    the job row, and return `complete`.
 */
const processRelevanceJob = async (
    conn: Queryable,
    job: RelevanceJobEvent,
    logger: ProgressLogger,
    getRemainingTimeInMillis: () => number,
    lambdaTimeoutMs: number,
): Promise<RelevanceJobResult> => {
    const existingJob = await getRelevantContextJobById(conn, job.id);
    if (existingJob == null) {
        logger.logError(
            `MapDataRelevantContextJob ${job.id} not found for page ${job.pageId}; dropping SQS message`,
        );
        return { status: 'missing_job' };
    }

    const input = await loadRelevanceInput(conn, job.pageId, job.pageSource);

    if (input.mapDataId == null) {
        throw new Error(`No mapDataId resolved for page ${job.pageId}`);
    }

    if (input.mapDataId !== job.mapDataId) {
        console.warn(
            `processRelevanceJob: job mapDataId ${job.mapDataId} differs from resolved ${input.mapDataId}; using job value`,
        );
    }

    const mapDataId = job.mapDataId;

    if (input.legendItems.length === 0) {
        logger.logProgress(`No legend items for page ${job.pageId}; deleting job without LLM calls`);
        await softDeleteRelevantContextNotInLegend(conn, mapDataId, job.id, []);
        await deleteRelevantContextJob(conn, job.id);
        return { status: 'complete', processedCount: 0, skippedCount: 0 };
    }

    const completedIds = await getLegendItemIdsCompletedForJob(conn, mapDataId, job.id);
    const pendingItems = input.legendItems.filter((item) => !completedIds.has(item.id));
    const skippedCount = input.legendItems.length - pendingItems.length;

    if (pendingItems.length === 0) {
        logger.logProgress(
            `Relevance job ${job.id}: all ${input.legendItems.length} legend items already checkpointed; finalizing`,
        );
        await softDeleteRelevantContextNotInLegend(
            conn,
            mapDataId,
            job.id,
            input.legendItems.map((item) => item.id),
        );
        await deleteRelevantContextJob(conn, job.id);
        return { status: 'complete', processedCount: 0, skippedCount };
    }

    const modelConfig = loadModelConfigFromEnv();
    const systemPrompt = loadSystemPrompt();

    const perItemBudgetMs = Math.max(
        30_000,
        Math.floor(lambdaTimeoutMs / Math.max(pendingItems.length, 1)),
    );

    let totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let totalCostUsd = 0;
    let processedCount = 0;
    const startedAt = Date.now();

    for (let i = 0; i < pendingItems.length; i += LEGEND_ITEM_BATCH_SIZE) {
        const remainingMs = getRemainingTimeInMillis();
        if (remainingMs < perItemBudgetMs) {
            const remainingCount = pendingItems.length - processedCount;
            logger.logProgress(
                `Relevance job ${job.id}: partial — ${processedCount} processed this invoke, ${skippedCount} skipped, ${remainingCount} remaining (${remainingMs}ms left, need ~${perItemBudgetMs}ms)`,
            );
            return {
                status: 'partial',
                processedCount,
                skippedCount,
                remainingCount,
            };
        }

        const batch = pendingItems.slice(i, i + LEGEND_ITEM_BATCH_SIZE);
        try {
            const batchOutcomes = await Promise.all(
                batch.map(async (legendItem) => {
                    const userPrompt = formatPageRelevanceUserPrompt(input, legendItem);
                    const result = await runLegendContextModel(modelConfig, systemPrompt, userPrompt);
                    const validated = validateLegendContext(result.response, input);
                    const dbJson = contextToDbJson(validated);
                    await upsertRelevantContext(conn, mapDataId, legendItem.id, job.id, dbJson);
                    return result;
                }),
            );

            processedCount += batch.length;
            for (const outcome of batchOutcomes) {
                totalUsage = addUsage(totalUsage, outcome.usage);
                totalCostUsd += outcome.estimatedCostUsd;
            }
        } catch (error) {
            const errorMessage = errorToMessage(error);
            await setRelevantContextJobError(conn, job.id, errorMessage);
            logger.logError(
                `Relevance job ${job.id}: failed after ${processedCount} processed this invoke — ${errorMessage}`,
            );
            return {
                status: 'failed',
                errorMessage,
                processedCount,
                skippedCount,
            };
        }
    }

    await softDeleteRelevantContextNotInLegend(
        conn,
        mapDataId,
        job.id,
        input.legendItems.map((item) => item.id),
    );
    await deleteRelevantContextJob(conn, job.id);

    const durationMs = Date.now() - startedAt;
    logger.logProgress(
        `Relevance job ${job.id}: complete — ${processedCount} processed, ${skippedCount} skipped, ${durationMs} ms, ${totalUsage.totalTokens} tokens, $${totalCostUsd.toFixed(6)}`,
    );

    return { status: 'complete', processedCount, skippedCount };
};

export default processRelevanceJob;
