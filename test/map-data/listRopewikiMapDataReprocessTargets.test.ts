import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import { listRopewikiMapDataReprocessTargets } from '../../src/map-data/database/listRopewikiMapDataReprocessTargets';

describe('listRopewikiMapDataReprocessTargets', () => {
    let mockQuery: jest.MockedFunction<PoolClient['query']>;
    let client: PoolClient;

    beforeEach(() => {
        mockQuery = jest.fn().mockResolvedValue({ rows: [] }) as never;
        client = { query: mockQuery } as unknown as PoolClient;
    });

    it('queries with onlyStored flag and null includeMapDataIds when omitted', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ routeId: 'r1', pageId: 'p1', mapDataId: 'm1' }],
        } as never);

        const rows = await listRopewikiMapDataReprocessTargets(client, true);

        expect(rows).toEqual([{ routeId: 'r1', pageId: 'p1', mapDataId: 'm1' }]);
        expect(mockQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = mockQuery.mock.calls[0]!;
        expect(String(sql)).toContain('RopewikiRoute');
        expect(String(sql)).toContain('MapData');
        expect(params).toEqual([true, null]);
    });

    it('passes onlyWithStoredKmlOrGpx false when requested', async () => {
        await listRopewikiMapDataReprocessTargets(client, false);
        expect(mockQuery.mock.calls[0]![1]).toEqual([false, null]);
    });

    it('passes includeMapDataIds when provided', async () => {
        const ids = [
            '0827ba8b-27b3-40dc-8385-06f823dbf535',
            '8e7bb61c-13aa-4679-abba-ed144aa592cb',
        ];
        await listRopewikiMapDataReprocessTargets(client, true, ids);
        expect(mockQuery.mock.calls[0]![1]).toEqual([true, ids]);
        expect(String(mockQuery.mock.calls[0]![0])).toContain('ANY($2::uuid[])');
    });
});
