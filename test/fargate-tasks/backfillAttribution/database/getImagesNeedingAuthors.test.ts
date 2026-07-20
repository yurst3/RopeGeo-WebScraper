import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import { getImagesNeedingAuthors } from '../../../../src/fargate-tasks/backfillAttribution/database/getImagesNeedingAuthors';

describe('getImagesNeedingAuthors (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const regionId = 'a1000002-0002-4000-8000-000000000002';
    const pageId = 'a2000010-0010-4000-8000-000000000010';
    const needingId = 'a3000001-0001-4000-8000-000000000001';
    const hasAuthorsId = 'a3000002-0002-4000-8000-000000000002';
    const deletedId = 'a3000003-0003-4000-8000-000000000003';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.vals([needingId, hasAuthorsId, deletedId])})`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Backfill Images Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Backfill_Images_Region',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                externalPageId: 'bf-img-page',
                name: 'Image Page',
                region: regionId,
                url: 'https://ropewiki.com/Image_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.vals([needingId, hasAuthorsId, deletedId])})`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    it('returns only non-deleted images with null authors', async () => {
        await db
            .insert('RopewikiImage', [
                {
                    id: needingId,
                    ropewikiPage: pageId,
                    linkUrl: 'https://ropewiki.com/File:Need.jpg',
                    fileUrl: 'https://ropewiki.com/images/n/need.jpg',
                    order: 1,
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    authors: null,
                },
                {
                    id: hasAuthorsId,
                    ropewikiPage: pageId,
                    linkUrl: 'https://ropewiki.com/File:Has.jpg',
                    fileUrl: 'https://ropewiki.com/images/h/has.jpg',
                    order: 2,
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    authors: ['Bob'],
                },
                {
                    id: deletedId,
                    ropewikiPage: pageId,
                    linkUrl: 'https://ropewiki.com/File:Del.jpg',
                    fileUrl: 'https://ropewiki.com/images/d/del.jpg',
                    order: 3,
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    authors: null,
                    deletedAt: new Date(),
                },
            ])
            .run(conn);

        const rows = await getImagesNeedingAuthors(conn);
        const ids = rows.map((r) => r.id);
        expect(ids).toContain(needingId);
        expect(ids).not.toContain(hasAuthorsId);
        expect(ids).not.toContain(deletedId);
    });
});
