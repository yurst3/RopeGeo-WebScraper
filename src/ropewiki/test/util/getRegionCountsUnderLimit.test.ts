import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import getRegionCountsUnderLimit from '../../util/getRegionsUnderLimit';
import getRegionCounts from '../../http/getRegionCounts';
import getChildRegions from '../../database/getChildRegions';
import * as db from 'zapatos/db';

// Mock the dependencies
jest.mock('../http/getRegionCounts');
jest.mock('../database/getChildRegions');

const mockGetRegionCounts = getRegionCounts as jest.MockedFunction<typeof getRegionCounts>;
const mockGetChildRegions = getChildRegions as jest.MockedFunction<typeof getChildRegions>;

describe('getRegionCountsUnderLimit', () => {
    const mockConn = {} as db.Queryable;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns counts when root region has count under the limit', async () => {
        mockGetRegionCounts.mockResolvedValue({
            'World': 50,
        });

        const result = await getRegionCountsUnderLimit(mockConn, 'World', 100);

        expect(result).toEqual({ 'World': 50 });
        expect(mockGetRegionCounts).toHaveBeenCalledTimes(1);
        expect(mockGetRegionCounts).toHaveBeenCalledWith(['World']);
        expect(mockGetChildRegions).not.toHaveBeenCalled();
    });

    it('returns children counts when root region exceeds limit but children are under limit', async () => {
        mockGetRegionCounts
            .mockResolvedValueOnce({
                'World': 500, // Over limit
            })
            .mockResolvedValueOnce({
                'Africa': 50,
                'Asia': 75,
                'Europe': 30,
            });

        mockGetChildRegions.mockResolvedValue(['Africa', 'Asia', 'Europe']);

        const result = await getRegionCountsUnderLimit(mockConn, 'World', 100);

        expect(result).toEqual({
            'Africa': 50,
            'Asia': 75,
            'Europe': 30,
        });
        expect(mockGetRegionCounts).toHaveBeenCalledTimes(2);
        expect(mockGetRegionCounts).toHaveBeenNthCalledWith(1, ['World']);
        expect(mockGetRegionCounts).toHaveBeenNthCalledWith(2, ['Africa', 'Asia', 'Europe']);
        expect(mockGetChildRegions).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledWith(mockConn, 'World');
    });

    it('returns grandchildren counts when root region and children exceed limit', async () => {
        mockGetRegionCounts
            .mockResolvedValueOnce({
                'World': 500, // Over limit
            })
            .mockResolvedValueOnce({
                'Africa': 200, // Over limit
                'Asia': 50, // Under limit
            })
            .mockResolvedValueOnce({
                'Kenya': 30,
                'Egypt': 40,
            });

        mockGetChildRegions
            .mockResolvedValueOnce(['Africa', 'Asia'])
            .mockResolvedValueOnce(['Kenya', 'Egypt']);

        const result = await getRegionCountsUnderLimit(mockConn, 'World', 100);

        expect(result).toEqual({
            'Asia': 50,
            'Kenya': 30,
            'Egypt': 40,
        });
        expect(mockGetRegionCounts).toHaveBeenCalledTimes(3);
        expect(mockGetRegionCounts).toHaveBeenNthCalledWith(1, ['World']);
        expect(mockGetRegionCounts).toHaveBeenNthCalledWith(2, ['Africa', 'Asia']);
        expect(mockGetRegionCounts).toHaveBeenNthCalledWith(3, ['Kenya', 'Egypt']);
        expect(mockGetChildRegions).toHaveBeenCalledTimes(2);
        expect(mockGetChildRegions).toHaveBeenNthCalledWith(1, mockConn, 'World');
        expect(mockGetChildRegions).toHaveBeenNthCalledWith(2, mockConn, 'Africa');
    });

    it('throws an error when a region with no children exceeds the limit', async () => {
        mockGetRegionCounts.mockResolvedValue({
            'World': 500, // Over limit
        });

        mockGetChildRegions.mockResolvedValue([]); // No children

        await expect(getRegionCountsUnderLimit(mockConn, 'World', 100)).rejects.toThrow(
            'A region without any children exceeds the limit of 100'
        );

        expect(mockGetRegionCounts).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledWith(mockConn, 'World');
    });

    it('throws an error when limit is less than or equal to 0', async () => {
        await expect(getRegionCountsUnderLimit(mockConn, 'World', 0)).rejects.toThrow(
            'Limit must be greater than 0'
        );

        await expect(getRegionCountsUnderLimit(mockConn, 'World', -1)).rejects.toThrow(
            'Limit must be greater than 0'
        );

        expect(mockGetRegionCounts).not.toHaveBeenCalled();
        expect(mockGetChildRegions).not.toHaveBeenCalled();
    });

    it('propagates errors from getRegionCounts()', async () => {
        const regionCountsError = new Error('Network error');
        mockGetRegionCounts.mockRejectedValue(regionCountsError);

        await expect(getRegionCountsUnderLimit(mockConn, 'World', 100)).rejects.toThrow('Network error');

        expect(mockGetRegionCounts).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).not.toHaveBeenCalled();
    });

    it('propagates errors from getChildRegions()', async () => {
        mockGetRegionCounts.mockResolvedValue({
            'World': 500, // Over limit
        });

        const childRegionsError = new Error('Region not found: World');
        mockGetChildRegions.mockRejectedValue(childRegionsError);

        await expect(getRegionCountsUnderLimit(mockConn, 'World', 100)).rejects.toThrow('Region not found: World');

        expect(mockGetRegionCounts).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledWith(mockConn, 'World');
    });
});

