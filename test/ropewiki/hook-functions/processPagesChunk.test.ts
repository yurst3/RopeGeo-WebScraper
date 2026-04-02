import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { nodeProcessPagesChunk, lambdaProcessPagesChunk } from '../../../src/ropewiki/hook-functions/processPagesChunk';
import RopewikiPage from '../../../src/ropewiki/types/page';

// Mock processPage
jest.mock('../../../src/ropewiki/processors/processPage', () => {
    const mockProcessPage = jest.fn<() => Promise<void>>();
    return {
        processPage: mockProcessPage,
    };
});

// Mock ProgressLogger
jest.mock('ropegeo-common/helpers', () => {
    const mockSetChunk = jest.fn();
    const mockLogProgress = jest.fn();
    const mockLogError = jest.fn();
    const MockProgressLogger = jest.fn().mockImplementation(() => ({
        setChunk: mockSetChunk,
        logProgress: mockLogProgress,
        logError: mockLogError,
    }));
    return {
        __esModule: true,
        ProgressLogger: MockProgressLogger,
    };
});

jest.mock('../../../src/ropewiki/sqs/sendProcessPageSQSMessage', () => ({
    __esModule: true,
    default: jest.fn(),
}));

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('processPagesChunk hook functions', () => {
    const originalEnv = process.env;
    let mockProcessPage: jest.MockedFunction<any>;
    let mockSetChunk: jest.MockedFunction<(start: number, end: number) => void>;
    let mockLogProgress: jest.MockedFunction<(message: string) => void>;
    let mockLogError: jest.MockedFunction<(message: string) => void>;
    let mockSendProcessPageSQSMessage: jest.MockedFunction<typeof import('../../../src/ropewiki/sqs/sendProcessPageSQSMessage').default>;
    let MockProgressLogger: any;
    let mockClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };

        const processPageModule = jest.requireMock('../../../src/ropewiki/processors/processPage') as {
            processPage: jest.MockedFunction<any>;
        };
        mockProcessPage = processPageModule.processPage;
        mockProcessPage.mockResolvedValue(undefined);

        const progressLogger = jest.requireMock('ropegeo-common/helpers') as { ProgressLogger: any };
        MockProgressLogger = progressLogger.ProgressLogger;
        const loggerInstance = new MockProgressLogger('test', 1);
        mockSetChunk = loggerInstance.setChunk as jest.MockedFunction<(start: number, end: number) => void>;
        mockLogProgress = loggerInstance.logProgress as jest.MockedFunction<(message: string) => void>;
        mockLogError = loggerInstance.logError as jest.MockedFunction<(message: string) => void>;

        mockSendProcessPageSQSMessage = require('../../../src/ropewiki/sqs/sendProcessPageSQSMessage')
            .default as jest.MockedFunction<typeof import('../../../src/ropewiki/sqs/sendProcessPageSQSMessage').default>;
        mockSendProcessPageSQSMessage.mockResolvedValue(undefined);

        mockClient = {
            query: jest.fn(),
        };
    });

    afterEach(() => {
        process.env = originalEnv;
        mockConsoleLog.mockClear();
        mockConsoleError.mockClear();
    });

    describe('nodeProcessPagesChunk', () => {
        const createTestPage = (pageid: string, name: string): RopewikiPage => {
            return new RopewikiPage(
                pageid,
                name,
                'test-region-id',
                'https://example.com/page',
                new Date(),
                { lat: 40, lon: -110 },
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined, // overallLength
                undefined, // approachLength
                undefined, // approachElevGain
                undefined, // descentLength
                undefined, // descentElevGain
                undefined, // exitLength
                undefined, // exitElevGain
                undefined, // minApproachTime
                undefined, // maxApproachTime
                undefined, // minDescentTime
                undefined, // maxDescentTime
                undefined, // minExitTime
                undefined, // maxExitTime
                [], // aka
                [], // betaSites
                undefined, // userVotes
                undefined, // id
            );
        };

        it('processes an empty array of pages', async () => {
            const logger = new MockProgressLogger('test', 0);
            await nodeProcessPagesChunk(mockClient, [], logger);

            expect(mockProcessPage).not.toHaveBeenCalled();
        });

        it('processes a single page', async () => {
            const page = createTestPage('page-1', 'Test Page');
            const pages = [page];
            const logger = new MockProgressLogger('test', 1);

            await nodeProcessPagesChunk(mockClient, pages, logger);

            expect(mockProcessPage).toHaveBeenCalledTimes(1);
            expect(mockProcessPage).toHaveBeenCalledWith(mockClient, page, logger, 'sp_page_0');
        });

        it('processes multiple pages with correct savepoint names', async () => {
            const page1 = createTestPage('page-1', 'Page 1');
            const page2 = createTestPage('page-2', 'Page 2');
            const page3 = createTestPage('page-3', 'Page 3');
            const pages = [page1, page2, page3];
            const logger = new MockProgressLogger('test', 3);

            await nodeProcessPagesChunk(mockClient, pages, logger);

            expect(mockProcessPage).toHaveBeenCalledTimes(3);
            expect(mockProcessPage).toHaveBeenNthCalledWith(1, mockClient, page1, logger, 'sp_page_0');
            expect(mockProcessPage).toHaveBeenNthCalledWith(2, mockClient, page2, logger, 'sp_page_1');
            expect(mockProcessPage).toHaveBeenNthCalledWith(3, mockClient, page3, logger, 'sp_page_2');
        });

        it('passes logger to processPage when provided', async () => {
            const page = createTestPage('page-1', 'Test Page');
            const pages = [page];
            const logger = new MockProgressLogger('test', 1);

            await nodeProcessPagesChunk(mockClient, pages, logger);

            expect(mockProcessPage).toHaveBeenCalledWith(mockClient, page, logger, 'sp_page_0');
        });

        it('processes all pages even when processPage logs errors', async () => {
            const page1 = createTestPage('page-1', 'Page 1');
            const page2 = createTestPage('page-2', 'Page 2');
            const pages = [page1, page2];
            const logger = new MockProgressLogger('test', 2);
            // processPage catches errors internally and logs them, doesn't throw
            mockProcessPage.mockResolvedValue(undefined);

            await nodeProcessPagesChunk(mockClient, pages, logger);

            expect(mockProcessPage).toHaveBeenCalledTimes(2);
            expect(mockProcessPage).toHaveBeenCalledWith(mockClient, page1, logger, 'sp_page_0');
            expect(mockProcessPage).toHaveBeenCalledWith(mockClient, page2, logger, 'sp_page_1');
        });
    });

    describe('lambdaProcessPagesChunk', () => {
        const createTestPage = (pageid: string, name: string, id?: string): RopewikiPage => {
            const page = new RopewikiPage(
                pageid,
                name,
                'test-region-id',
                'https://example.com/page',
                new Date(),
                { lat: 40, lon: -110 },
                undefined, // quality
                undefined, // rating
                undefined, // timeRating
                undefined, // kmlUrl
                undefined, // technicalRating
                undefined, // waterRating
                undefined, // riskRating
                undefined, // permits
                undefined, // rappelInfo
                undefined, // rappelCount
                undefined, // rappelLongest
                undefined, // months
                undefined, // shuttleTime
                undefined, // vehicle
                undefined, // minOverallTime
                undefined, // maxOverallTime
                undefined, // overallLength
                undefined, // approachLength
                undefined, // approachElevGain
                undefined, // descentLength
                undefined, // descentElevGain
                undefined, // exitLength
                undefined, // exitElevGain
                undefined, // minApproachTime
                undefined, // maxApproachTime
                undefined, // minDescentTime
                undefined, // maxDescentTime
                undefined, // minExitTime
                undefined, // maxExitTime
                [], // aka
                [], // betaSites
                undefined, // userVotes
                id,
            );
            return page;
        };

        it('skips sending messages when DEV_ENVIRONMENT is "local"', async () => {
            process.env.DEV_ENVIRONMENT = 'local';
            const page = createTestPage('page-1', 'Test Page', 'uuid-1');
            const pages = [page];
            const logger = new MockProgressLogger('test', 1);

            await lambdaProcessPagesChunk(mockClient, pages, logger);

            expect(mockConsoleLog).toHaveBeenCalledWith(
                'Skipping SQS message sending for 1 page(s) - no queue configured locally',
            );
            expect(mockSendProcessPageSQSMessage).not.toHaveBeenCalled();
        });

        it('propagates errors from sendProcessPageSQSMessage (fail fast)', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const page = createTestPage('page-1', 'Test Page', 'uuid-1');
            const pages = [page];
            const logger = new MockProgressLogger('test', 1);
            const queueUrlError = new Error('ROPEWIKI_PAGE_PROCESSING_QUEUE_URL environment variable is not set');
            mockSendProcessPageSQSMessage.mockRejectedValue(queueUrlError);

            await expect(lambdaProcessPagesChunk(mockClient, pages, logger)).rejects.toThrow(
                'ROPEWIKI_PAGE_PROCESSING_QUEUE_URL environment variable is not set',
            );

            expect(mockSendProcessPageSQSMessage).toHaveBeenCalledWith(page);
            expect(mockLogProgress).not.toHaveBeenCalled();
        });

        it('sends SQS message for a single page', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const page = createTestPage('page-1', 'Test Page', 'uuid-1');
            const pages = [page];
            const logger = new MockProgressLogger('test', 1);

            await lambdaProcessPagesChunk(mockClient, pages, logger);

            expect(mockSendProcessPageSQSMessage).toHaveBeenCalledTimes(1);
            expect(mockSendProcessPageSQSMessage).toHaveBeenCalledWith(page);
            expect(mockLogProgress).toHaveBeenCalledWith('Sent page page-1 Test Page to queue');
        });

        it('sends SQS messages for multiple pages', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const page1 = createTestPage('page-1', 'Page 1', 'uuid-1');
            const page2 = createTestPage('page-2', 'Page 2', 'uuid-2');
            const pages = [page1, page2];
            const logger = new MockProgressLogger('test', 2);

            await lambdaProcessPagesChunk(mockClient, pages, logger);

            expect(mockSendProcessPageSQSMessage).toHaveBeenCalledTimes(2);
            expect(mockSendProcessPageSQSMessage).toHaveBeenNthCalledWith(1, page1);
            expect(mockSendProcessPageSQSMessage).toHaveBeenNthCalledWith(2, page2);
            expect(mockLogProgress).toHaveBeenCalledTimes(2);
            expect(mockLogProgress).toHaveBeenCalledWith('Sent page page-1 Page 1 to queue');
            expect(mockLogProgress).toHaveBeenCalledWith('Sent page page-2 Page 2 to queue');
        });

        it('logs progress when logger is provided', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const page = createTestPage('page-1', 'Test Page', 'uuid-1');
            const pages = [page];
            const logger = new MockProgressLogger('test', 1);
            mockLogProgress.mockClear();

            await lambdaProcessPagesChunk(mockClient, pages, logger);

            expect(mockLogProgress).toHaveBeenCalledWith('Sent page page-1 Test Page to queue');
        });

        it('propagates error and does not send remaining pages when first send fails', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const page1 = createTestPage('page-1', 'Page 1', 'uuid-1');
            const page2 = createTestPage('page-2', 'Page 2', 'uuid-2');
            const pages = [page1, page2];
            const logger = new MockProgressLogger('test', 2);
            const error = new Error('SQS send failed');
            mockSendProcessPageSQSMessage.mockRejectedValueOnce(error);

            await expect(lambdaProcessPagesChunk(mockClient, pages, logger)).rejects.toThrow('SQS send failed');

            expect(mockSendProcessPageSQSMessage).toHaveBeenCalledTimes(1);
            expect(mockSendProcessPageSQSMessage).toHaveBeenCalledWith(page1);
            expect(mockLogProgress).not.toHaveBeenCalled();
        });

        it('handles empty pages array', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const logger = new MockProgressLogger('test', 0);

            await lambdaProcessPagesChunk(mockClient, [], logger);

            expect(mockSendProcessPageSQSMessage).not.toHaveBeenCalled();
        });
    });
});
