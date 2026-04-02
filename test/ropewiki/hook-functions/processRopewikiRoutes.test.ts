import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { nodeProcessRopewikiRoutes, lambdaProcessRopewikiRoutes } from '../../../src/ropewiki/hook-functions/processRopewikiRoutes';
import { RopewikiRoute } from '../../../src/types/pageRoute';
import { MapDataEvent } from '../../../src/map-data/types/lambdaEvent';
import { Route, RouteType } from 'ropegeo-common/classes';
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

jest.mock('../../../src/ropewiki/sqs/sendMapDataSQSMessage', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve()),
}));

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('processRopewikiRoutes hook functions', () => {
    const originalEnv = process.env;
    let mockProcessPageRouteAndMapData: jest.MockedFunction<any>;
    let mockSetChunk: jest.MockedFunction<(start: number, end: number) => void>;
    let mockLogProgress: jest.MockedFunction<(message: string) => void>;
    let mockLogError: jest.MockedFunction<(message: string) => void>;
    let MockProgressLogger: any;
    let mockSendMapDataSQSMessage: jest.MockedFunction<typeof import('../../../src/ropewiki/sqs/sendMapDataSQSMessage').default>;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        
        const mapDataMain = jest.requireMock('../../../src/map-data/main') as { main: jest.MockedFunction<any> };
        mockProcessPageRouteAndMapData = mapDataMain.main;
        mockProcessPageRouteAndMapData.mockResolvedValue(undefined);
        
        const progressLogger = jest.requireMock('ropegeo-common/helpers') as { ProgressLogger: any };
        MockProgressLogger = progressLogger.ProgressLogger;
        const loggerInstance = new MockProgressLogger('test', 1);
        mockSetChunk = loggerInstance.setChunk as jest.MockedFunction<(start: number, end: number) => void>;
        mockLogProgress = loggerInstance.logProgress as jest.MockedFunction<(message: string) => void>;
        mockLogError = loggerInstance.logError as jest.MockedFunction<(message: string) => void>;
        
        mockSendMapDataSQSMessage = jest.requireMock('../../../src/ropewiki/sqs/sendMapDataSQSMessage').default;
        mockSendMapDataSQSMessage.mockResolvedValue(undefined);
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
            expect(mockSendMapDataSQSMessage).not.toHaveBeenCalled();
            // ProgressLogger only created in beforeEach for node tests; lambda path returns before creating one
            expect(MockProgressLogger).not.toHaveBeenCalledWith('Queueing RopewikiRoutes to map data queue', expect.any(Number));
        });

        it('throws error when MAP_DATA_PROCESSING_QUEUE_URL is not set', async () => {
            delete process.env.DEV_ENVIRONMENT;
            delete process.env.MAP_DATA_PROCESSING_QUEUE_URL;
            const ropewikiRoute = createTestRopewikiRoute('route-1', 'page-1');
            mockSendMapDataSQSMessage.mockRejectedValueOnce(
                new Error('MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set'),
            );

            await expect(lambdaProcessRopewikiRoutes([ropewikiRoute])).rejects.toThrow(
                'MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set',
            );

            expect(MockProgressLogger).toHaveBeenCalledWith('Queueing RopewikiRoutes to map data queue', 1);
            expect(mockSetChunk).toHaveBeenCalledWith(0, 1);
            expect(mockLogProgress).not.toHaveBeenCalled();
        });

        it('calls sendMapDataSQSMessage for a single route/page pair and logs progress', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const ropewikiRoute = createTestRopewikiRoute('route-1', 'page-1');

            await lambdaProcessRopewikiRoutes([ropewikiRoute]);

            expect(MockProgressLogger).toHaveBeenCalledWith('Queueing RopewikiRoutes to map data queue', 1);
            expect(mockSetChunk).toHaveBeenCalledWith(0, 1);
            expect(mockSendMapDataSQSMessage).toHaveBeenCalledTimes(1);
            expect(mockSendMapDataSQSMessage).toHaveBeenCalledWith(ropewikiRoute, true);
            expect(mockLogProgress).toHaveBeenCalledTimes(1);
            expect(mockLogProgress).toHaveBeenCalledWith('Sent route route-1 / page page-1 to queue');
        });

        it('calls sendMapDataSQSMessage for multiple route/page pairs and logs progress', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const ropewikiRoute1 = createTestRopewikiRoute('route-1', 'page-1');
            const ropewikiRoute2 = createTestRopewikiRoute('route-2', 'page-2');

            await lambdaProcessRopewikiRoutes([ropewikiRoute1, ropewikiRoute2]);

            expect(MockProgressLogger).toHaveBeenCalledWith('Queueing RopewikiRoutes to map data queue', 2);
            expect(mockSetChunk).toHaveBeenCalledWith(0, 2);
            expect(mockSendMapDataSQSMessage).toHaveBeenCalledTimes(2);
            expect(mockSendMapDataSQSMessage).toHaveBeenNthCalledWith(1, ropewikiRoute1, true);
            expect(mockSendMapDataSQSMessage).toHaveBeenNthCalledWith(2, ropewikiRoute2, true);
            expect(mockLogProgress).toHaveBeenCalledTimes(2);
            expect(mockLogProgress).toHaveBeenNthCalledWith(1, 'Sent route route-1 / page page-1 to queue');
            expect(mockLogProgress).toHaveBeenNthCalledWith(2, 'Sent route route-2 / page page-2 to queue');
        });

        it('throws when route is missing (fail fast)', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const ropewikiRoute = createTestRopewikiRoute('', 'page-1');
            mockSendMapDataSQSMessage.mockRejectedValueOnce(
                new Error('RopewikiRoute must have a route to send to queue'),
            );

            await expect(lambdaProcessRopewikiRoutes([ropewikiRoute])).rejects.toThrow(
                'RopewikiRoute must have a route to send to queue',
            );

            expect(MockProgressLogger).toHaveBeenCalledWith('Queueing RopewikiRoutes to map data queue', 1);
            expect(mockSetChunk).toHaveBeenCalledWith(0, 1);
            expect(mockSendMapDataSQSMessage).toHaveBeenCalledTimes(1);
            expect(mockLogProgress).not.toHaveBeenCalled();
        });

        it('throws when page is missing (fail fast)', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const ropewikiRoute = createTestRopewikiRoute('route-1', '');
            mockSendMapDataSQSMessage.mockRejectedValueOnce(
                new Error('RopewikiRoute must have a page to send to queue'),
            );

            await expect(lambdaProcessRopewikiRoutes([ropewikiRoute])).rejects.toThrow(
                'RopewikiRoute must have a page to send to queue',
            );

            expect(MockProgressLogger).toHaveBeenCalledWith('Queueing RopewikiRoutes to map data queue', 1);
            expect(mockSetChunk).toHaveBeenCalledWith(0, 1);
            expect(mockSendMapDataSQSMessage).toHaveBeenCalledTimes(1);
            expect(mockLogProgress).not.toHaveBeenCalled();
        });

        it('propagates error from sendMapDataSQSMessage (fail fast)', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const ropewikiRoute1 = createTestRopewikiRoute('route-1', 'page-1');
            const ropewikiRoute2 = createTestRopewikiRoute('route-2', 'page-2');

            mockSendMapDataSQSMessage
                .mockRejectedValueOnce(new Error('SQS send failed'))
                .mockResolvedValueOnce(undefined);

            await expect(lambdaProcessRopewikiRoutes([ropewikiRoute1, ropewikiRoute2])).rejects.toThrow(
                'SQS send failed',
            );

            expect(MockProgressLogger).toHaveBeenCalledWith('Queueing RopewikiRoutes to map data queue', 2);
            expect(mockSetChunk).toHaveBeenCalledWith(0, 2);
            expect(mockSendMapDataSQSMessage).toHaveBeenCalledTimes(1);
            expect(mockSendMapDataSQSMessage).toHaveBeenCalledWith(ropewikiRoute1, true);
            expect(mockLogProgress).not.toHaveBeenCalled();
        });

        it('returns early when routes array is empty', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';

            await lambdaProcessRopewikiRoutes([]);

            // ProgressLogger only created in beforeEach for node tests; lambda path returns before creating one
            expect(MockProgressLogger).not.toHaveBeenCalledWith('Queueing RopewikiRoutes to map data queue', expect.any(Number));
            expect(mockSendMapDataSQSMessage).not.toHaveBeenCalled();
        });
    });
});
