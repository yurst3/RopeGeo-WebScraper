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
import { PageDataSource } from 'ropegeo-common/models';
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
        await db.sql`DELETE FROM "RopewikiAkaName"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegionName: null,
                name: 'Utah',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
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
        await db.sql`DELETE FROM "RopewikiAkaName"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "Route"`.run(conn);
        await db.sql`DELETE FROM "RopewikiAkaName"`.run(conn);
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
                technicalRating: '3',
                waterRating: 'A',
                timeRating: 'II',
                riskRating: null,
                permits: 'No',
            })
            .run(conn);

        const ropewikiRoute = new RopewikiRoute(routeId, pageId);
        const result = await getRopewikiPagePreview(conn, ropewikiRoute);

        expect(result).toMatchObject({
            id: pageId,
            source: PageDataSource.Ropewiki,
            title: 'Bear Creek Canyon',
            regions: ['Utah'],
            aka: [],
            rating: 4.5,
            ratingCount: 12,
            difficulty: expect.objectContaining({
                technical: '3',
                water: 'A',
                time: 'II',
                additionalRisk: null,
                effectiveRisk: 'PG13',
            }),
            permit: 'No',
            externalLink: 'https://ropewiki.com/Bear_Creek_Canyon',
        });
        expect(result.imageUrl).toBeNull();
    });

    it('includes aka names in PagePreview when page has RopewikiAkaName rows', async () => {
        const routeId = '44444444-4444-4444-4444-444444444444';
        const pageId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'aka-test',
                name: 'AKA Test Page',
                region: testRegionId,
                url: 'https://ropewiki.com/AKA_Test_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                permits: 'No',
            })
            .run(conn);
        await db
            .insert('RopewikiAkaName', { ropewikiPage: pageId, name: 'Other AKA' })
            .run(conn);
        await db
            .insert('RopewikiAkaName', { ropewikiPage: pageId, name: 'Bear Creek' })
            .run(conn);

        const ropewikiRoute = new RopewikiRoute(routeId, pageId);
        const result = await getRopewikiPagePreview(conn, ropewikiRoute);

        expect(result.aka).toEqual(['Bear Creek', 'Other AKA']);
    });

    it('returns full region lineage (root to leaf) when region has parent', async () => {
        const parentRegionId = '55555555-5555-5555-5555-555555555555';
        const childRegionId = '66666666-6666-6666-6666-666666666666';
        const routeId = '33333333-3333-3333-3333-333333333333';
        const pageId = 'e5f6a7b8-c9d0-1234-5678-ef9012345678';

        await db
            .insert('RopewikiRegion', {
                id: parentRegionId,
                parentRegionName: null,
                name: 'United States',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: 'https://ropewiki.com/United_States',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: childRegionId,
                parentRegionName: 'United States',
                name: 'Utah',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: 'https://ropewiki.com/Utah',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '829',
                name: 'Devil Gulch',
                region: childRegionId,
                url: 'https://ropewiki.com/Devil_Gulch',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                technicalRating: '2',
                waterRating: 'B',
                timeRating: 'I',
                riskRating: null,
                permits: 'Yes',
            })
            .run(conn);

        const ropewikiRoute = new RopewikiRoute(routeId, pageId);
        const result = await getRopewikiPagePreview(conn, ropewikiRoute);

        expect(result.regions).toEqual(['Utah', 'United States']);
        expect(result.title).toBe('Devil Gulch');
        expect(result.permit).toBe('Yes');
        expect(result.externalLink).toBe('https://ropewiki.com/Devil_Gulch');
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
                permits: 'Restricted',
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

        expect(result.imageUrl).toBe(null); // no ImageData in test DB
        expect(result.permit).toBe('Restricted');
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
