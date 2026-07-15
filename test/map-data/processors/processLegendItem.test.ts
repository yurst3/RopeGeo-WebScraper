import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { LegendItemInput, ModelConfig, PageRelevanceInput } from '../../../src/map-data/types/relevanceTypes';

jest.mock('../../../src/map-data/util/formatPageRelevancePayload', () => ({
    formatPageRelevanceUserPrompt: jest.fn(),
}));
jest.mock('../../../src/map-data/http/runLegendContextModelWithRetries', () => ({
    runLegendContextModelWithRetries: jest.fn(),
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

const formatPageRelevanceUserPrompt = require('../../../src/map-data/util/formatPageRelevancePayload')
    .formatPageRelevanceUserPrompt as jest.MockedFunction<
    typeof import('../../../src/map-data/util/formatPageRelevancePayload').formatPageRelevanceUserPrompt
>;
const runLegendContextModelWithRetries =
    require('../../../src/map-data/http/runLegendContextModelWithRetries')
        .runLegendContextModelWithRetries as jest.MockedFunction<
        typeof import('../../../src/map-data/http/runLegendContextModelWithRetries').runLegendContextModelWithRetries
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
const { processLegendItem } = require('../../../src/map-data/processors/processLegendItem') as typeof import('../../../src/map-data/processors/processLegendItem');

describe('processLegendItem', () => {
    const mockConn = {} as any;
    const logger = {
        logError: jest.fn(),
        logProgress: jest.fn(),
    };
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
    const input: PageRelevanceInput = {
        page: { id: 'page-1', name: 'Test Page', url: 'https://example.com' },
        mapDataId: 'map-1',
        legendItems: [legendItem],
        betaSections: [],
        images: [],
        pageStats: {},
    };
    const modelResult = {
        response: { measurements: null, betaSectionExcerpts: null, images: null },
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        durationMs: 10,
        estimatedCostUsd: 0.001,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        formatPageRelevanceUserPrompt.mockReturnValue('user-prompt');
        runLegendContextModelWithRetries.mockResolvedValue(modelResult as any);
        validateLegendContext.mockReturnValue({
            measurements: [{ label: 'approachLength', value: 1, unitName: 'miles', confidence: 1 }],
            betaSectionExcerpts: null,
            images: null,
        } as any);
        hasRelevantContextContent.mockReturnValue(true);
        contextToDbJson.mockReturnValue({
            measurements: [{ label: 'approachLength' }],
            betaSectionExcerpts: null,
            images: null,
        });
        upsertRelevantContext.mockResolvedValue(undefined);
    });

    it('upserts relevant context when the model response has content', async () => {
        const outcome = await processLegendItem(
            mockConn,
            'map-1',
            'job-1',
            'Test Page',
            input,
            legendItem,
            modelConfig,
            'system',
            3,
            logger as any,
        );

        expect(outcome).toEqual({ ok: true, result: modelResult });
        expect(runLegendContextModelWithRetries).toHaveBeenCalledWith(
            modelConfig,
            'system',
            'user-prompt',
            3,
            logger,
            'job-1',
            legendItem,
        );
        expect(upsertRelevantContext).toHaveBeenCalledWith(
            mockConn,
            'map-1',
            'li-1',
            'job-1',
            expect.objectContaining({ measurements: expect.any(Array) }),
        );
    });

    it('does not upsert when the response has no relevant content', async () => {
        hasRelevantContextContent.mockReturnValue(false);

        const outcome = await processLegendItem(
            mockConn,
            'map-1',
            'job-1',
            'Test Page',
            input,
            legendItem,
            modelConfig,
            'system',
            3,
            logger as any,
        );

        expect(outcome).toEqual({ ok: true, result: modelResult });
        expect(upsertRelevantContext).not.toHaveBeenCalled();
        expect(contextToDbJson).not.toHaveBeenCalled();
    });

    it('returns a RelevanceJobError when the model call fails', async () => {
        runLegendContextModelWithRetries.mockRejectedValue(new Error('gateway timeout'));

        const outcome = await processLegendItem(
            mockConn,
            'map-1',
            'job-1',
            'Test Page',
            input,
            legendItem,
            modelConfig,
            'system',
            3,
            logger as any,
        );

        expect(outcome).toEqual({
            ok: false,
            error: {
                pageName: 'Test Page',
                legendItemId: 'li-1',
                legendItemName: 'Point A',
                message: 'gateway timeout',
            },
        });
        expect(upsertRelevantContext).not.toHaveBeenCalled();
    });
});
