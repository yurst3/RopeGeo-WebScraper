import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { PageDataSource } from 'ropegeo-common/models';
import getRelevantContextByMapDataId from '../../../src/map-data/database/getRelevantContextByMapDataId';
import upsertRelevantContext from '../../../src/map-data/database/upsertRelevantContext';

describe('getRelevantContextByMapDataId (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;

    const mapDataId = 'dddddddd-eeee-4fff-aaaa-000000000001';
    const pageId = 'dddddddd-eeee-4fff-aaaa-000000000002';
    let jobId: string;

    beforeAll(async () => {
        await db.sql`DELETE FROM "MapDataRelevantContext" WHERE "mapDataId" = ${db.param(mapDataId)}::uuid`.run(
            conn,
        );
        await db.sql`DELETE FROM "MapDataRelevantContextJob" WHERE "pageId" = ${db.param(pageId)}::uuid`.run(
            conn,
        );
        await db.sql`DELETE FROM "MapData" WHERE id = ${db.param(mapDataId)}::uuid`.run(conn);
        await db
            .insert('MapData', {
                id: mapDataId,
                sourceFileUrl: 'https://example.com/get-context.gpx',
            })
            .run(conn);
        const job = await db
            .insert('MapDataRelevantContextJob', {
                mapDataId,
                pageId,
                pageSource: PageDataSource.Ropewiki,
                pageReady: true,
            })
            .run(conn);
        jobId = job.id;
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "MapDataRelevantContext" WHERE "mapDataId" = ${db.param(mapDataId)}::uuid`.run(
            conn,
        );
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "MapDataRelevantContext" WHERE "mapDataId" = ${db.param(mapDataId)}::uuid`.run(
            conn,
        );
        await db.sql`DELETE FROM "MapDataRelevantContextJob" WHERE "pageId" = ${db.param(pageId)}::uuid`.run(
            conn,
        );
        await db.sql`DELETE FROM "MapData" WHERE id = ${db.param(mapDataId)}::uuid`.run(conn);
        await pool.end();
    });

    it('returns active context and skips soft-deleted rows', async () => {
        await upsertRelevantContext(conn, mapDataId, 'active', jobId, {
            measurements: null,
            betaSectionExcerpts: null,
            images: null,
        });
        await upsertRelevantContext(conn, mapDataId, 'deleted', jobId, {
            measurements: null,
            betaSectionExcerpts: null,
            images: null,
        });
        await db
            .update(
                'MapDataRelevantContext',
                { deletedAt: new Date() },
                { mapDataId, legendItemId: 'deleted' },
            )
            .run(conn);

        const result = await getRelevantContextByMapDataId(conn, mapDataId);
        expect([...result.keys()]).toEqual(['active']);
        expect(result.get('active')).toBeDefined();
    });
});
