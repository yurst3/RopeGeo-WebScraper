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
import getRopewikiPageView from '../../../../src/api/getRopewikiPageView/database/getRopewikiPageView';

describe('getRopewikiPageView (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'aaaaaaaa-bbbb-4e48-99a6-81608cc0051d';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
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
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('returns RopewikiPageView for existing page with minimal data', async () => {
        const pageId = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
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
                riskRating: 'PG13',
                permits: 'No',
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.pageId).toBe('728');
        expect(result!.name).toBe('Bear Creek Canyon');
        expect(result!.url).toBe('https://ropewiki.com/Bear_Creek_Canyon');
        expect(result!.quality).toBe(4.5);
        expect(result!.userVotes).toBe(12);
        expect(result!.difficulty).toMatchObject({ technical: '3', water: 'A', time: 'II', risk: 'PG13' });
        expect(result!.permit).toBe('No');
        expect(result!.aka).toEqual([]);
        expect(result!.months).toEqual([]);
        expect(result!.vehicle).toBeNull();
        expect(result!.rappelLongest).toBeNull();
        expect(result!.shuttleTime).toBeNull();
        expect(result!.overallTime).toBeNull();
        expect(result!.overallLength).toBeNull();
        expect(result!.approachLength).toBeNull();
        expect(result!.approachElevGain).toBeNull();
        expect(result!.descentLength).toBeNull();
        expect(result!.descentElevGain).toBeNull();
        expect(result!.exitLength).toBeNull();
        expect(result!.exitElevGain).toBeNull();
        expect(result!.hikeLength).toBeNull();
        expect(result!.approachTime).toBeNull();
        expect(result!.descentTime).toBeNull();
        expect(result!.exitTime).toBeNull();
        expect(result!.rappelCount).toBeNull();
        expect(result!.jumps).toBeNull();
        expect(result!.regions).toEqual([{ id: testRegionId, name: 'Utah' }]);
        expect(result!.bannerImage).toBeNull();
        expect(result!.betaSections).toEqual([]);
    });

    it('returns null when page does not exist', async () => {
        const result = await getRopewikiPageView(
            conn,
            '00000000-0000-0000-0000-000000000000',
        );

        expect(result).toBeNull();
    });

    it('returns null when page is soft-deleted', async () => {
        const pageId = 'c1c2c3d4-e5f6-7890-abcd-ef1234567890';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '999',
                name: 'Deleted Page',
                region: testRegionId,
                url: 'https://ropewiki.com/Deleted',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                deletedAt: '2025-01-02T00:00:00' as db.TimestampString,
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).toBeNull();
    });

    it('returns banner image when page has image with null betaSection', async () => {
        const pageId = 'd1d2c3d4-e5f6-7890-abcd-ef1234567890';
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
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:banner.jpg',
                fileUrl: 'https://ropewiki.com/images/thumb/banner.jpg',
                order: 0,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.bannerImage).not.toBeNull();
        expect(result!.bannerImage!.url).toBe('https://ropewiki.com/images/thumb/banner.jpg');
        expect(result!.bannerImage!.linkUrl).toBe('https://ropewiki.com/File:banner.jpg');
        expect(result!.bannerImage!.order).toBe(0);
    });

    it('parses rappelInfo for rappelCount min/max and jumps', async () => {
        const pageId = 'e1e2c3d4-e5f6-7890-abcd-ef1234567890';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '101',
                name: 'Page With RappelInfo',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_With_RappelInfo',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rappelInfo: '4-6r+2j',
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.rappelCount).toEqual({ min: 4, max: 6 });
        expect(result!.jumps).toBe(2);
    });

    it('parses rappelInfo single rappel count and +j for one jump', async () => {
        const pageId = 'f1f2c3d4-e5f6-7890-abcd-ef1234567890';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '102',
                name: 'Page Single Rappel',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_Single_Rappel',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rappelInfo: '5r+j',
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.rappelCount).toBe(5);
        expect(result!.jumps).toBe(1);
    });

    it('uses db rappelCount when rappelInfo has no rappel pattern', async () => {
        const pageId = 'a2a3c3d4-e5f6-7890-abcd-ef1234567890';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '103',
                name: 'Page Db RappelCount',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_Db_RappelCount',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rappelCount: 3,
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.rappelCount).toBe(3);
        expect(result!.jumps).toBeNull();
    });

    it('returns length and elevation gain from DB numeric columns', async () => {
        const pageId = 'b2b3c3d4-e5f6-7890-abcd-ef1234567890';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '104',
                name: 'Page With Lengths',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_With_Lengths',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                overallLength: 6.8,
                approachLength: 4,
                approachElevGain: 2700,
                descentLength: 1.8,
                descentElevGain: -1800,
                exitLength: 0.9,
                exitElevGain: -600,
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.overallLength).toBe(6.8);
        expect(result!.approachLength).toBe(4);
        expect(result!.approachElevGain).toBe(2700);
        expect(result!.descentLength).toBe(1.8);
        expect(result!.descentElevGain).toBe(-1800);
        expect(result!.exitLength).toBe(0.9);
        expect(result!.exitElevGain).toBe(-600);
        expect(result!.hikeLength).toBe(6.8);
    });
});
