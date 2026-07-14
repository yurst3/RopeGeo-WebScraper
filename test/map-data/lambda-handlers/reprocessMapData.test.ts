import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RopewikiRoute } from '../../../src/types/pageRoute';
import { reprocessMapData } from '../../../src/map-data/lambda-handlers/reprocessMapData';

let mockGetDatabaseConnection: jest.MockedFunction<typeof import('../../../src/helpers/getDatabaseConnection').default>;
let mockListRopewikiMapDataReprocessTargets: jest.MockedFunction<
    typeof import('../../../src/map-data/database/listRopewikiMapDataReprocessTargets').listRopewikiMapDataReprocessTargets
>;
let mockSendMapDataSQSMessage: jest.MockedFunction<
    typeof import('../../../src/ropewiki/sqs/sendMapDataSQSMessage').default
>;

let mockClient: { release: ReturnType<typeof jest.fn> };
let mockPool: { connect: ReturnType<typeof jest.fn>; end: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/map-data/database/listRopewikiMapDataReprocessTargets', () => ({
    listRopewikiMapDataReprocessTargets: jest.fn(),
}));

jest.mock('../../../src/ropewiki/sqs/sendMapDataSQSMessage', () => ({
    __esModule: true,
    default: jest.fn(),
}));

let consoleLogSpy: ReturnType<typeof jest.spyOn>;
let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

const SAMPLE_ID = '0827ba8b-27b3-40dc-8385-06f823dbf535';

describe('reprocessMapData', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockClient = { release: jest.fn() };
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
            end: jest.fn().mockResolvedValue(undefined),
        };

        mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default;
        mockListRopewikiMapDataReprocessTargets = require('../../../src/map-data/database/listRopewikiMapDataReprocessTargets')
            .listRopewikiMapDataReprocessTargets;
        mockSendMapDataSQSMessage = require('../../../src/ropewiki/sqs/sendMapDataSQSMessage').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockListRopewikiMapDataReprocessTargets.mockResolvedValue([]);
        mockSendMapDataSQSMessage.mockResolvedValue(undefined);
    });

    it('lists targets with onlyStored true when downloadSource defaults false, sends one SQS per row', async () => {
        mockListRopewikiMapDataReprocessTargets.mockResolvedValue([
            { routeId: 'r1', pageId: 'p1', mapDataId: 'm1' },
            { routeId: 'r2', pageId: 'p2', mapDataId: 'm2' },
        ]);

        const result = await reprocessMapData();

        expect(mockListRopewikiMapDataReprocessTargets).toHaveBeenCalledWith(
            mockClient,
            true,
            undefined,
        );
        expect(mockSendMapDataSQSMessage).toHaveBeenCalledTimes(2);
        const first = mockSendMapDataSQSMessage.mock.calls[0]![0] as RopewikiRoute;
        const second = mockSendMapDataSQSMessage.mock.calls[1]![0] as RopewikiRoute;
        expect(first).toEqual(new RopewikiRoute('r1', 'p1', 'm1'));
        expect(second).toEqual(new RopewikiRoute('r2', 'p2', 'm2'));
        expect(mockSendMapDataSQSMessage.mock.calls[0]![1]).toBe(false);
        expect(mockSendMapDataSQSMessage.mock.calls[0]![2]).toBe(false);
        expect(mockSendMapDataSQSMessage.mock.calls[1]![1]).toBe(false);
        expect(mockSendMapDataSQSMessage.mock.calls[1]![2]).toBe(false);
        expect(mockSendMapDataSQSMessage.mock.calls[0]![3]).toBe(true);
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.enqueuedCount).toBe(2);
        expect(body.downloadSource).toBe(false);
        expect(body.cleanOutlierPoints).toBe(false);
        expect(body.processRelevantContext).toBe(true);
    });

    it('passes onlyStored false when downloadSource true', async () => {
        mockListRopewikiMapDataReprocessTargets.mockResolvedValue([
            { routeId: 'r1', pageId: 'p1', mapDataId: 'm1' },
        ]);

        await reprocessMapData({ body: JSON.stringify({ downloadSource: true }) });

        expect(mockListRopewikiMapDataReprocessTargets).toHaveBeenCalledWith(
            mockClient,
            false,
            undefined,
        );
        expect(mockSendMapDataSQSMessage).toHaveBeenCalledTimes(1);
        expect(mockSendMapDataSQSMessage.mock.calls[0]![0]).toEqual(new RopewikiRoute('r1', 'p1', 'm1'));
        expect(mockSendMapDataSQSMessage.mock.calls[0]![1]).toBe(true);
        expect(mockSendMapDataSQSMessage.mock.calls[0]![2]).toBe(false);
    });

    it('passes includeMapDataIds and cleanOutlierPoints through to list/send', async () => {
        mockListRopewikiMapDataReprocessTargets.mockResolvedValue([
            { routeId: 'r1', pageId: 'p1', mapDataId: SAMPLE_ID },
        ]);

        const result = await reprocessMapData({
            body: JSON.stringify({
                downloadSource: false,
                cleanOutlierPoints: true,
                processRelevantContext: false,
                includeMapDataIds: [SAMPLE_ID],
            }),
        });

        expect(mockListRopewikiMapDataReprocessTargets).toHaveBeenCalledWith(
            mockClient,
            true,
            [SAMPLE_ID],
        );
        expect(mockSendMapDataSQSMessage.mock.calls[0]![1]).toBe(false);
        expect(mockSendMapDataSQSMessage.mock.calls[0]![2]).toBe(true);
        expect(mockSendMapDataSQSMessage.mock.calls[0]![3]).toBe(false);
        const body = JSON.parse(result.body);
        expect(body.cleanOutlierPoints).toBe(true);
        expect(body.processRelevantContext).toBe(false);
        expect(body.includeMapDataIds).toEqual([SAMPLE_ID]);
        expect(body.enqueuedCount).toBe(1);
    });

    it('returns 400 on invalid event body', async () => {
        const result = await reprocessMapData({ body: JSON.stringify({ downloadSource: 1 }) });
        expect(result.statusCode).toBe(400);
        expect(mockListRopewikiMapDataReprocessTargets).not.toHaveBeenCalled();
    });

    it('returns 500 when send fails', async () => {
        mockListRopewikiMapDataReprocessTargets.mockResolvedValue([
            { routeId: 'r1', pageId: 'p1', mapDataId: 'm1' },
        ]);
        mockSendMapDataSQSMessage.mockRejectedValue(new Error('SQS down'));

        const result = await reprocessMapData();
        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body).error).toContain('SQS down');
        expect(consoleErrorSpy).toHaveBeenCalled();
    });
});
