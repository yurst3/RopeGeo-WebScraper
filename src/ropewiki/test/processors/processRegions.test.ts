import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as db from 'zapatos/db';
import processRegions from '../../processors/processRegions';
import { RopewikiRegion } from '../../types/region';

// Mock all dependencies
jest.mock('../../http/getRegions');
jest.mock('../../database/upsertRegions');

import getRegions from '../../http/getRegions';
import upsertRegions from '../../database/upsertRegions';

const mockedGetRegions = getRegions as jest.MockedFunction<typeof getRegions>;
const mockedUpsertRegions = upsertRegions as jest.MockedFunction<typeof upsertRegions>;

describe('processRegions', () => {
    const conn = {} as db.Queryable;

    const mockRegions: RopewikiRegion[] = [
        new RopewikiRegion('World', undefined, 0, 0, undefined, [], false, false, new Date('2025-01-01T00:00:00Z'), undefined, 'id-1'),
        new RopewikiRegion('Africa', 'World', 100, 1, undefined, [], false, false, new Date('2025-01-01T00:00:00Z'), undefined, 'id-2'),
    ];

    const mockUpsertedRegions: RopewikiRegion[] = [
        new RopewikiRegion('World', undefined, 0, 0, undefined, [], false, false, new Date('2025-01-01T00:00:00Z'), undefined, 'id-1'),
        new RopewikiRegion('Africa', 'World', 100, 1, undefined, [], false, false, new Date('2025-01-01T00:00:00Z'), undefined, 'id-2'),
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('successfully fetches and upserts regions', async () => {
        mockedGetRegions.mockResolvedValue(mockRegions);
        mockedUpsertRegions.mockResolvedValue(mockUpsertedRegions);

        const result = await processRegions(conn);

        expect(mockedGetRegions).toHaveBeenCalledTimes(1);
        expect(mockedUpsertRegions).toHaveBeenCalledWith(conn, mockRegions);
        expect(result).toEqual({
            'World': 'id-1',
            'Africa': 'id-2',
        });
        expect(Object.keys(result)).toHaveLength(2);
    });

    it('handles empty regions array', async () => {
        mockedGetRegions.mockResolvedValue([]);
        mockedUpsertRegions.mockResolvedValue([]);

        const result = await processRegions(conn);

        expect(mockedGetRegions).toHaveBeenCalledTimes(1);
        expect(mockedUpsertRegions).toHaveBeenCalledWith(conn, []);
        expect(result).toEqual({});
        expect(Object.keys(result)).toHaveLength(0);
    });

    it('failure - getRegions() throws an error', async () => {
        const error = new Error('Network error');
        mockedGetRegions.mockRejectedValue(error);

        await expect(processRegions(conn)).rejects.toThrow('Network error');
        expect(mockedUpsertRegions).not.toHaveBeenCalled();
    });

    it('failure - upsertRegions() throws an error', async () => {
        const error = new Error('Upsert error');
        mockedGetRegions.mockResolvedValue(mockRegions);
        mockedUpsertRegions.mockRejectedValue(error);

        await expect(processRegions(conn)).rejects.toThrow('Upsert error');
        expect(mockedGetRegions).toHaveBeenCalledTimes(1);
    });

    it('filters out regions without IDs from the mapping', async () => {
        const regionsWithoutId: RopewikiRegion[] = [
            new RopewikiRegion('World', undefined, 0, 0, undefined, [], false, false, new Date('2025-01-01T00:00:00Z'), undefined, 'id-1'),
            new RopewikiRegion('Africa', 'World', 100, 1, undefined, [], false, false, new Date('2025-01-01T00:00:00Z'), undefined, undefined), // No ID
        ];
        const upsertedRegionsWithoutId: RopewikiRegion[] = [
            new RopewikiRegion('World', undefined, 0, 0, undefined, [], false, false, new Date('2025-01-01T00:00:00Z'), undefined, 'id-1'),
            new RopewikiRegion('Africa', 'World', 100, 1, undefined, [], false, false, new Date('2025-01-01T00:00:00Z'), undefined, undefined), // No ID
        ];

        mockedGetRegions.mockResolvedValue(regionsWithoutId);
        mockedUpsertRegions.mockResolvedValue(upsertedRegionsWithoutId);

        const result = await processRegions(conn);

        expect(result).toEqual({
            'World': 'id-1',
        });
        expect(Object.keys(result)).toHaveLength(1);
        expect(result['Africa']).toBeUndefined();
    });
});
