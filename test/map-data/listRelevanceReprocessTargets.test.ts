import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { PoolClient } from 'pg';
import { listRelevanceReprocessTargets } from '../../src/map-data/database/listRelevanceReprocessTargets';

describe('listRelevanceReprocessTargets', () => {
    let mockQuery: jest.MockedFunction<PoolClient['query']>;
    let client: PoolClient;

    beforeEach(() => {
        mockQuery = jest.fn().mockResolvedValue({ rows: [] }) as never;
        client = { query: mockQuery } as unknown as PoolClient;
    });

    it('queries with null includeMapDataIds when omitted', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ pageId: 'p1', mapDataId: 'm1' }],
        } as never);

        const rows = await listRelevanceReprocessTargets(client);

        expect(rows).toEqual([{ pageId: 'p1', mapDataId: 'm1' }]);
        expect(mockQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = mockQuery.mock.calls[0]!;
        expect(String(sql)).toContain('DISTINCT ON');
        expect(String(sql)).toContain('ANY($1::uuid[])');
        expect(params).toEqual([null]);
    });

    it('passes includeMapDataIds when provided', async () => {
        const ids = [
            '0827ba8b-27b3-40dc-8385-06f823dbf535',
            '8e7bb61c-13aa-4679-abba-ed144aa592cb',
        ];
        await listRelevanceReprocessTargets(client, ids);
        expect(mockQuery.mock.calls[0]![1]).toEqual([ids]);
    });
});
