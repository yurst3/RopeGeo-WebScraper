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
jest.mock('../../../src/helpers/progressLogger', () => {
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
        default: MockProgressLogger,
    };
});

// Mock @aws-sdk/client-sqs
const mockSend = jest.fn<() => Promise<any>>();
const mockSQSClient = {
    send: mockSend,
};

jest.mock('@aws-sdk/client-sqs', () => {
    const MockSQSClient = jest.fn(() => mockSQSClient);
    const MockSendMessageCommand = jest.fn();
    return {
        SQSClient: MockSQSClient,
        SendMessageCommand: MockSendMessageCommand,
    };
});

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('processPagesChunk hook functions', () => {
    const originalEnv = process.env;
    let mockProcessPage: jest.MockedFunction<any>;
    let mockSetChunk: jest.MockedFunction<(start: number, end: number) => void>;
    let mockLogProgress: jest.MockedFunction<(message: string) => void>;
    let mockLogError: jest.MockedFunction<(message: string) => void>;
    let mockSend: jest.MockedFunction<() => Promise<any>>;
    let MockProgressLogger: any;
    let MockSQSClient: any;
    let MockSendMessageCommand: any;
    let mockClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        
        const processPageModule = jest.requireMock('../../../src/ropewiki/processors/processPage') as { processPage: jest.MockedFunction<any> };
        mockProcessPage = processPageModule.processPage;
        mockProcessPage.mockResolvedValue(undefined);
        
        const progressLogger = jest.requireMock('../../../src/helpers/progressLogger') as { default: any };
        MockProgressLogger = progressLogger.default;
        const loggerInstance = new MockProgressLogger('test', 1);
        mockSetChunk = loggerInstance.setChunk as jest.MockedFunction<(start: number, end: number) => void>;
        mockLogProgress = loggerInstance.logProgress as jest.MockedFunction<(message: string) => void>;
        mockLogError = loggerInstance.logError as jest.MockedFunction<(message: string) => void>;
        
        const sqs = jest.requireMock('@aws-sdk/client-sqs') as { SQSClient: any; SendMessageCommand: any };
        MockSQSClient = sqs.SQSClient;
        MockSendMessageCommand = sqs.SendMessageCommand;
        const sqsClientInstance = new MockSQSClient({});
        mockSend = sqsClientInstance.send as jest.MockedFunction<() => Promise<any>>;
        mockSend.mockResolvedValue({});
        
        // Mock database client
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
                undefined, // hike
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
        const createTestPage = (pageid: string, name: string): RopewikiPage => {
            return new RopewikiPage(
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
                undefined, // shuttle
                undefined, // vehicle
                undefined, // minTime
                undefined, // maxTime
                undefined, // hike
                [], // aka
                [], // betaSites
                undefined, // userVotes
                undefined, // id
            );
        };

        it('skips sending messages when DEV_ENVIRONMENT is "local"', async () => {
            process.env.DEV_ENVIRONMENT = 'local';
            const page = createTestPage('page-1', 'Test Page');
            const pages = [page];
            const logger = new MockProgressLogger('test', 1);

            await lambdaProcessPagesChunk(mockClient, pages, logger);

            expect(mockConsoleLog).toHaveBeenCalledWith(
                'Skipping SQS message sending for 1 page(s) - no queue configured locally',
            );
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('throws error when ROPEWIKI_PAGE_PROCESSING_QUEUE_URL is not set', async () => {
            delete process.env.DEV_ENVIRONMENT;
            delete process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL;
            const page = createTestPage('page-1', 'Test Page');
            const pages = [page];
            const logger = new MockProgressLogger('test', 1);

            await expect(lambdaProcessPagesChunk(mockClient, pages, logger)).rejects.toThrow(
                'ROPEWIKI_PAGE_PROCESSING_QUEUE_URL environment variable is not set',
            );
        });

        it('sends SQS message for a single page', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const page = createTestPage('page-1', 'Test Page');
            const pages = [page];
            const logger = new MockProgressLogger('test', 1);

            await lambdaProcessPagesChunk(mockClient, pages, logger);

            expect(MockSQSClient).toHaveBeenCalledWith({});
            expect(MockSendMessageCommand).toHaveBeenCalled();
            const sendMessageCall = MockSendMessageCommand.mock.calls[0]?.[0];
            expect(sendMessageCall).toMatchObject({
                QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
                MessageBody: JSON.stringify(page),
            });
            expect(mockSend).toHaveBeenCalledTimes(1);
            expect(mockLogProgress).toHaveBeenCalledWith('Sent page page-1 Test Page to queue');
        });

        it('sends SQS messages for multiple pages', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const page1 = createTestPage('page-1', 'Page 1');
            const page2 = createTestPage('page-2', 'Page 2');
            const pages = [page1, page2];
            const logger = new MockProgressLogger('test', 2);

            await lambdaProcessPagesChunk(mockClient, pages, logger);

            expect(MockSendMessageCommand).toHaveBeenCalledTimes(2);
            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockLogProgress).toHaveBeenCalledTimes(2);
            expect(mockLogProgress).toHaveBeenCalledWith('Sent page page-1 Page 1 to queue');
            expect(mockLogProgress).toHaveBeenCalledWith('Sent page page-2 Page 2 to queue');
        });

        it('logs progress when logger is provided', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const page = createTestPage('page-1', 'Test Page');
            const pages = [page];
            const logger = new MockProgressLogger('test', 1);
            mockLogProgress.mockClear();

            await lambdaProcessPagesChunk(mockClient, pages, logger);

            expect(mockLogProgress).toHaveBeenCalledWith('Sent page page-1 Test Page to queue');
        });

        it('logs errors from SQS send and continues processing', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const page = createTestPage('page-1', 'Test Page');
            const pages = [page];
            const logger = new MockProgressLogger('test', 1);
            const error = new Error('SQS send failed');
            mockSend.mockRejectedValue(error);

            await lambdaProcessPagesChunk(mockClient, pages, logger);
            
            expect(mockLogError).toHaveBeenCalledWith('Error sending page page-1 Test Page to queue: SQS send failed');
            expect(mockConsoleError).not.toHaveBeenCalled();
        });

        it('continues processing all pages even when some SQS sends fail', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const page1 = createTestPage('page-1', 'Page 1');
            const page2 = createTestPage('page-2', 'Page 2');
            const pages = [page1, page2];
            const logger = new MockProgressLogger('test', 2);
            const error = new Error('SQS send failed');
            mockSend
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce({});

            await lambdaProcessPagesChunk(mockClient, pages, logger);
            
            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockLogError).toHaveBeenCalledWith('Error sending page page-1 Page 1 to queue: SQS send failed');
            expect(mockLogProgress).toHaveBeenCalledWith('Sent page page-2 Page 2 to queue');
            expect(mockConsoleError).not.toHaveBeenCalled();
        });

        it('handles empty pages array', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const logger = new MockProgressLogger('test', 0);

            await lambdaProcessPagesChunk(mockClient, [], logger);

            expect(MockSQSClient).toHaveBeenCalled();
            expect(mockSend).not.toHaveBeenCalled();
        });
    });
});
