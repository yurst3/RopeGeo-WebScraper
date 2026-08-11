import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterAll, beforeAll, afterEach } from '@jest/globals';
import { PageDataSource } from 'ropegeo-common/models';
import { upsertPageZipperJob } from '../../../src/page-zipper/database/upsertPageZipperJob';
import PageZipperJob from '../../../src/page-zipper/types/pageZipperJob';

describe('upsertPageZipperJob (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const pageId = 'f3000001-0001-4000-8000-000000000001';

    beforeAll(async () => {
        await db.sql`DELETE FROM "PageZipperJob" WHERE "pageId" = ${db.param(pageId)}::uuid`.run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "PageZipperJob" WHERE "pageId" = ${db.param(pageId)}::uuid`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "PageZipperJob" WHERE "pageId" = ${db.param(pageId)}::uuid`.run(conn);
        await pool.end();
    });

    it('inserts a job and returns a PageZipperJob instance', async () => {
        const job = await upsertPageZipperJob(
            conn,
            pageId,
            PageDataSource.Ropewiki,
            true,
            undefined,
            false,
            { img: false },
        );

        expect(job).toBeInstanceOf(PageZipperJob);
        expect(job?.pageId).toBe(pageId);
        expect(job?.pageReady).toBe(true);
        expect(job?.pageHasMapData).toBe(false);
        expect(job?.imageDataReady).toEqual({ img: false });
        expect(job?.mapDataLegendItemsReady).toEqual({});
    });

    it('flips an image key when imageDataReady is seeded', async () => {
        await upsertPageZipperJob(
            conn,
            pageId,
            PageDataSource.Ropewiki,
            true,
            undefined,
            false,
            { img: false },
        );

        const flipped = await upsertPageZipperJob(
            conn,
            pageId,
            PageDataSource.Ropewiki,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            'img',
        );

        expect(flipped?.imageDataReady).toEqual({ img: true });
    });

    it('returns undefined when flipping an image before the map is seeded', async () => {
        const result = await upsertPageZipperJob(
            conn,
            pageId,
            PageDataSource.Ropewiki,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            'img',
        );
        expect(result).toBeUndefined();
    });

    it('flips a legend key when mapDataLegendItemsReady is seeded', async () => {
        await upsertPageZipperJob(
            conn,
            pageId,
            PageDataSource.Ropewiki,
            true,
            null,
            true,
            {},
            { s1: false },
        );

        const flipped = await upsertPageZipperJob(
            conn,
            pageId,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            's1',
        );

        expect(flipped?.mapDataLegendItemsReady).toEqual({ s1: true });
    });
});
