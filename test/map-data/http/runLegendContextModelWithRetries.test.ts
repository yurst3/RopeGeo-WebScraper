import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { LegendItemInput, ModelConfig, ModelRunResult } from '../../../src/map-data/types/relevanceTypes';

jest.mock('../../../src/map-data/http/runLegendContextModel', () => ({
    runLegendContextModel: jest.fn(),
}));

const runLegendContextModel = require('../../../src/map-data/http/runLegendContextModel')
    .runLegendContextModel as jest.MockedFunction<
    typeof import('../../../src/map-data/http/runLegendContextModel').runLegendContextModel
>;
const { runLegendContextModelWithRetries } = require('../../../src/map-data/http/runLegendContextModelWithRetries') as typeof import('../../../src/map-data/http/runLegendContextModelWithRetries');

describe('runLegendContextModelWithRetries', () => {
    const modelConfig: ModelConfig = {
        gatewayModel: 'test-model',
        inputPricePerMillion: 1,
        outputPricePerMillion: 1,
    };
    const legendItem: LegendItemInput = {
        id: 'li-1',
        featureType: 'point',
        name: 'Point A',
    };
    const success: ModelRunResult = {
        response: { measurements: null, betaSectionExcerpts: null, images: null },
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        durationMs: 10,
        estimatedCostUsd: 0.001,
    };
    const logger = {
        logError: jest.fn(),
        logProgress: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns on the first successful attempt', async () => {
        runLegendContextModel.mockResolvedValue(success);

        await expect(
            runLegendContextModelWithRetries(
                modelConfig,
                'system',
                'user',
                3,
                logger as any,
                'job-1',
                legendItem,
            ),
        ).resolves.toEqual(success);

        expect(runLegendContextModel).toHaveBeenCalledTimes(1);
        expect(logger.logError).not.toHaveBeenCalled();
    });

    it('retries after failures and returns when a later attempt succeeds', async () => {
        runLegendContextModel
            .mockRejectedValueOnce(new Error('transient'))
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValue(success);

        await expect(
            runLegendContextModelWithRetries(
                modelConfig,
                'system',
                'user',
                3,
                logger as any,
                'job-1',
                legendItem,
            ),
        ).resolves.toEqual(success);

        expect(runLegendContextModel).toHaveBeenCalledTimes(3);
        expect(logger.logError).toHaveBeenCalledTimes(2);
    });

    it('throws the last error after exhausting maxAttempts', async () => {
        runLegendContextModel.mockRejectedValue(new Error('gateway timeout'));

        await expect(
            runLegendContextModelWithRetries(
                modelConfig,
                'system',
                'user',
                3,
                logger as any,
                'job-1',
                legendItem,
            ),
        ).rejects.toThrow('gateway timeout');

        expect(runLegendContextModel).toHaveBeenCalledTimes(3);
        expect(logger.logError).toHaveBeenCalledTimes(3);
        expect(logger.logError).toHaveBeenCalledWith(
            expect.stringContaining('attempt 3/3'),
        );
    });
});
