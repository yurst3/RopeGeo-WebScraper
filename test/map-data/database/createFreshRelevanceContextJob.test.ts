import { describe, it, expect, beforeEach, afterEach, afterAll, jest } from '@jest/globals';
import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { PageDataSource } from 'ropegeo-common/models';
import createFreshRelevanceContextJob from '../../../src/map-data/database/createFreshRelevanceContextJob';

jest.mock('../../../src/map-data/sqs/tryEnqueueRelevanceJob', () => ({
    __esModule: true,
    default: jest.fn(),
}));

import tryEnqueueRelevanceJob from '../../../src/map-data/sqs/tryEnqueueRelevanceJob';

const mockTryEnqueue = tryEnqueueRelevanceJob as jest.MockedFunction<typeof tryEnqueueRelevanceJob>;

describe('createFreshRelevanceContextJob (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;

    const pageId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeee0001';
    const mapDataId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';
    const mapDataId2 = 'bbbbbbbb-cccc-4ddd-eeee-eeeeeeeeeeee';

    beforeEach(async () => {
        mockTryEnqueue.mockClear();
        mockTryEnqueue.mockResolvedValue(undefined);
        await db.sql`DELETE FROM "MapDataRelevantContext"`.run(conn);
        await db.sql`DELETE FROM "MapDataRelevantContextJob"`.run(conn);
        await db.sql`DELETE FROM "MapData" WHERE id IN (${db.param(mapDataId)}::uuid, ${db.param(mapDataId2)}::uuid)`.run(
            conn,
        );
        await db
            .insert('MapData', {
                id: mapDataId,
                sourceFileUrl: 'https://example.com/a.gpx',
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "MapDataRelevantContext"`.run(conn);
        await db.sql`DELETE FROM "MapDataRelevantContextJob"`.run(conn);
        await db.sql`DELETE FROM "MapData" WHERE id IN (${db.param(mapDataId)}::uuid, ${db.param(mapDataId2)}::uuid)`.run(
            conn,
        );
    });

    afterAll(async () => {
        await pool.end();
    });

    it('deletes an existing job and inserts a new id before enqueueing', async () => {
        const first = await db
            .insert('MapDataRelevantContextJob', {
                mapDataId,
                pageId,
                pageSource: PageDataSource.Ropewiki,
                pageReady: true,
            })
            .run(conn);

        await db
            .insert('MapData', {
                id: mapDataId2,
                sourceFileUrl: 'https://example.com/b.gpx',
            })
            .run(conn);

        const fresh = await createFreshRelevanceContextJob(conn, {
            mapDataId: mapDataId2,
            pageId,
        });

        expect(fresh.id).not.toBe(first.id);
        expect(fresh.mapDataId).toBe(mapDataId2);
        expect(fresh.pageReady).toBe(true);
        expect(fresh.errors).toBeNull();
        expect(mockTryEnqueue).toHaveBeenCalledTimes(1);
        expect(mockTryEnqueue.mock.calls[0]![0]!.id).toBe(fresh.id);

        const remaining = await db.select('MapDataRelevantContextJob', { pageId }).run(conn);
        expect(remaining).toHaveLength(1);
        expect(remaining[0]!.id).toBe(fresh.id);
    });
});
