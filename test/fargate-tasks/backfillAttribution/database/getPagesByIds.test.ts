import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { getPagesByIds } from '../../../../src/fargate-tasks/backfillAttribution/database/getPagesByIds';

describe('getPagesByIds (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const regionId = 'a1000003-0003-4000-8000-000000000003';
    const pageId = 'a2000020-0020-4000-8000-000000000020';
    const deletedId = 'a2000021-0021-4000-8000-000000000021';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.vals([pageId, deletedId])})`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Backfill ByIds Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Backfill_ByIds_Region',
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.vals([pageId, deletedId])})`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    it('returns empty array for empty ids', async () => {
        expect(await getPagesByIds(conn, [])).toEqual([]);
    });

    it('returns matching non-deleted pages', async () => {
        await db
            .insert('RopewikiPage', [
                {
                    id: pageId,
                    externalPageId: 'bf-byids-ok',
                    name: 'ByIds Ok',
                    region: regionId,
                    url: 'https://ropewiki.com/ByIds_Ok',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    quality: 1,
                    userVotes: 1,
                },
                {
                    id: deletedId,
                    externalPageId: 'bf-byids-del',
                    name: 'ByIds Del',
                    region: regionId,
                    url: 'https://ropewiki.com/ByIds_Del',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    quality: 1,
                    userVotes: 1,
                    deletedAt: new Date(),
                },
            ])
            .run(conn);

        const rows = await getPagesByIds(conn, [pageId, deletedId]);
        expect(rows).toEqual([{ id: pageId, url: 'https://ropewiki.com/ByIds_Ok' }]);
    });
});
