import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { nodeProcessRopewikiRoutes, lambdaProcessRopewikiRoutes } from '../../../src/ropewiki/hook-functions/processRopewikiRoutes';
import { Route, RouteType } from '../../../src/types/route';
import RopewikiPage from '../../../src/ropewiki/types/page';
import { PageDataSource } from '../../../src/map-data/types/mapData';

// Mock map-data/main
jest.mock('../../../src/map-data/main', () => {
    const mockProcessPageRouteAndMapData = jest.fn<() => Promise<void>>();
    return {
        main: mockProcessPageRouteAndMapData,
    };
});

// Mock ProgressLogger
jest.mock('../../../src/helpers/progressLogger', () => {
    const mockSetChunk = jest.fn();
    const mockLogProgress = jest.fn();
    const MockProgressLogger = jest.fn().mockImplementation(() => ({
        setChunk: mockSetChunk,
        logProgress: mockLogProgress,
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

        it('returns early when routesAndPages is empty', async () => {
            // Clear mock calls from beforeEach
            MockProgressLogger.mockClear();
            
            await nodeProcessRopewikiRoutes([]);

            expect(MockProgressLogger).not.toHaveBeenCalled();
            expect(mockProcessPageRouteAndMapData).not.toHaveBeenCalled();
        });

        it('processes a single route/page pair successfully', async () => {
            const route = createTestRoute('route-1', 'Test Route');
            const page = createTestPage('page-1', 'Test Route');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route, page]];

            await nodeProcessRopewikiRoutes(routesAndPages);

            expect(MockProgressLogger).toHaveBeenCalledWith('Processing map data for routes', 1);
            expect(mockSetChunk).toHaveBeenCalledWith(0, 1);
            expect(mockProcessPageRouteAndMapData).toHaveBeenCalledTimes(1);
            expect(mockProcessPageRouteAndMapData).toHaveBeenCalledWith(
                expect.anything(), // nodeSaveMapData
                PageDataSource.Ropewiki,
                'page-1',
                'route-1',
            );
            expect(mockLogProgress).toHaveBeenCalledWith(
                'Processed "Test Route" (route route-1 / page page-1)',
            );
        });

        it('processes multiple route/page pairs successfully', async () => {
            const route1 = createTestRoute('route-1', 'Route 1');
            const page1 = createTestPage('page-1', 'Route 1');
            const route2 = createTestRoute('route-2', 'Route 2');
            const page2 = createTestPage('page-2', 'Route 2');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route1, page1], [route2, page2]];

            await nodeProcessRopewikiRoutes(routesAndPages);

            expect(MockProgressLogger).toHaveBeenCalledWith('Processing map data for routes', 2);
            expect(mockSetChunk).toHaveBeenCalledWith(0, 2);
            expect(mockProcessPageRouteAndMapData).toHaveBeenCalledTimes(2);
            expect(mockLogProgress).toHaveBeenCalledTimes(2);
            expect(mockLogProgress).toHaveBeenNthCalledWith(1, 'Processed "Route 1" (route route-1 / page page-1)');
            expect(mockLogProgress).toHaveBeenNthCalledWith(2, 'Processed "Route 2" (route route-2 / page page-2)');
        });

        it('skips processing when route.id is missing', async () => {
            const route = createTestRoute('', 'Test Route');
            const page = createTestPage('page-1', 'Test Route');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route, page]];

            await nodeProcessRopewikiRoutes(routesAndPages);

            expect(mockProcessPageRouteAndMapData).not.toHaveBeenCalled();
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Error processing route unknown / page page-1:',
                expect.any(Error),
            );
            expect(mockLogProgress).toHaveBeenCalledWith(
                'Skipped "Test Route" (route unknown / page page-1) due to error',
            );
        });

        it('skips processing when page.id is missing', async () => {
            const route = createTestRoute('route-1', 'Test Route');
            const page = createTestPage('', 'Test Route');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route, page]];

            await nodeProcessRopewikiRoutes(routesAndPages);

            expect(mockProcessPageRouteAndMapData).not.toHaveBeenCalled();
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Error processing route route-1 / page unknown:',
                expect.any(Error),
            );
            expect(mockLogProgress).toHaveBeenCalledWith(
                'Skipped "Test Route" (route route-1 / page unknown) due to error',
            );
        });

        it('continues processing after an error', async () => {
            const route1 = createTestRoute('route-1', 'Route 1');
            const page1 = createTestPage('page-1', 'Route 1');
            const route2 = createTestRoute('route-2', 'Route 2');
            const page2 = createTestPage('page-2', 'Route 2');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route1, page1], [route2, page2]];

            mockProcessPageRouteAndMapData
                .mockRejectedValueOnce(new Error('Processing failed'))
                .mockResolvedValueOnce(undefined);

            await nodeProcessRopewikiRoutes(routesAndPages);

            expect(mockProcessPageRouteAndMapData).toHaveBeenCalledTimes(2);
            expect(mockConsoleError).toHaveBeenCalledTimes(1);
            expect(mockLogProgress).toHaveBeenCalledTimes(2);
            // First call might be the error, second is the success
            expect(mockLogProgress).toHaveBeenCalledWith('Skipped "Route 1" (route route-1 / page page-1) due to error');
            expect(mockLogProgress).toHaveBeenCalledWith('Processed "Route 2" (route route-2 / page page-2)');
        });

        it('handles page name being undefined in error case', async () => {
            const route = createTestRoute('', 'Test Route');
            const page = new RopewikiPage(
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
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route, page]];

            await nodeProcessRopewikiRoutes(routesAndPages);

            expect(mockLogProgress).toHaveBeenCalledWith(
                'Skipped "unknown" (route unknown / page unknown) due to error',
            );
        });
    });

    describe('lambdaProcessRopewikiRoutes', () => {
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

        it('skips sending messages when DEV_ENVIRONMENT is "local"', async () => {
            process.env.DEV_ENVIRONMENT = 'local';
            const route = createTestRoute('route-1', 'Test Route');
            const page = createTestPage('page-1', 'Test Route');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route, page]];

            await lambdaProcessRopewikiRoutes(routesAndPages);

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
            const route = createTestRoute('route-1', 'Test Route');
            const page = createTestPage('page-1', 'Test Route');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route, page]];

            await expect(lambdaProcessRopewikiRoutes(routesAndPages)).rejects.toThrow(
                'MAP_DATA_PROCESSING_QUEUE_URL environment variable is not set',
            );
        });

        it('sends SQS message for a single route/page pair', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const route = createTestRoute('route-1', 'Test Route');
            const page = createTestPage('page-1', 'Test Route');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route, page]];

            await lambdaProcessRopewikiRoutes(routesAndPages);

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
            const route1 = createTestRoute('route-1', 'Route 1');
            const page1 = createTestPage('page-1', 'Route 1');
            const route2 = createTestRoute('route-2', 'Route 2');
            const page2 = createTestPage('page-2', 'Route 2');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route1, page1], [route2, page2]];

            await lambdaProcessRopewikiRoutes(routesAndPages);

            expect(MockSendMessageCommand).toHaveBeenCalledTimes(2);
            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockConsoleLog).toHaveBeenCalledTimes(2);
            expect(mockConsoleLog).toHaveBeenCalledWith('Sent route route-1 / page page-1 to MapDataProcessingQueue');
            expect(mockConsoleLog).toHaveBeenCalledWith('Sent route route-2 / page page-2 to MapDataProcessingQueue');
        });

        it('skips sending when route.id is missing', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const route = createTestRoute('', 'Test Route');
            const page = createTestPage('page-1', 'Test Route');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route, page]];

            await lambdaProcessRopewikiRoutes(routesAndPages);

            expect(mockSend).not.toHaveBeenCalled();
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Error sending route unknown / page page-1 to queue:',
                expect.any(Error),
            );
            const errorCall = mockConsoleError.mock.calls.find(call => 
                call[0] === 'Error sending route unknown / page page-1 to queue:'
            );
            expect(errorCall?.[1]).toHaveProperty('message', 'Route must have an id to send to queue');
        });

        it('skips sending when page.id is missing', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const route = createTestRoute('route-1', 'Test Route');
            const page = createTestPage('', 'Test Route');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route, page]];

            await lambdaProcessRopewikiRoutes(routesAndPages);

            expect(mockSend).not.toHaveBeenCalled();
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Error sending route route-1 / page unknown to queue:',
                expect.any(Error),
            );
        });

        it('continues sending after an error', async () => {
            delete process.env.DEV_ENVIRONMENT;
            process.env.MAP_DATA_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
            const route1 = createTestRoute('route-1', 'Route 1');
            const page1 = createTestPage('page-1', 'Route 1');
            const route2 = createTestRoute('route-2', 'Route 2');
            const page2 = createTestPage('page-2', 'Route 2');
            const routesAndPages: Array<[Route, RopewikiPage]> = [[route1, page1], [route2, page2]];

            mockSend
                .mockRejectedValueOnce(new Error('SQS send failed'))
                .mockResolvedValueOnce({});

            await lambdaProcessRopewikiRoutes(routesAndPages);

            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockConsoleError).toHaveBeenCalledTimes(1);
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Error sending route route-1 / page page-1 to queue:',
                expect.objectContaining({
                    message: 'SQS send failed',
                }),
            );
            expect(mockConsoleLog).toHaveBeenCalledTimes(1);
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
