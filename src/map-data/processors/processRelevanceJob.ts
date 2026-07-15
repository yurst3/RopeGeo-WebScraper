import type { Queryable } from 'zapatos/db';
import { ProgressLogger } from 'ropegeo-common/helpers';
import { loadModelConfigFromEnv, loadSystemPrompt } from '../util/loadRelevanceConfig';
import { addUsage } from '../util/addUsage';
import { loadRelevanceInput } from '../hook-functions/loadRelevanceInput';
import softDeleteRelevantContextNotInLegend from '../database/softDeleteRelevantContextNotInLegend';
import getLegendItemIdsCompletedForJob from '../database/getLegendItemIdsCompletedForJob';
import getRelevantContextJobById from '../database/getRelevantContextJobById';
import getPageName from '../database/getPageName';
import setRelevantContextJobErrors from '../database/setRelevantContextJobErrors';
import deleteRelevantContextJob from '../database/deleteRelevantContextJob';
import { getRelevanceModelMaxAttempts } from '../util/getRelevanceModelMaxAttempts';
import { processLegendItem } from './processLegendItem';
import type { RelevanceJobEvent } from '../types/relevanceJobEvent';
import type { RelevanceJobError, RelevanceJobResult, TokenUsage } from '../types/relevanceTypes';

const LEGEND_ITEM_BATCH_SIZE = 5;

/**
 * Runs one MapData relevance job: for each legend item, ask the LLM which page
 * measurements / beta excerpts / images are relevant, then persist the result.
 *
 * High-level flow:
 * 1. Confirm the job row still exists; if not, return `missing_job` (caller deletes SQS message).
 * 2. Load page + map input for the job.
 * 3. Skip legend items already checkpointed for this job (`MapDataRelevantContext.jobId`).
 * 4. Process remaining items in small parallel batches. Each item retries the model up to
 *    MAP_DATA_RELEVANCE_MODEL_MAX_ATTEMPTS; failures are collected and processing continues.
 *    Empty contexts (no measurements, beta excerpts, or images) are not upserted.
 * 5. If Lambda time is too low to start another batch, persist any errors so far and return
 *    `partial` so the SQS handler can requeue (visibility 0).
 * 6. After all pending items: soft-delete stale context. If any item failed, write `errors`
 *    on the job (keep the row) and return `failed`. Otherwise delete the job and return `complete`.
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
    const maxAttempts = getRelevanceModelMaxAttempts();
    const pageName =
        (await getPageName(conn, job.pageId, job.pageSource)) ?? input.page.name;

    const perItemBudgetMs = Math.max(
        30_000,
        Math.floor(lambdaTimeoutMs / Math.max(pendingItems.length, 1)),
    );

    let totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let totalCostUsd = 0;
    let processedCount = 0;
    const jobErrors: RelevanceJobError[] = [];
    const startedAt = Date.now();

    for (let i = 0; i < pendingItems.length; i += LEGEND_ITEM_BATCH_SIZE) {
        const remainingMs = getRemainingTimeInMillis();
        if (remainingMs < perItemBudgetMs) {
            const remainingCount = pendingItems.length - processedCount - jobErrors.length;
            logger.logProgress(
                `Relevance job ${job.id}: partial — ${processedCount} processed this invoke, ${skippedCount} skipped, ${jobErrors.length} errors, ${remainingCount} remaining (${remainingMs}ms left, need ~${perItemBudgetMs}ms)`,
            );
            if (jobErrors.length > 0) {
                await setRelevantContextJobErrors(conn, job.id, jobErrors);
            }
            return {
                status: 'partial',
                processedCount,
                skippedCount,
                remainingCount,
            };
        }

        const batch = pendingItems.slice(i, i + LEGEND_ITEM_BATCH_SIZE);
        const batchOutcomes = await Promise.all(
            batch.map((legendItem) =>
                processLegendItem(
                    conn,
                    mapDataId,
                    job.id,
                    pageName,
                    input,
                    legendItem,
                    modelConfig,
                    systemPrompt,
                    maxAttempts,
                    logger,
                ),
            ),
        );

        for (const outcome of batchOutcomes) {
            if (outcome.ok) {
                processedCount += 1;
                totalUsage = addUsage(totalUsage, outcome.result.usage);
                totalCostUsd += outcome.result.estimatedCostUsd;
            } else {
                jobErrors.push(outcome.error);
                logger.logError(
                    `Relevance job ${job.id}: recording error for "${outcome.error.legendItemName}" — ${outcome.error.message}`,
                );
            }
        }
    }

    await softDeleteRelevantContextNotInLegend(
        conn,
        mapDataId,
        job.id,
        input.legendItems.map((item) => item.id),
    );

    const durationMs = Date.now() - startedAt;

    if (jobErrors.length > 0) {
        await setRelevantContextJobErrors(conn, job.id, jobErrors);
        logger.logError(
            `Relevance job ${job.id}: finished with ${jobErrors.length} error(s) — ${processedCount} processed, ${skippedCount} skipped, ${durationMs} ms, ${totalUsage.totalTokens} tokens, $${totalCostUsd.toFixed(6)}`,
        );
        return {
            status: 'failed',
            errors: jobErrors,
            processedCount,
            skippedCount,
        };
    }

    await deleteRelevantContextJob(conn, job.id);

    logger.logProgress(
        `Relevance job ${job.id}: complete — ${processedCount} processed, ${skippedCount} skipped, ${durationMs} ms, ${totalUsage.totalTokens} tokens, $${totalCostUsd.toFixed(6)}`,
    );

    return { status: 'complete', processedCount, skippedCount };
};

export default processRelevanceJob;
