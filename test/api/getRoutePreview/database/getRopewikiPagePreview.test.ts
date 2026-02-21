import { Pool } from 'pg';
import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    afterEach,
} from '@jest/globals';
import * as db from 'zapatos/db';
import { PageDataSource } from '../../../../src/types/pageRoute';
import getRopewikiPagePreview from '../../../../src/api/getRoutePreview/database/getRopewikiPagePreview';
import { RopewikiRoute } from '../../../../src/types/pageRoute';

describe('getRopewikiPagePreview (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegion: null,
                name: 'Utah',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: 'https://ropewiki.com/Utah',
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('returns single PagePreview for RopewikiRoute page', async () => {
        const routeId = '22222222-2222-2222-2222-222222222222';
        const pageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '728',
                name: 'Bear Creek Canyon',
                region: testRegionId,
                url: 'https://ropewiki.com/Bear_Creek_Canyon',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                quality: 4.5,
                userVotes: 12,
                rating: '3A II',
            })
            .run(conn);

        const ropewikiRoute = new RopewikiRoute(routeId, pageId);
        const result = await getRopewikiPagePreview(conn, ropewikiRoute);

        expect(result).toMatchObject({
            id: pageId,
            source: PageDataSource.Ropewiki,
            title: 'Bear Creek Canyon',
            regions: ['Utah'],
            rating: 4.5,
            ratingCount: 12,
            difficulty: '3A II',
        });
        expect(result.imageUrl).toBeNull();
    });

    it('uses first image without betaSection as banner when present', async () => {
        const routeId = '44444444-4444-4444-4444-444444444444';
        const pageId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '100',
                name: 'Page With Banner',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_With_Banner',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        const bannerUrl = 'https://ropewiki.com/images/thumb/banner.jpg';
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:banner.jpg',
                fileUrl: bannerUrl,
                order: 0,
            })
            .run(conn);

        const ropewikiRoute = new RopewikiRoute(routeId, pageId);
        const result = await getRopewikiPagePreview(conn, ropewikiRoute);

        expect(result.imageUrl).toBe(bannerUrl);
    });

    it('throws when RopewikiPage does not exist for page id', async () => {
        const ropewikiRoute = new RopewikiRoute(
            'fc1abf41-5d4c-44d9-ac73-b0849f8255bb',
            '00000000-0000-0000-0000-000000000000',
        );

        await expect(getRopewikiPagePreview(conn, ropewikiRoute)).rejects.toThrow(
            'RopewikiPage not found for id: 00000000-0000-0000-0000-000000000000',
        );
    });
});
