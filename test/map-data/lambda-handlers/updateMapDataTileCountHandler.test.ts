import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { updateMapDataTileCountHandler } from '../../../src/map-data/lambda-handlers/updateMapDataTileCountHandler';

let mockGetDatabaseConnection: jest.MockedFunction<
    typeof import('../../../src/helpers/getDatabaseConnection').default
>;
let mockListAllMapDataIds: jest.MockedFunction<
    typeof import('../../../src/map-data/database/listAllMapDataIds').listAllMapDataIds
>;
let mockUpdateMapDataTileCount: jest.MockedFunction<
    typeof import('../../../src/map-data/database/updateMapDataTileCount').updateMapDataTileCount
>;
let mockListAllPbfKeysAndTotalBytes: jest.MockedFunction<
    typeof import('../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes').default
>;

let mockClient: { release: ReturnType<typeof jest.fn> };
let mockPool: { connect: ReturnType<typeof jest.fn>; end: ReturnType<typeof jest.fn> };

jest.mock('../../../src/helpers/getDatabaseConnection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../../src/map-data/database/listAllMapDataIds', () => ({
    listAllMapDataIds: jest.fn(),
}));

jest.mock('../../../src/map-data/database/updateMapDataTileCount', () => ({
    updateMapDataTileCount: jest.fn(),
}));

jest.mock('../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes', () => ({
    __esModule: true,
    default: jest.fn(),
}));

describe('updateMapDataTileCountHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockClient = { release: jest.fn() };
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
            end: jest.fn().mockResolvedValue(undefined),
        };

        mockGetDatabaseConnection = require('../../../src/helpers/getDatabaseConnection').default;
        mockListAllMapDataIds = require('../../../src/map-data/database/listAllMapDataIds').listAllMapDataIds;
        mockUpdateMapDataTileCount =
            require('../../../src/map-data/database/updateMapDataTileCount').updateMapDataTileCount;
        mockListAllPbfKeysAndTotalBytes =
            require('../../../src/api/getMapdataTiles/s3/listAllPbfKeysAndTotalBytes').default;

        mockGetDatabaseConnection.mockResolvedValue(mockPool as never);
        mockListAllMapDataIds.mockResolvedValue(['map-1', 'map-2']);
        mockListAllPbfKeysAndTotalBytes.mockResolvedValue({ keys: ['tiles/map-1/0/0/0.pbf'], totalBytes: 512 });
        mockUpdateMapDataTileCount.mockResolvedValue(undefined);
    });

    it('updates tile counts for each MapData id from S3 listing', async () => {
        const result = await updateMapDataTileCountHandler();

        expect(mockListAllMapDataIds).toHaveBeenCalledWith(mockClient);
        expect(mockListAllPbfKeysAndTotalBytes).toHaveBeenCalledTimes(2);
        expect(mockUpdateMapDataTileCount).toHaveBeenCalledWith(mockClient, 'map-1', 1, 512);
        expect(mockUpdateMapDataTileCount).toHaveBeenCalledWith(mockClient, 'map-2', 1, 512);
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.updatedCount).toBe(2);
        expect(body.errorCount).toBe(0);
    });

    it('returns 207 when some rows fail and continues processing', async () => {
        mockListAllPbfKeysAndTotalBytes
            .mockResolvedValueOnce({ keys: [], totalBytes: 0 })
            .mockRejectedValueOnce(new Error('S3 unavailable'));

        const result = await updateMapDataTileCountHandler();

        expect(result.statusCode).toBe(207);
        const body = JSON.parse(result.body);
        expect(body.updatedCount).toBe(1);
        expect(body.errorCount).toBe(1);
        expect(body.errors[0].mapDataId).toBe('map-2');
    });
});
