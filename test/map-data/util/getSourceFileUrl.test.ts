import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import getSourceFileUrl from '../../../src/map-data/util/getSourceFileUrl';
import { PageDataSource } from 'ropegeo-common/models';
import * as db from 'zapatos/db';

// Mock the ropewiki database function
jest.mock('../../../src/ropewiki/database/getPageKmlUrl', () => {
    return {
        __esModule: true,
        default: jest.fn(),
    };
});

describe('getSourceFileUrl', () => {
    let mockConn: db.Queryable;
    let mockGetRopewikiPageKmlUrl: jest.MockedFunction<typeof import('../../../src/ropewiki/database/getPageKmlUrl').default>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConn = {} as db.Queryable;
        const getPageKmlUrlModule = require('../../../src/ropewiki/database/getPageKmlUrl');
        mockGetRopewikiPageKmlUrl = getPageKmlUrlModule.default;
    });

    it('returns KML URL for Ropewiki data source when page has KML URL', async () => {
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const kmlUrl = 'https://example.com/page.kml';
        
        mockGetRopewikiPageKmlUrl.mockResolvedValue(kmlUrl);

        const result = await getSourceFileUrl(mockConn, PageDataSource.Ropewiki, pageId);

        expect(result).toBe(kmlUrl);
        expect(mockGetRopewikiPageKmlUrl).toHaveBeenCalledTimes(1);
        expect(mockGetRopewikiPageKmlUrl).toHaveBeenCalledWith(mockConn, pageId);
    });

    it('returns undefined for Ropewiki data source when page has no KML URL', async () => {
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        
        mockGetRopewikiPageKmlUrl.mockResolvedValue(undefined);

        const result = await getSourceFileUrl(mockConn, PageDataSource.Ropewiki, pageId);

        expect(result).toBeUndefined();
        expect(mockGetRopewikiPageKmlUrl).toHaveBeenCalledTimes(1);
        expect(mockGetRopewikiPageKmlUrl).toHaveBeenCalledWith(mockConn, pageId);
    });

    it('returns undefined for Ropewiki data source when page does not exist', async () => {
        const pageId = 'nonexistent-page-id';
        
        mockGetRopewikiPageKmlUrl.mockResolvedValue(undefined);

        const result = await getSourceFileUrl(mockConn, PageDataSource.Ropewiki, pageId);

        expect(result).toBeUndefined();
        expect(mockGetRopewikiPageKmlUrl).toHaveBeenCalledTimes(1);
        expect(mockGetRopewikiPageKmlUrl).toHaveBeenCalledWith(mockConn, pageId);
    });

    it('propagates errors from getRopewikiPageKmlUrl', async () => {
        const pageId = 'd1d9139d-38db-433c-b7cd-a28f79331667';
        const error = new Error('Database error');
        
        mockGetRopewikiPageKmlUrl.mockRejectedValue(error);

        await expect(
            getSourceFileUrl(mockConn, PageDataSource.Ropewiki, pageId),
        ).rejects.toThrow('Database error');
    });
});
