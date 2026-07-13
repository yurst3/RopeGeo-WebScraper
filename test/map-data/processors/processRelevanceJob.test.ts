import { describe, it, expect, beforeEach, jest } from '@jest/globals';
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
jest.mock('../../../src/map-data/database/setRelevantContextJobError', () => ({
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
const setRelevantContextJobError = require('../../../src/map-data/database/setRelevantContextJobError')
    .default as jest.MockedFunction<
    typeof import('../../../src/map-data/database/setRelevantContextJobError').default
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

    beforeEach(() => {
        jest.clearAllMocks();
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
        validateLegendContext.mockReturnValue({} as any);
        contextToDbJson.mockReturnValue({
            measurements: null,
            betaSectionExcerpts: null,
            images: null,
        });
        upsertRelevantContext.mockResolvedValue(undefined);
        softDeleteRelevantContextNotInLegend.mockResolvedValue(undefined);
        setRelevantContextJobError.mockResolvedValue(undefined);
        deleteRelevantContextJob.mockResolvedValue(undefined);
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

    it('persists errorMessage and keeps the job when the LLM fails', async () => {
        runLegendContextModel.mockRejectedValue(new Error('gateway timeout'));

        const result = await processRelevanceJob(
            mockConn,
            job,
            mockLogger as any,
            () => 900_000,
            900_000,
        );

        expect(result).toEqual({
            status: 'failed',
            errorMessage: 'gateway timeout',
            processedCount: 0,
            skippedCount: 0,
        });
        expect(setRelevantContextJobError).toHaveBeenCalledWith(mockConn, 'job-1', 'gateway timeout');
        expect(deleteRelevantContextJob).not.toHaveBeenCalled();
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
