import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import getRegionCountsUnderLimit from '../../../src/ropewiki/util/getRegionsUnderLimit';
import getRegion from '../../../src/ropewiki/database/getRegion';
import getChildRegions from '../../../src/ropewiki/database/getChildRegions';
import { RopewikiRegion } from '../../../src/ropewiki/types/region';
import * as db from 'zapatos/db';

// Mock the dependencies
jest.mock('../../../src/ropewiki/database/getRegion');
jest.mock('../../../src/ropewiki/database/getChildRegions');

const mockGetRegion = getRegion as jest.MockedFunction<typeof getRegion>;
const mockGetChildRegions = getChildRegions as jest.MockedFunction<typeof getChildRegions>;

// Helper function to create mock RopewikiRegion objects
const createMockRegion = (name: string, pageCount: number, parentRegion?: string, id?: string): RopewikiRegion => {
    return new RopewikiRegion(
        name,
        parentRegion,
        pageCount,
        0,
        undefined,
        [],
        false,
        false,
        new Date('2025-01-01'),
        `https://ropewiki.com/${name.replace(/ /g, '_')}`,
        id ?? `mock-id-${name}`,
    );
};

describe('getRegionCountsUnderLimit', () => {
    const mockConn = {} as db.Queryable;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns root region when it has pageCount under the limit', async () => {
        const worldRegion = createMockRegion('World', 50);
        mockGetRegion.mockResolvedValue(worldRegion);

        const result = await getRegionCountsUnderLimit(mockConn, 'World', 100);

        expect(result).toHaveLength(1);
        expect(result[0]?.name).toBe('World');
        expect(result[0]?.pageCount).toBe(50);
        expect(mockGetRegion).toHaveBeenCalledTimes(1);
        expect(mockGetRegion).toHaveBeenCalledWith(mockConn, 'World');
        expect(mockGetChildRegions).not.toHaveBeenCalled();
    });

    it('returns children when root region exceeds limit but children are under limit', async () => {
        const worldRegion = createMockRegion('World', 500); // Over limit
        const africaRegion = createMockRegion('Africa', 50, 'World');
        const asiaRegion = createMockRegion('Asia', 75, 'World');
        const europeRegion = createMockRegion('Europe', 30, 'World');

        mockGetRegion.mockResolvedValueOnce(worldRegion);
        mockGetChildRegions.mockResolvedValue([africaRegion, asiaRegion, europeRegion]);

        const result = await getRegionCountsUnderLimit(mockConn, 'World', 100);

        expect(result).toHaveLength(3);
        expect(result.map(r => r.name)).toContain('Africa');
        expect(result.map(r => r.name)).toContain('Asia');
        expect(result.map(r => r.name)).toContain('Europe');
        expect(result.find(r => r.name === 'Africa')?.pageCount).toBe(50);
        expect(result.find(r => r.name === 'Asia')?.pageCount).toBe(75);
        expect(result.find(r => r.name === 'Europe')?.pageCount).toBe(30);
        expect(mockGetRegion).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledWith(mockConn, 'World');
    });

    it('returns grandchildren when root region and children exceed limit', async () => {
        const worldRegion = createMockRegion('World', 500); // Over limit
        const africaRegion = createMockRegion('Africa', 200, 'World'); // Over limit
        const asiaRegion = createMockRegion('Asia', 50, 'World'); // Under limit
        const kenyaRegion = createMockRegion('Kenya', 30, 'Africa');
        const egyptRegion = createMockRegion('Egypt', 40, 'Africa');

        mockGetRegion.mockResolvedValueOnce(worldRegion);
        mockGetChildRegions
            .mockResolvedValueOnce([africaRegion, asiaRegion]) // Children of World
            .mockResolvedValueOnce([kenyaRegion, egyptRegion]); // Children of Africa

        const result = await getRegionCountsUnderLimit(mockConn, 'World', 100);

        expect(result).toHaveLength(3);
        expect(result.map(r => r.name)).toContain('Asia');
        expect(result.map(r => r.name)).toContain('Kenya');
        expect(result.map(r => r.name)).toContain('Egypt');
        expect(result.find(r => r.name === 'Asia')?.pageCount).toBe(50);
        expect(result.find(r => r.name === 'Kenya')?.pageCount).toBe(30);
        expect(result.find(r => r.name === 'Egypt')?.pageCount).toBe(40);
        expect(mockGetRegion).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledTimes(2);
        expect(mockGetChildRegions).toHaveBeenNthCalledWith(1, mockConn, 'World');
        expect(mockGetChildRegions).toHaveBeenNthCalledWith(2, mockConn, 'Africa');
    });

    it('throws an error when a region with no children exceeds the limit', async () => {
        const worldRegion = createMockRegion('World', 500); // Over limit

        mockGetRegion.mockResolvedValue(worldRegion);
        mockGetChildRegions.mockResolvedValue([]); // No children

        await expect(getRegionCountsUnderLimit(mockConn, 'World', 100)).rejects.toThrow(
            'A region without any children exceeds the limit of 100'
        );

        expect(mockGetRegion).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledWith(mockConn, 'World');
    });

    it('throws an error when root region is not found', async () => {
        mockGetRegion.mockResolvedValue(undefined);

        await expect(getRegionCountsUnderLimit(mockConn, 'NonExistent', 100)).rejects.toThrow(
            'Region not found: NonExistent'
        );

        expect(mockGetRegion).toHaveBeenCalledTimes(1);
        expect(mockGetRegion).toHaveBeenCalledWith(mockConn, 'NonExistent');
        expect(mockGetChildRegions).not.toHaveBeenCalled();
    });

    it('throws an error when limit is less than or equal to 0', async () => {
        await expect(getRegionCountsUnderLimit(mockConn, 'World', 0)).rejects.toThrow(
            'Limit must be greater than 0'
        );

        await expect(getRegionCountsUnderLimit(mockConn, 'World', -1)).rejects.toThrow(
            'Limit must be greater than 0'
        );

        expect(mockGetRegion).not.toHaveBeenCalled();
        expect(mockGetChildRegions).not.toHaveBeenCalled();
    });

    it('propagates errors from getRegion()', async () => {
        const regionError = new Error('Database error');
        mockGetRegion.mockRejectedValue(regionError);

        await expect(getRegionCountsUnderLimit(mockConn, 'World', 100)).rejects.toThrow('Database error');

        expect(mockGetRegion).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).not.toHaveBeenCalled();
    });

    it('propagates errors from getChildRegions()', async () => {
        const worldRegion = createMockRegion('World', 500); // Over limit

        mockGetRegion.mockResolvedValue(worldRegion);
        const childRegionsError = new Error('Database connection failed');
        mockGetChildRegions.mockRejectedValue(childRegionsError);

        await expect(getRegionCountsUnderLimit(mockConn, 'World', 100)).rejects.toThrow('Database connection failed');

        expect(mockGetRegion).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledTimes(1);
        expect(mockGetChildRegions).toHaveBeenCalledWith(mockConn, 'World');
    });
});
