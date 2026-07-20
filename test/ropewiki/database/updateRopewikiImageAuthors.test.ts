import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import * as db from 'zapatos/db';
import updateRopewikiImageAuthors from '../../../src/ropewiki/database/updateRopewikiImageAuthors';

describe('updateRopewikiImageAuthors (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const regionId = 'b1000002-0002-4000-8000-000000000002';
    const pageId = 'b2000002-0002-4000-8000-000000000002';
    const imageId1 = 'b3000001-0001-4000-8000-000000000001';
    const imageId2 = 'b3000002-0002-4000-8000-000000000002';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.vals([imageId1, imageId2])})`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Update Image Authors Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Update_Image_Authors_Region',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                externalPageId: 'update-image-authors',
                name: 'Update Image Authors',
                region: regionId,
                url: 'https://ropewiki.com/Update_Image_Authors',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 1,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', [
                {
                    id: imageId1,
                    ropewikiPage: pageId,
                    linkUrl: 'https://ropewiki.com/File:One.jpg',
                    fileUrl: 'https://ropewiki.com/images/one.jpg',
                    order: 1,
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    authors: null,
                },
                {
                    id: imageId2,
                    ropewikiPage: pageId,
                    linkUrl: 'https://ropewiki.com/File:Two.jpg',
                    fileUrl: 'https://ropewiki.com/images/two.jpg',
                    order: 2,
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    authors: null,
                },
            ])
            .run(conn);
    });

    afterEach(async () => {
        await db.update('RopewikiImage', { authors: null }, { id: imageId1 }).run(conn);
        await db.update('RopewikiImage', { authors: null }, { id: imageId2 }).run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE id IN (${db.vals([imageId1, imageId2])})`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    it('no-ops for empty updates', async () => {
        await updateRopewikiImageAuthors(conn, []);
        const row = await db.selectExactlyOne('RopewikiImage', { id: imageId1 }).run(conn);
        expect(row.authors).toBeNull();
    });

    it('batch-updates authors for multiple images', async () => {
        await updateRopewikiImageAuthors(conn, [
            { id: imageId1, authors: ['Alice'] },
            { id: imageId2, authors: ['Bob'] },
        ]);

        const row1 = await db.selectExactlyOne('RopewikiImage', { id: imageId1 }).run(conn);
        const row2 = await db.selectExactlyOne('RopewikiImage', { id: imageId2 }).run(conn);
        expect(row1.authors).toEqual(['Alice']);
        expect(row2.authors).toEqual(['Bob']);
    });

    it('clears authors to null', async () => {
        await updateRopewikiImageAuthors(conn, [{ id: imageId1, authors: ['Alice'] }]);
        await updateRopewikiImageAuthors(conn, [{ id: imageId1, authors: null }]);
        const row = await db.selectExactlyOne('RopewikiImage', { id: imageId1 }).run(conn);
        expect(row.authors).toBeNull();
    });
});
