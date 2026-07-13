import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { PageDataSource } from 'ropegeo-common/models';
import {
    upsertRelevanceContextJobFromMap,
    upsertRelevanceContextJobFromPage,
} from '../../../src/map-data/database/upsertRelevanceContextJob';

jest.mock('../../../src/map-data/sqs/tryEnqueueRelevanceJob', () => ({
    __esModule: true,
    default: jest.fn(),
}));

import tryEnqueueRelevanceJob from '../../../src/map-data/sqs/tryEnqueueRelevanceJob';

const mockTryEnqueue = tryEnqueueRelevanceJob as jest.MockedFunction<typeof tryEnqueueRelevanceJob>;

describe('upsertRelevanceContextJob (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;

    const pageId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
    const mapDataId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';

    beforeAll(async () => {
        await db.sql`DELETE FROM "MapDataRelevantContextJob"`.run(conn);
        await db.sql`DELETE FROM "MapData"`.run(conn);
        await db
            .insert('MapData', {
                id: mapDataId,
                sourceFileUrl: 'https://example.com/source.gpx',
            })
            .run(conn);
    });

    afterEach(async () => {
        mockTryEnqueue.mockClear();
        await db.sql`DELETE FROM "MapDataRelevantContextJob"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "MapDataRelevantContextJob"`.run(conn);
        await db.sql`DELETE FROM "MapData"`.run(conn);
        await pool.end();
    });

    it('does not enqueue when only map side has run', async () => {
        const row = await upsertRelevanceContextJobFromMap(conn, {
            mapDataId,
            pageId,
            pageSource: PageDataSource.Ropewiki,
        });
        expect(row.pageReady).toBe(false);
        expect(row.mapDataId).toBe(mapDataId);
        expect(mockTryEnqueue).toHaveBeenCalledTimes(1);
        expect(mockTryEnqueue.mock.calls[0]![0]!.pageReady).toBe(false);
    });

    it('enqueues when page becomes ready after map side', async () => {
        await upsertRelevanceContextJobFromMap(conn, {
            mapDataId,
            pageId,
            pageSource: PageDataSource.Ropewiki,
        });

        const row = await upsertRelevanceContextJobFromPage(conn, pageId);
        expect(row.pageReady).toBe(true);
        expect(row.mapDataId).toBe(mapDataId);
        expect(mockTryEnqueue).toHaveBeenCalledTimes(2);
        expect(mockTryEnqueue.mock.calls[1]![0]!.pageReady).toBe(true);
        expect(mockTryEnqueue.mock.calls[1]![0]!.mapDataId).toBe(mapDataId);
    });

    it('enqueues when map arrives after page is ready', async () => {
        await upsertRelevanceContextJobFromPage(conn, pageId);

        const row = await upsertRelevanceContextJobFromMap(conn, {
            mapDataId,
            pageId,
            pageSource: PageDataSource.Ropewiki,
        });

        expect(row.pageReady).toBe(true);
        expect(row.mapDataId).toBe(mapDataId);
        expect(mockTryEnqueue).toHaveBeenCalledTimes(2);
    });
});
