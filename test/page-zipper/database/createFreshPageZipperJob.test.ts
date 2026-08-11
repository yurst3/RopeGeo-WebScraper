import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterAll, beforeAll, afterEach, jest } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';
import createFreshPageZipperJob from '../../../src/page-zipper/database/createFreshPageZipperJob';
import getPageZipperJobById from '../../../src/page-zipper/database/getPageZipperJobById';
import deletePageZipperJob from '../../../src/page-zipper/database/deletePageZipperJob';
import deleteAllPageZipperJobs from '../../../src/page-zipper/database/deleteAllPageZipperJobs';
import PageZipperJob from '../../../src/page-zipper/types/pageZipperJob';

jest.mock('../../../src/page-zipper/sqs/tryEnqueuePageZipperJob', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}));

const tryEnqueuePageZipperJob = require('../../../src/page-zipper/sqs/tryEnqueuePageZipperJob')
    .default as jest.MockedFunction<
    typeof import('../../../src/page-zipper/sqs/tryEnqueuePageZipperJob').default
>;

describe('PageZipperJob database helpers (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const pageId = 'f3000002-0002-4000-8000-000000000002';
    const pageId2 = 'f3000003-0003-4000-8000-000000000003';

    beforeAll(async () => {
        await db.sql`DELETE FROM "PageZipperJob" WHERE "pageId" IN (${db.param(pageId)}::uuid, ${db.param(pageId2)}::uuid)`.run(conn);
    });

    afterEach(async () => {
        jest.clearAllMocks();
        await db.sql`DELETE FROM "PageZipperJob" WHERE "pageId" IN (${db.param(pageId)}::uuid, ${db.param(pageId2)}::uuid)`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "PageZipperJob" WHERE "pageId" IN (${db.param(pageId)}::uuid, ${db.param(pageId2)}::uuid)`.run(conn);
        await pool.end();
    });

    it('createFreshPageZipperJob replaces any existing job and enqueues when ready', async () => {
        const first = await createFreshPageZipperJob(conn, {
            pageId,
            pageSource: PageDataSource.Ropewiki,
            pageReady: true,
            imageDataReady: {},
            pageHasMapData: false,
            mapDataLegendItemsReady: {},
        });
        expect(first).toBeInstanceOf(PageZipperJob);
        expect(tryEnqueuePageZipperJob).toHaveBeenCalledWith(first);

        const second = await createFreshPageZipperJob(conn, {
            pageId,
            pageReady: true,
            imageDataReady: {},
            pageHasMapData: false,
            mapDataLegendItemsReady: {},
        });
        expect(second.id).not.toBe(first.id);

        const byOldId = await getPageZipperJobById(conn, first.id);
        expect(byOldId).toBeUndefined();
        const byNewId = await getPageZipperJobById(conn, second.id);
        expect(byNewId?.pageId).toBe(pageId);
    });

    it('createFreshPageZipperJob skips enqueue when not ready', async () => {
        const job = await createFreshPageZipperJob(conn, {
            pageId,
            pageReady: false,
            imageDataReady: {},
        });
        expect(job.readyToEnqueueMessage()).toBe(false);
        expect(tryEnqueuePageZipperJob).not.toHaveBeenCalled();
    });

    it('deletePageZipperJob removes by id', async () => {
        const job = await createFreshPageZipperJob(conn, {
            pageId,
            pageReady: true,
            imageDataReady: {},
            pageHasMapData: false,
            mapDataLegendItemsReady: {},
        });
        await deletePageZipperJob(conn, job.id);
        await expect(getPageZipperJobById(conn, job.id)).resolves.toBeUndefined();
    });

    it('deleteAllPageZipperJobs removes every row and returns the count', async () => {
        await createFreshPageZipperJob(conn, {
            pageId,
            pageReady: true,
            imageDataReady: {},
            pageHasMapData: false,
            mapDataLegendItemsReady: {},
        });
        await createFreshPageZipperJob(conn, {
            pageId: pageId2,
            pageReady: true,
            imageDataReady: {},
            pageHasMapData: false,
            mapDataLegendItemsReady: {},
        });

        const deleted = await deleteAllPageZipperJobs(conn);
        expect(deleted).toBeGreaterThanOrEqual(2);
        const remaining = await db
            .select('PageZipperJob', {
                pageId: db.conditions.isIn([pageId, pageId2]),
            })
            .run(conn);
        expect(remaining).toEqual([]);
    });
});
