import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';
import processRelevanceJob from '../../../src/map-data/processors/processRelevanceJob';
import RelevanceJobEvent from '../../../src/map-data/types/relevanceJobEvent';
import type { PageRelevanceInput } from '../../../src/map-data/types/relevanceTypes';

jest.mock('../../../src/map-data/hook-functions/loadRelevanceInput', () => ({
    loadRelevanceInput: jest.fn(),
}));
jest.mock('../../../src/map-data/util/loadRelevanceConfig', () => ({
    loadModelConfigFromEnv: jest.fn(),
    loadSystemPrompt: jest.fn(),
}));
jest.mock('../../../src/map-data/util/formatPageRelevancePayload', () => ({
    formatPageRelevanceUserPrompt: jest.fn(),
}));
jest.mock('../../../src/map-data/http/runLegendContextModel', () => ({
    runLegendContextModel: jest.fn(),
}));
jest.mock('../../../src/map-data/util/validateLegendContextResponse', () => ({
    validateLegendContext: jest.fn(),
}));
jest.mock('../../../src/map-data/util/contextToDbJson', () => ({
    contextToDbJson: jest.fn(),
    hasRelevantContextContent: jest.fn(),
}));
jest.mock('../../../src/map-data/database/upsertRelevantContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/database/softDeleteRelevantContextNotInLegend', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/database/getLegendItemIdsCompletedForJob', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/database/getRelevantContextJobById', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/database/replaceRelevantContextJobErrors', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mock('../../../src/map-data/database/deleteRelevantContextJob', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const loadRelevanceInput = require('../../../src/map-data/hook-functions/loadRelevanceInput')
    .loadRelevanceInput as jest.MockedFunction<
    typeof import('../../../src/map-data/hook-functions/loadRelevanceInput').loadRelevanceInput
>;
const loadModelConfigFromEnv = require('../../../src/map-data/util/loadRelevanceConfig')
    .loadModelConfigFromEnv as jest.MockedFunction<
    typeof import('../../../src/map-data/util/loadRelevanceConfig').loadModelConfigFromEnv
>;
const loadSystemPrompt = require('../../../src/map-data/util/loadRelevanceConfig')
    .loadSystemPrompt as jest.MockedFunction<
    typeof import('../../../src/map-data/util/loadRelevanceConfig').loadSystemPrompt
>;
const formatPageRelevanceUserPrompt = require('../../../src/map-data/util/formatPageRelevancePayload')
    .formatPageRelevanceUserPrompt as jest.MockedFunction<
    typeof import('../../../src/map-data/util/formatPageRelevancePayload').formatPageRelevanceUserPrompt
>;
const runLegendContextModel = require('../../../src/map-data/http/runLegendContextModel')
    .runLegendContextModel as jest.MockedFunction<
    typeof import('../../../src/map-data/http/runLegendContextModel').runLegendContextModel
>;
const validateLegendContext = require('../../../src/map-data/util/validateLegendContextResponse')
    .validateLegendContext as jest.MockedFunction<
    typeof import('../../../src/map-data/util/validateLegendContextResponse').validateLegendContext
>;
const contextToDbJson = require('../../../src/map-data/util/contextToDbJson')
    .contextToDbJson as jest.MockedFunction<
    typeof import('../../../src/map-data/util/contextToDbJson').contextToDbJson
>;
const hasRelevantContextContent = require('../../../src/map-data/util/contextToDbJson')
    .hasRelevantContextContent as jest.MockedFunction<
    typeof import('../../../src/map-data/util/contextToDbJson').hasRelevantContextContent
>;
const upsertRelevantContext = require('../../../src/map-data/database/upsertRelevantContext')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/database/upsertRelevantContext').default
>;
const softDeleteRelevantContextNotInLegend =
    require('../../../src/map-data/database/softDeleteRelevantContextNotInLegend')
        .default as jest.MockedFunction<
        typeof import('../../../src/map-data/database/softDeleteRelevantContextNotInLegend').default
    >;
const getLegendItemIdsCompletedForJob =
    require('../../../src/map-data/database/getLegendItemIdsCompletedForJob')
        .default as jest.MockedFunction<
        typeof import('../../../src/map-data/database/getLegendItemIdsCompletedForJob').default
    >;
const getRelevantContextJobById = require('../../../src/map-data/database/getRelevantContextJobById')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/database/getRelevantContextJobById').default
>;
const replaceRelevantContextJobErrors =
    require('../../../src/map-data/database/replaceRelevantContextJobErrors')
        .default as jest.MockedFunction<
        typeof import('../../../src/map-data/database/replaceRelevantContextJobErrors').default
    >;
const deleteRelevantContextJob = require('../../../src/map-data/database/deleteRelevantContextJob')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/database/deleteRelevantContextJob').default
>;

describe('processRelevanceJob', () => {
    const job = new RelevanceJobEvent(
        'job-1',
        'map-1',
        'page-1',
        PageDataSource.Ropewiki,
    );
    const mockConn = {} as any;
    const mockLogger = {
        logProgress: jest.fn(),
        logError: jest.fn(),
    };

    const baseInput: PageRelevanceInput = {
        page: { id: 'page-1', name: 'Test', url: 'https://example.com' },
        mapDataId: 'map-1',
        legendItems: [
            { id: 'a', featureType: 'point', name: 'A' },
            { id: 'b', featureType: 'point', name: 'B' },
            { id: 'c', featureType: 'point', name: 'C' },
        ],
        betaSections: [],
        images: [],
        pageStats: {},
    };

    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv, MAP_DATA_RELEVANCE_MODEL_MAX_ATTEMPTS: '3' };
        getRelevantContextJobById.mockResolvedValue({ id: 'job-1' } as any);
        loadRelevanceInput.mockResolvedValue(baseInput);
        getLegendItemIdsCompletedForJob.mockResolvedValue(new Set());
        loadModelConfigFromEnv.mockReturnValue({
            gatewayModel: 'test-model',
            inputPricePerMillion: 1,
            outputPricePerMillion: 1,
        });
        loadSystemPrompt.mockReturnValue('system');
        formatPageRelevanceUserPrompt.mockReturnValue('user');
        runLegendContextModel.mockResolvedValue({
            response: {},
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            durationMs: 10,
            estimatedCostUsd: 0.001,
        } as any);
        validateLegendContext.mockReturnValue({
            measurements: [{ label: 'approachLength', value: 1, unitName: 'miles', confidence: 1 }],
        } as any);
        hasRelevantContextContent.mockReturnValue(true);
        contextToDbJson.mockReturnValue({
            measurements: [{ label: 'approachLength' }],
            betaSectionExcerpts: null,
            images: null,
        });
        upsertRelevantContext.mockResolvedValue(undefined);
        softDeleteRelevantContextNotInLegend.mockResolvedValue(undefined);
        replaceRelevantContextJobErrors.mockResolvedValue(undefined);
        deleteRelevantContextJob.mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns complete and deletes job when all items finish', async () => {
        const result = await processRelevanceJob(
            mockConn,
            job,
            mockLogger as any,
            () => 900_000,
            900_000,
        );

        expect(result).toEqual({ status: 'complete', processedCount: 3, skippedCount: 0 });
        expect(upsertRelevantContext).toHaveBeenCalledTimes(3);
        expect(upsertRelevantContext).toHaveBeenCalledWith(
            mockConn,
            'map-1',
            'a',
            'job-1',
            expect.any(Object),
        );
        expect(softDeleteRelevantContextNotInLegend).toHaveBeenCalledWith(
            mockConn,
            'map-1',
            'job-1',
            ['a', 'b', 'c'],
        );
        expect(deleteRelevantContextJob).toHaveBeenCalledWith(mockConn, 'job-1');
    });

    it('skips legend items already checkpointed for this job', async () => {
        getLegendItemIdsCompletedForJob.mockResolvedValue(new Set(['a', 'b']));

        const result = await processRelevanceJob(
            mockConn,
            job,
            mockLogger as any,
            () => 900_000,
            900_000,
        );

        expect(result).toEqual({ status: 'complete', processedCount: 1, skippedCount: 2 });
        expect(upsertRelevantContext).toHaveBeenCalledTimes(1);
        expect(upsertRelevantContext).toHaveBeenCalledWith(
            mockConn,
            'map-1',
            'c',
            'job-1',
            expect.any(Object),
        );
    });

    it('returns partial without deleting job when time is insufficient', async () => {
        const result = await processRelevanceJob(
            mockConn,
            job,
            mockLogger as any,
            () => 1_000,
            900_000,
        );

        expect(result).toEqual({
            status: 'partial',
            processedCount: 0,
            skippedCount: 0,
            remainingCount: 3,
        });
        expect(upsertRelevantContext).not.toHaveBeenCalled();
        expect(deleteRelevantContextJob).not.toHaveBeenCalled();
        expect(softDeleteRelevantContextNotInLegend).not.toHaveBeenCalled();
    });

    it('finalizes when all items were already checkpointed', async () => {
        getLegendItemIdsCompletedForJob.mockResolvedValue(new Set(['a', 'b', 'c']));

        const result = await processRelevanceJob(
            mockConn,
            job,
            mockLogger as any,
            () => 900_000,
            900_000,
        );

        expect(result).toEqual({ status: 'complete', processedCount: 0, skippedCount: 3 });
        expect(runLegendContextModel).not.toHaveBeenCalled();
        expect(deleteRelevantContextJob).toHaveBeenCalledWith(mockConn, 'job-1');
    });

    it('returns missing_job when the job row is gone', async () => {
        getRelevantContextJobById.mockResolvedValue(undefined);

        const result = await processRelevanceJob(
            mockConn,
            job,
            mockLogger as any,
            () => 900_000,
            900_000,
        );

        expect(result).toEqual({ status: 'missing_job' });
        expect(loadRelevanceInput).not.toHaveBeenCalled();
        expect(deleteRelevantContextJob).not.toHaveBeenCalled();
        expect(mockLogger.logError).toHaveBeenCalled();
    });

    it('retries model calls, continues on failure, and persists errors without deleting the job', async () => {
        formatPageRelevanceUserPrompt.mockImplementation((_input, item) => item.id);
        const attemptsByLegendId = new Map<string, number>();
        runLegendContextModel.mockImplementation(async (_config, _system, userPrompt) => {
            const legendId = String(userPrompt);
            const attempt = (attemptsByLegendId.get(legendId) ?? 0) + 1;
            attemptsByLegendId.set(legendId, attempt);
            if (legendId === 'a') {
                throw new Error('gateway timeout');
            }
            return {
                response: {},
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                durationMs: 10,
                estimatedCostUsd: 0.001,
            } as any;
        });

        const result = await processRelevanceJob(
            mockConn,
            job,
            mockLogger as any,
            () => 900_000,
            900_000,
        );

        expect(result.status).toBe('failed');
        if (result.status !== 'failed') return;
        expect(result.processedCount).toBe(2);
        expect(result.skippedCount).toBe(0);
        expect(result.errors).toEqual([
            {
                legendItemId: 'a',
                input: 'a',
                errorMessage: 'gateway timeout',
            },
        ]);
        expect(attemptsByLegendId.get('a')).toBe(3);
        expect(attemptsByLegendId.get('b')).toBe(1);
        expect(attemptsByLegendId.get('c')).toBe(1);
        expect(replaceRelevantContextJobErrors).toHaveBeenCalledWith(mockConn, 'job-1', result.errors);
        expect(deleteRelevantContextJob).not.toHaveBeenCalled();
        expect(upsertRelevantContext).toHaveBeenCalledTimes(2);
    });

    it('retries a transient model failure and succeeds within max attempts', async () => {
        loadRelevanceInput.mockResolvedValue({
            ...baseInput,
            legendItems: [{ id: 'a', featureType: 'point', name: 'A' }],
        });
        let attempts = 0;
        runLegendContextModel.mockImplementation(async () => {
            attempts += 1;
            if (attempts < 3) {
                throw new Error('transient');
            }
            return {
                response: {},
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                durationMs: 10,
                estimatedCostUsd: 0.001,
            } as any;
        });

        const result = await processRelevanceJob(
            mockConn,
            job,
            mockLogger as any,
            () => 900_000,
            900_000,
        );

        expect(result).toEqual({ status: 'complete', processedCount: 1, skippedCount: 0 });
        expect(attempts).toBe(3);
        expect(replaceRelevantContextJobErrors).not.toHaveBeenCalled();
        expect(deleteRelevantContextJob).toHaveBeenCalledWith(mockConn, 'job-1');
    });

    it('does not upsert when the response has no relevant context content', async () => {
        hasRelevantContextContent.mockReturnValue(false);

        const result = await processRelevanceJob(
            mockConn,
            job,
            mockLogger as any,
            () => 900_000,
            900_000,
        );

        expect(result).toEqual({ status: 'complete', processedCount: 3, skippedCount: 0 });
        expect(upsertRelevantContext).not.toHaveBeenCalled();
        expect(deleteRelevantContextJob).toHaveBeenCalledWith(mockConn, 'job-1');
    });

    it('soft-deletes all context and deletes the job when there are no legend items', async () => {
        loadRelevanceInput.mockResolvedValue({
            ...baseInput,
            legendItems: [],
        });

        const result = await processRelevanceJob(
            mockConn,
            job,
            mockLogger as any,
            () => 900_000,
            900_000,
        );

        expect(result).toEqual({ status: 'complete', processedCount: 0, skippedCount: 0 });
        expect(softDeleteRelevantContextNotInLegend).toHaveBeenCalledWith(
            mockConn,
            'map-1',
            'job-1',
            [],
        );
        expect(deleteRelevantContextJob).toHaveBeenCalledWith(mockConn, 'job-1');
        expect(runLegendContextModel).not.toHaveBeenCalled();
    });
});
