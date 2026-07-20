import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { getPagesNeedingAuthors } from '../../../../src/fargate-tasks/backfillAttribution/database/getPagesNeedingAuthors';

describe('getPagesNeedingAuthors (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const regionId = 'a1000001-0001-4000-8000-000000000001';
    const needingId = 'a2000001-0001-4000-8000-000000000001';
    const hasAuthorsId = 'a2000002-0002-4000-8000-000000000002';
    const deletedId = 'a2000003-0003-4000-8000-000000000003';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.vals([needingId, hasAuthorsId, deletedId])})`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Backfill Pages Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Backfill_Pages_Region',
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.vals([needingId, hasAuthorsId, deletedId])})`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    it('returns only non-deleted pages with null authors', async () => {
        await db
            .insert('RopewikiPage', [
                {
                    id: needingId,
                    externalPageId: 'bf-page-need',
                    name: 'Need Authors',
                    region: regionId,
                    url: 'https://ropewiki.com/Need_Authors',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    quality: 1,
                    userVotes: 1,
                    authors: null,
                },
                {
                    id: hasAuthorsId,
                    externalPageId: 'bf-page-has',
                    name: 'Has Authors',
                    region: regionId,
                    url: 'https://ropewiki.com/Has_Authors',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    quality: 1,
                    userVotes: 1,
                    authors: ['Alice'],
                },
                {
                    id: deletedId,
                    externalPageId: 'bf-page-del',
                    name: 'Deleted',
                    region: regionId,
                    url: 'https://ropewiki.com/Deleted',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    quality: 1,
                    userVotes: 1,
                    authors: null,
                    deletedAt: new Date(),
                },
            ])
            .run(conn);

        const rows = await getPagesNeedingAuthors(conn);
        const ids = rows.map((r) => r.id);
        expect(ids).toContain(needingId);
        expect(ids).not.toContain(hasAuthorsId);
        expect(ids).not.toContain(deletedId);
    });
});
