import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { nodeProcessRopewikiRoutes, lambdaProcessRopewikiRoutes } from '../../../src/ropewiki/hook-functions/processRopewikiRoutes';
import { RopewikiRoute } from '../../../src/types/pageRoute';
import { PageDataSource } from '../../../src/types/pageRoute';
import { MapDataEvent } from '../../../src/map-data/types/lambdaEvent';
import { Route, RouteType } from '../../../src/types/route';
import RopewikiPage from '../../../src/ropewiki/types/page';

// Mock map-data/main
jest.mock('../../../src/map-data/main', () => {
    const mockProcessPageRouteAndMapData = jest.fn<() => Promise<void>>();
    return {
        main: mockProcessPageRouteAndMapData,
    };
});

// Mock database connection
const mockClient = {
    release: jest.fn(),
} as any;

const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
    end: jest.fn(() => Promise.resolve()),
} as any;

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve(mockPool)),
}));

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
    // Create mocks inside factory to avoid hoisting issues
    const mockSendFn = jest.fn<() => Promise<any>>();
    const mockSQSClientInstance = {
        send: mockSendFn,
    };
    const MockSQSClient = jest.fn(() => mockSQSClientInstance);
    const MockSendMessageCommand = jest.fn();
    return {
        SQSClient: MockSQSClient,
        SendMessageCommand: MockSendMessageCommand,
    };
});

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('processRopewikiRoutes hook functions', () => {
    const originalEnv = process.env;
    let mockProcessPageRouteAndMapData: jest.MockedFunction<any>;
    let mockSetChunk: jest.MockedFunction<(start: number, end: number) => void>;
    let mockLogProgress: jest.MockedFunction<(message: string) => void>;
    let mockLogError: jest.MockedFunction<(message: string) => void>;
    let mockSend: jest.MockedFunction<() => Promise<any>>;
    let MockProgressLogger: any;
    let MockSQSClient: any;
    let MockSendMessageCommand: any;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        
        const mapDataMain = jest.requireMock('../../../src/map-data/main') as { main: jest.MockedFunction<any> };
        mockProcessPageRouteAndMapData = mapDataMain.main;
        mockProcessPageRouteAndMapData.mockResolvedValue(undefined);
        
        const progressLogger = jest.requireMock('../../../src/helpers/progressLogger') as { default: any };
        MockProgressLogger = progressLogger.default;
        const loggerInstance = new MockProgressLogger('test', 1);
        mockSetChunk = loggerInstance.setChunk as jest.MockedFunction<(start: number, end: number) => void>;
        mockLogProgress = loggerInstance.logProgress as jest.MockedFunction<(message: string) => void>;
        mockLogError = loggerInstance.logError as jest.MockedFunction<(message: string) => void>;
        
        const sqs = jest.requireMock('@aws-sdk/client-sqs') as { SQSClient: any; SendMessageCommand: any };
        MockSQSClient = sqs.SQSClient;
        MockSendMessageCommand = sqs.SendMessageCommand;
        // Get the mock client instance and its send method
        const sqsClientInstance = new MockSQSClient({});
        mockSend = sqsClientInstance.send as jest.MockedFunction<() => Promise<any>>;
        mockSend.mockResolvedValue({});
    });

    afterEach(() => {
        process.env = originalEnv;
        mockConsoleLog.mockClear();
        mockConsoleError.mockClear();
    });

    describe('nodeProcessRopewikiRoutes', () => {
        const createTestRoute = (id: string, name: string): Route => {
            return new Route(id, name, RouteType.Canyon, { lat: 40, lon: -110 });
        };

        const createTestPage = (id: string, name: string): RopewikiPage => {
            return new RopewikiPage(
                'test-pageid',
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
                [], // aka
                [], // betaSites
                undefined, // userVotes
                id,
            );
        };

        const createTestRopewikiRoute = (routeId: string, pageId: string, mapDataId?: string): RopewikiRoute => {
            return new RopewikiRoute(routeId, pageId, mapDataId);
        };

        it('returns early when routesAndPages is empty', async () => {
            // Clear mock calls from beforeEach
            MockProgressLogger.mockClear();
            
            await nodeProcessRopewikiRoutes([]);

            expect(MockProgressLogger).not.toHaveBeenCalled();
            expect(mockProcessPageRouteAndMapData).not.toHaveBeenCalled();
        });

        it('processes a single route/page pair successfully', async () => {
            const ropewikiRoute = createTestRopewikiRoute('route-1', 'page-1');

            await nodeProcessRopewikiRoutes([ropewikiRoute]);

            expect(MockProgressLogger).toHaveBeenCalledWith('Processing map data for routes', 1);
            expect(mockSetChunk).toHaveBeenCalledWith(0, 1);
            expect(mockProcessPageRouteAndMapData).toHaveBeenCalledTimes(1);
            const mapDataEvent = ropewikiRoute.toMapDataEvent();
            expect(mockProcessPageRouteAndMapData).toHaveBeenCalledWith(
                mapDataEvent,
                expect.any(Function), // nodeSaveMapData
                expect.any(Object), // logger
                expect.any(Object), // client
            );
        });

        it('processes multiple route/page pairs successfully', async () => {
            const ropewikiRoute1 = createTestRopewikiRoute('route-1', 'page-1');
            const ropewikiRoute2 = createTestRopewikiRoute('route-2', 'page-2');

            await nodeProcessRopewikiRoutes([ropewikiRoute1, ropewikiRoute2]);

            expect(MockProgressLogger).toHaveBeenCalledWith('Processing map data for routes', 2);
            expect(mockSetChunk).toHaveBeenCalledWith(0, 2);
            expect(mockProcessPageRouteAndMapData).toHaveBeenCalledTimes(2);
        });

        it('skips processing when route.id is missing', async () => {
            const ropewikiRoute = createTestRopewikiRoute('', 'page-1');

            await nodeProcessRopewikiRoutes([ropewikiRoute]);

            expect(mockProcessPageRouteAndMapData).not.toHaveBeenCalled();
            expect(mockLogError).toHaveBeenCalledWith(
                expect.stringContaining('Error processing route unknown / page page-1:'),
            );
        });

        it('skips processing when page.id is missing', async () => {
            const ropewikiRoute = createTestRopewikiRoute('route-1', '');

            await nodeProcessRopewikiRoutes([ropewikiRoute]);

            expect(mockProcessPageRouteAndMapData).not.toHaveBeenCalled();
            expect(mockLogError).toHaveBeenCalledWith(
                expect.stringContaining('Error processing route route-1 / page unknown:'),
            );
        });

        it('continues processing after an error', async () => {
            const ropewikiRoute1 = createTestRopewikiRoute('route-1', 'page-1');
            const ropewikiRoute2 = createTestRopewikiRoute('route-2', 'page-2');

            mockProcessPageRouteAndMapData
                .mockRejectedValueOnce(new Error('Processing failed'))
                .mockResolvedValueOnce(undefined);

            await nodeProcessRopewikiRoutes([ropewikiRoute1, ropewikiRoute2]);

            expect(mockProcessPageRouteAndMapData).toHaveBeenCalledTimes(2);
            expect(mockLogError).toHaveBeenCalledTimes(1);
            expect(mockLogError).toHaveBeenCalledWith(
                expect.stringContaining('Error processing route route-1 / page page-1:'),
            );
        });

        it('handles page name being undefined in error case', async () => {
            const ropewikiRoute = createTestRopewikiRoute('', '');
            // Removed unused page variable
            const _unused_page = new RopewikiPage(
                'test-pageid',
                '', // empty name
                'test-region-id',
                'https://example.com/page',
                new Date(),
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
                [], // aka
                [], // betaSites
                undefined, // userVotes
                '', // no id
            );

            await nodeProcessRopewikiRoutes([ropewikiRoute]);

            expect(mockLogError).toHaveBeenCalledWith(
                expect.stringContaining('Error processing route unknown / page unknown:'),
            );
        });
    });

    describe('lambdaProcessRopewikiRoutes', () => {
        const createTestRopewikiRoute = (routeId: string, pageId: string, mapDataId?: string): RopewikiRoute => {
            return new RopewikiRoute(routeId, pageId, mapDataId);
        };

        // Removed createTestPage - no longer needed
        const _unused_createTestPage = (id: string, name: string): RopewikiPage => {
            return new RopewikiPage(
                'test-pageid',
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
                [], // aka
                [], // betaSites
                undefined, // userVotes
                id,
            );
        };

        it('skips sending messages when DEV_ENVIRONMENT is "local"', async () => {
            process.env.DEV_ENVIRONMENT = 'local';
            const ropewikiRoute = createTestRopewikiRoute('route-1', 'page-1');

            await lambdaProcessRopewikiRoutes([ropewikiRoute]);

            expect(mockConsoleLog).toHaveBeenCalledWith(
                'Skipping SQS message sending for 1 route(s) - no queue configured locally',
            );
            // SQSClient is instantiated before the check, so it will be called
            // but send() should not be called
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('throws error when MAP_DATA_PROCESSING_QUEUE_URL is not set', async () => {
            delete process.env.DEV_ENVIRONMENT;
            delete process.env.MAP_DATA_PROCESSING_QUEUE_URL;
            const ropewikiRoute = createTestRopewikiRoute('route-1', 'page-1');

            await expect(lambdaProcessRopewikiRoutes([ropewikiRoute])).rejects.toThrow(
                'MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set',
            );
        });

        it('sends SQS message for a single route/page pair', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const ropewikiRoute = createTestRopewikiRoute('route-1', 'page-1');

            await lambdaProcessRopewikiRoutes([ropewikiRoute]);

            expect(MockSQSClient).toHaveBeenCalledWith({});
            expect(MockSendMessageCommand).toHaveBeenCalled();
            const sendMessageCall = MockSendMessageCommand.mock.calls[0]?.[0];
            expect(sendMessageCall).toMatchObject({
                QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
                MessageBody: JSON.stringify({
                    source: PageDataSource.Ropewiki,
                    routeId: 'route-1',
                    pageId: 'page-1',
                }),
            });
            expect(mockSend).toHaveBeenCalledTimes(1);
            expect(mockConsoleLog).toHaveBeenCalledWith('Sent route route-1 / page page-1 to MapDataProcessingQueue');
        });

        it('sends SQS messages for multiple route/page pairs', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const ropewikiRoute1 = createTestRopewikiRoute('route-1', 'page-1');
            const ropewikiRoute2 = createTestRopewikiRoute('route-2', 'page-2');

            await lambdaProcessRopewikiRoutes([ropewikiRoute1, ropewikiRoute2]);

            expect(MockSendMessageCommand).toHaveBeenCalledTimes(2);
            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockConsoleLog).toHaveBeenCalledTimes(3);
            expect(mockConsoleLog).toHaveBeenCalledWith('Queueing 2 RopewikiRoutes to process their map data...');
            expect(mockConsoleLog).toHaveBeenCalledWith('Sent route route-1 / page page-1 to MapDataProcessingQueue');
            expect(mockConsoleLog).toHaveBeenCalledWith('Sent route route-2 / page page-2 to MapDataProcessingQueue');
        });

        it('skips sending when route.id is missing', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const ropewikiRoute = createTestRopewikiRoute('', 'page-1');

            await lambdaProcessRopewikiRoutes([ropewikiRoute]);

            expect(mockSend).not.toHaveBeenCalled();
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Error sending route unknown / page page-1 to queue:',
                expect.any(Error),
            );
            const errorCall = mockConsoleError.mock.calls.find(call => 
                call[0] === 'Error sending route unknown / page page-1 to queue:'
            );
            expect(errorCall?.[1]).toHaveProperty('message', 'RopewikiRoute must have a route id to send to queue');
        });

        it('skips sending when page.id is missing', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const ropewikiRoute = createTestRopewikiRoute('route-1', '');

            await lambdaProcessRopewikiRoutes([ropewikiRoute]);

            expect(mockSend).not.toHaveBeenCalled();
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Error sending route route-1 / page unknown to queue:',
                expect.any(Error),
            );
        });

        it('continues sending after an error', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const ropewikiRoute1 = createTestRopewikiRoute('route-1', 'page-1');
            const ropewikiRoute2 = createTestRopewikiRoute('route-2', 'page-2');

            mockSend
                .mockRejectedValueOnce(new Error('SQS send failed'))
                .mockResolvedValueOnce({});

            await lambdaProcessRopewikiRoutes([ropewikiRoute1, ropewikiRoute2]);

            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockConsoleError).toHaveBeenCalledTimes(1);
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Error sending route route-1 / page page-1 to queue:',
                expect.objectContaining({
                    message: 'SQS send failed',
                }),
            );
            expect(mockConsoleLog).toHaveBeenCalledTimes(2);
            expect(mockConsoleLog).toHaveBeenCalledWith('Queueing 2 RopewikiRoutes to process their map data...');
            expect(mockConsoleLog).toHaveBeenCalledWith('Sent route route-2 / page page-2 to MapDataProcessingQueue');
        });

        it('handles empty routesAndPages array', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';

            await lambdaProcessRopewikiRoutes([]);

            expect(MockSQSClient).toHaveBeenCalled();
            expect(mockSend).not.toHaveBeenCalled();
        });
    });
});
