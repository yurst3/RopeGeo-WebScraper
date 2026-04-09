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
        await db.sql`DELETE FROM "ImageData"`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "MapData"`.run(conn);
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
        await db.sql`DELETE FROM "ImageData"`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "MapData"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "ImageData"`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRoute"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "MapData"`.run(conn);
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
        expect(result!.name).toBe('Bear Creek Canyon');
        expect(result!.url).toBe('https://ropewiki.com/Bear_Creek_Canyon');
        expect(result!.quality).toBe(4.5);
        expect(result!.userVotes).toBe(12);
        expect(result!.difficulty).toMatchObject({
            technical: '3',
            water: 'A',
            time: 'II',
            additionalRisk: 'PG13',
            effectiveRisk: 'PG13',
        });
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
        expect(result!.approachTime).toBeNull();
        expect(result!.descentTime).toBeNull();
        expect(result!.exitTime).toBeNull();
        expect(result!.rappelCount).toBeNull();
        expect(result!.jumps).toBeNull();
        expect(result!.regions).toEqual([{ id: testRegionId, name: 'Utah' }]);
        expect(result!.bannerImage).toBeNull();
        expect(result!.betaSections).toEqual([]);
        expect(result!.miniMap).toBeNull();
        expect(result!.coordinates).toBeNull();
    });

    it('returns normalized coordinates when page has valid coordinates json', async () => {
        const pageId = 'f1f2c3d4-e5f6-7890-abcd-ef1234567890';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '800',
                name: 'Geo Page',
                region: testRegionId,
                url: 'https://ropewiki.com/Geo_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                coordinates: { lat: 40.123, lon: -111.456 },
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);
        expect(result).not.toBeNull();
        expect(result!.coordinates).toEqual({ lat: 40.123, lon: -111.456 });
    });

    it('returns null coordinates when stored json is not a usable lat/lon object', async () => {
        const pageId = 'f2f2c3d4-e5f6-7890-abcd-ef1234567890';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: '801',
                name: 'Bad Coords Page',
                region: testRegionId,
                url: 'https://ropewiki.com/Bad',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                coordinates: { lat: 'not-a-number', lon: 10 },
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);
        expect(result).not.toBeNull();
        expect(result!.coordinates).toBeNull();
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
        expect(result!.bannerImage!.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(result!.bannerImage!.bannerUrl).toBeNull(); // no ImageData in test DB
        expect(result!.bannerImage!.fullUrl).toBeNull();
        expect(result!.bannerImage!.linkUrl).toBe('https://ropewiki.com/File:banner.jpg');
        expect(result!.bannerImage!.order).toBe(0);
        expect(result!.bannerImage!.downloadBytes).toBeNull();
    });

    it('returns downloadBytes from ImageData metadata for banner and beta images', async () => {
        const pageId = 'e1e2c3d4-e5f6-7890-abcd-ef1234567801';
        const sectionId = 'e1e2c3d4-e5f6-7890-abcd-ef1234567802';
        const bannerDataId = 'e1e2c3d4-e5f6-7890-abcd-ef1234567803';
        const betaDataId = 'e1e2c3d4-e5f6-7890-abcd-ef1234567804';
        const meta = {
            preview: { sizeKB: 1, dimensions: { width: 10, height: 10 }, orientation: 1 },
            banner: { sizeKB: 2, dimensions: { width: 10, height: 10 }, orientation: 1 },
            full: { sizeKB: 4, dimensions: { width: 10, height: 10 }, orientation: 1 },
            lossless: null,
            source: null,
        };
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'bytes-meta',
                name: 'Page Bytes Meta',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_Bytes_Meta',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('RopewikiBetaSection', {
                id: sectionId,
                ropewikiPage: pageId,
                order: 1,
                title: 'Section',
                text: 'Text',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: bannerDataId,
                previewUrl: 'https://api.example.com/p.avif',
                bannerUrl: 'https://api.example.com/b.avif',
                fullUrl: 'https://api.example.com/f.avif',
                sourceUrl: 'https://ropewiki.com/File:banner_src.jpg',
                metadata: meta as unknown as db.JSONValue,
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: betaDataId,
                bannerUrl: 'https://api.example.com/b2.avif',
                fullUrl: 'https://api.example.com/f2.avif',
                sourceUrl: 'https://ropewiki.com/File:beta_src.jpg',
                metadata: meta as unknown as db.JSONValue,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: null,
                linkUrl: 'https://ropewiki.com/File:banner_row.jpg',
                fileUrl: 'https://ropewiki.com/thumb/banner_row.jpg',
                order: 0,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                processedImage: bannerDataId,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: sectionId,
                linkUrl: 'https://ropewiki.com/File:beta_row.jpg',
                fileUrl: 'https://ropewiki.com/thumb/beta_row.jpg',
                order: 0,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                processedImage: betaDataId,
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.bannerImage!.downloadBytes!.preview).toBe(1024);
        expect(result!.bannerImage!.downloadBytes!.banner).toBe(2048);
        expect(result!.bannerImage!.downloadBytes!.full).toBe(4096);
        expect(result!.betaSections[0]!.images[0]!.downloadBytes!.preview).toBe(0);
        expect(result!.betaSections[0]!.images[0]!.downloadBytes!.banner).toBe(2048);
        expect(result!.betaSections[0]!.images[0]!.downloadBytes!.full).toBe(4096);
    });

    it('returns beta section images even when processed image is missing', async () => {
        const pageId = 'f0f0c3d4-e5f6-7890-abcd-ef1234567801';
        const sectionId = 'f0f0c3d4-e5f6-7890-abcd-ef1234567802';
        const imageDataId = 'f0f0c3d4-e5f6-7890-abcd-ef1234567803';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'beta-img-filter',
                name: 'Page Beta Images',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_Beta_Images',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('RopewikiBetaSection', {
                id: sectionId,
                ropewikiPage: pageId,
                order: 1,
                title: 'Approach',
                text: 'Hike in',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: imageDataId,
                bannerUrl: 'https://api.webscraper.ropegeo.com/images/processed/banner.avif',
                sourceUrl: 'https://ropewiki.com/File:ok.jpg',
                errorMessage: null,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: sectionId,
                linkUrl: 'https://ropewiki.com/File:unprocessed.jpg',
                fileUrl: 'https://ropewiki.com/thumb/unprocessed.jpg',
                order: 1,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                processedImage: null,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: sectionId,
                linkUrl: 'https://ropewiki.com/File:processed.jpg',
                fileUrl: 'https://ropewiki.com/thumb/processed.jpg',
                order: 2,
                latestRevisionDate: '2025-01-02T00:00:00' as db.TimestampString,
                processedImage: imageDataId,
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.betaSections).toHaveLength(1);
        expect(result!.betaSections[0]!.images).toHaveLength(2);
        expect(result!.betaSections[0]!.images[0]!.bannerUrl).toBeNull();
        expect(result!.betaSections[0]!.images[0]!.fullUrl).toBeNull();
        expect(result!.betaSections[0]!.images[1]!.bannerUrl).toBe(
            'https://api.webscraper.ropegeo.com/images/processed/banner.avif',
        );
        expect(result!.betaSections[0]!.images[1]!.fullUrl).toBeNull();
        expect(result!.betaSections[0]!.images[1]!.linkUrl).toBe(
            'https://ropewiki.com/File:processed.jpg',
        );
        expect(result!.betaSections[0]!.images[1]!.order).toBe(2);
        expect(result!.betaSections[0]!.images[0]!.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(result!.betaSections[0]!.images[1]!.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(result!.betaSections[0]!.images[0]!.downloadBytes).toBeNull();
        expect(result!.betaSections[0]!.images[1]!.downloadBytes).toBeNull();
    });

    it('returns beta image with null urls when section only has unprocessed images', async () => {
        const pageId = 'e0e0c3d4-e5f6-7890-abcd-ef1234567801';
        const sectionId = 'e0e0c3d4-e5f6-7890-abcd-ef1234567802';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'beta-only-null',
                name: 'Page No Processed Beta Imgs',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_No_Processed_Beta',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('RopewikiBetaSection', {
                id: sectionId,
                ropewikiPage: pageId,
                order: 1,
                title: 'Pools',
                text: 'Deep water',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: sectionId,
                linkUrl: 'https://ropewiki.com/File:150_Mile.jpg',
                fileUrl: 'https://ropewiki.com/thumb/150.jpg',
                order: 6,
                caption: 'One of the deeper pools',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                processedImage: null,
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.betaSections[0]!.images).toHaveLength(1);
        expect(result!.betaSections[0]!.images[0]!.bannerUrl).toBeNull();
        expect(result!.betaSections[0]!.images[0]!.fullUrl).toBeNull();
        expect(result!.betaSections[0]!.images[0]!.caption).toBe(
            'One of the deeper pools',
        );
    });

    it('returns beta section image when ImageData has errorMessage', async () => {
        const pageId = 'd0d0c3d4-e5f6-7890-abcd-ef1234567801';
        const sectionId = 'd0d0c3d4-e5f6-7890-abcd-ef1234567802';
        const imageDataId = 'd0d0c3d4-e5f6-7890-abcd-ef1234567803';
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'beta-img-err',
                name: 'Page Beta Image Error',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_Beta_Err',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('RopewikiBetaSection', {
                id: sectionId,
                ropewikiPage: pageId,
                order: 1,
                title: 'Section',
                text: 'Text',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('ImageData', {
                id: imageDataId,
                bannerUrl: 'https://api.example.com/banner.avif',
                sourceUrl: 'https://ropewiki.com/File:bad.jpg',
                errorMessage: 'processing failed',
            })
            .run(conn);
        await db
            .insert('RopewikiImage', {
                ropewikiPage: pageId,
                betaSection: sectionId,
                linkUrl: 'https://ropewiki.com/File:bad.jpg',
                fileUrl: 'https://ropewiki.com/thumb/bad.jpg',
                order: 0,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                processedImage: imageDataId,
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.betaSections[0]!.images).toHaveLength(1);
        expect(result!.betaSections[0]!.images[0]!.bannerUrl).toBe(
            'https://api.example.com/banner.avif',
        );
        expect(result!.betaSections[0]!.images[0]!.fullUrl).toBeNull();
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
    });

    it('returns PageMiniMap from MapData when page has a route with map data', async () => {
        const pageId = 'c2c3c3d4-e5f6-7890-abcd-ef1234567890';
        const mapDataId = '38f5c3fa-7248-41ed-815e-8b9e6aae5d61';
        const routeId = 'd2d3d3d4-e5f6-7890-abcd-ef1234567890';
        const tilesTemplate =
            'https://api.webscraper.ropegeo.com/mapdata/tiles/38f5c3fa-7248-41ed-815e-8b9e6aae5d61/{z}/{x}/{y}.pbf';
        const bounds = { north: 39.5, south: 38.1, east: -108.2, west: -110.0 };

        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'tiles-page',
                name: 'Page With Tiles',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_With_Tiles',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('Route', {
                id: routeId,
                name: 'Trail Route',
                type: 'Canyon',
                coordinates: { lat: 40.1, lon: -111.5 },
            })
            .run(conn);
        await db
            .insert('MapData', {
                id: mapDataId,
                tilesTemplate,
                bounds,
                sourceFileUrl: '',
            })
            .run(conn);
        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageId,
                mapData: mapDataId,
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.miniMap).not.toBeNull();
        expect(result!.miniMap!.layerId).toBe(mapDataId);
        expect(result!.miniMap!.tilesTemplate).toBe(tilesTemplate);
        expect(result!.miniMap!.bounds.north).toBe(bounds.north);
        expect(result!.miniMap!.bounds.south).toBe(bounds.south);
        expect(result!.miniMap!.bounds.east).toBe(bounds.east);
        expect(result!.miniMap!.bounds.west).toBe(bounds.west);
    });

    it('returns miniMap null when page has route but MapData has null tilesTemplate', async () => {
        const pageId = 'e2e3e3d4-e5f6-7890-abcd-ef1234567890';
        const mapDataId = '47f6d4fb-8359-52fe-926f-9c0f7bbf6e72';
        const routeId = 'f2f3f3d4-e5f6-7890-abcd-ef1234567890';
        const bounds = { north: 39.5, south: 38.1, east: -108.2, west: -110.0 };

        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'no-tiles-page',
                name: 'Page No Tiles',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_No_Tiles',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('Route', {
                id: routeId,
                name: 'Route No Tiles',
                type: 'Canyon',
                coordinates: { lat: 40.2, lon: -111.6 },
            })
            .run(conn);
        await db
            .insert('MapData', {
                id: mapDataId,
                tilesTemplate: null,
                bounds,
                sourceFileUrl: '',
            })
            .run(conn);
        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageId,
                mapData: mapDataId,
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.miniMap).toBeNull();
    });

    it('returns miniMap null when page has no route with map data', async () => {
        const pageId = 'f2f3c3d4-e5f6-7890-abcd-ef1234567890';
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
        expect(result!.miniMap).toBeNull();
    });

    it('returns miniMap null when MapData has null bounds', async () => {
        const pageId = 'a3b3c3d4-e5f6-7890-abcd-ef1234567890';
        const mapDataId = '57f6d4fb-8359-52fe-926f-9c0f7bbf6e73';
        const routeId = 'b3f3f3d4-e5f6-7890-abcd-ef1234567890';
        const tilesTemplate =
            'https://api.webscraper.ropegeo.com/mapdata/tiles/57f6d4fb-8359-52fe-926f-9c0f7bbf6e73/{z}/{x}/{y}.pbf';

        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'page-no-bounds',
                name: 'Page No Bounds',
                region: testRegionId,
                url: 'https://ropewiki.com/Page_No_Bounds',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
        await db
            .insert('Route', {
                id: routeId,
                name: 'Route With Tiles No Bounds',
                type: 'Canyon',
                coordinates: { lat: 40.2, lon: -111.6 },
            })
            .run(conn);
        await db
            .insert('MapData', {
                id: mapDataId,
                tilesTemplate,
                bounds: null,
                sourceFileUrl: '',
            })
            .run(conn);
        await db
            .insert('RopewikiRoute', {
                route: routeId,
                ropewikiPage: pageId,
                mapData: mapDataId,
            })
            .run(conn);

        const result = await getRopewikiPageView(conn, pageId);

        expect(result).not.toBeNull();
        expect(result!.miniMap).toBeNull();
    });
});
