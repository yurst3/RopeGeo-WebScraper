import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { PageDataSource } from 'ropegeo-common/models';
import upsertRelevantContext from '../../../src/map-data/database/upsertRelevantContext';
import getLegendItemIdsCompletedForJob from '../../../src/map-data/database/getLegendItemIdsCompletedForJob';
import softDeleteRelevantContextNotInLegend from '../../../src/map-data/database/softDeleteRelevantContextNotInLegend';
import getRelevantContextJobById from '../../../src/map-data/database/getRelevantContextJobById';
import setRelevantContextJobError from '../../../src/map-data/database/setRelevantContextJobError';
import deleteRelevantContextJob from '../../../src/map-data/database/deleteRelevantContextJob';

describe('relevant context jobId checkpointing (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;

    const mapDataId = 'cccccccc-dddd-4eee-ffff-000000000001';
    const pageId = 'cccccccc-dddd-4eee-ffff-000000000002';
    let jobId: string;

    beforeAll(async () => {
        await db.sql`DELETE FROM "MapDataRelevantContext"`.run(conn);
        await db.sql`DELETE FROM "MapDataRelevantContextJob"`.run(conn);
        await db.sql`DELETE FROM "MapData" WHERE id = ${db.param(mapDataId)}::uuid`.run(conn);
        await db
            .insert('MapData', {
                id: mapDataId,
                sourceFileUrl: 'https://example.com/checkpoint.gpx',
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
        await db.sql`DELETE FROM "MapDataRelevantContext"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "MapDataRelevantContext"`.run(conn);
        await db.sql`DELETE FROM "MapDataRelevantContextJob"`.run(conn);
        await db.sql`DELETE FROM "MapData" WHERE id = ${db.param(mapDataId)}::uuid`.run(conn);
        await pool.end();
    });

    it('upserts jobId and lists completed legend items for that job only', async () => {
        await upsertRelevantContext(conn, mapDataId, 'legend-a', jobId, {
            measurements: null,
            betaSectionExcerpts: null,
            images: null,
        });
        await upsertRelevantContext(conn, mapDataId, 'legend-b', jobId, {
            measurements: null,
            betaSectionExcerpts: null,
            images: null,
        });

        const completed = await getLegendItemIdsCompletedForJob(conn, mapDataId, jobId);
        expect(completed).toEqual(new Set(['legend-a', 'legend-b']));

        const otherJob = await getLegendItemIdsCompletedForJob(
            conn,
            mapDataId,
            'dddddddd-eeee-4fff-aaaa-111111111111',
        );
        expect(otherJob.size).toBe(0);
    });

    it('soft-deletes rows with a different jobId on finalize', async () => {
        const otherJob = await db
            .insert('MapDataRelevantContextJob', {
                mapDataId,
                pageId: 'cccccccc-dddd-4eee-ffff-000000000099',
                pageSource: PageDataSource.Ropewiki,
                pageReady: true,
            })
            .run(conn);

        await upsertRelevantContext(conn, mapDataId, 'legend-keep', jobId, {
            measurements: null,
            betaSectionExcerpts: null,
            images: null,
        });
        await upsertRelevantContext(conn, mapDataId, 'legend-stale', otherJob.id, {
            measurements: null,
            betaSectionExcerpts: null,
            images: null,
        });
        await upsertRelevantContext(conn, mapDataId, 'legend-removed', jobId, {
            measurements: null,
            betaSectionExcerpts: null,
            images: null,
        });

        await softDeleteRelevantContextNotInLegend(conn, mapDataId, jobId, ['legend-keep']);

        const active = await db
            .select('MapDataRelevantContext', {
                mapDataId,
                deletedAt: db.conditions.isNull,
            })
            .run(conn);

        expect(active.map((row) => row.legendItemId).sort()).toEqual(['legend-keep']);

        await db.deletes('MapDataRelevantContextJob', { id: otherJob.id }).run(conn);
    });

    it('soft-deletes all context rows when legendItemIds is empty', async () => {
        await upsertRelevantContext(conn, mapDataId, 'legend-a', jobId, {
            measurements: null,
            betaSectionExcerpts: null,
            images: null,
        });

        await softDeleteRelevantContextNotInLegend(conn, mapDataId, jobId, []);

        const active = await db
            .select('MapDataRelevantContext', {
                mapDataId,
                deletedAt: db.conditions.isNull,
            })
            .run(conn);
        expect(active).toHaveLength(0);
    });

    it('reads, errors, and deletes relevance jobs', async () => {
        const loaded = await getRelevantContextJobById(conn, jobId);
        expect(loaded?.id).toBe(jobId);

        await setRelevantContextJobError(conn, jobId, 'gateway timeout');
        const errored = await getRelevantContextJobById(conn, jobId);
        expect(errored?.errorMessage).toBe('gateway timeout');

        await deleteRelevantContextJob(conn, jobId);
        expect(await getRelevantContextJobById(conn, jobId)).toBeUndefined();

        // Restore job for afterEach cleanup / later tests in this file use afterEach wipe
        const restored = await db
            .insert('MapDataRelevantContextJob', {
                mapDataId,
                pageId,
                pageSource: PageDataSource.Ropewiki,
                pageReady: true,
            })
            .run(conn);
        jobId = restored.id;
    });
});
