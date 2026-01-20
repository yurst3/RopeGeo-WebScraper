import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import getPagesWithCoordinates from '../../../src/ropewiki/database/getPagesWithCoordinates';
import RopewikiPage from '../../../src/ropewiki/types/page';

describe('getPagesWithCoordinates (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    const regionNameIds: {[name: string]: string} = { 'Test Region': testRegionId };

    beforeAll(async () => {
        // Clean tables
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        // Insert a test region (required foreign key)
        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegion: null,
                name: 'Test Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: 'https://ropewiki.com/Test_Region',
            })
            .run(conn);
    });

    afterEach(async () => {
        // Clean between tests
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('returns pages with coordinates for given UUIDs', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create pages with coordinates
        const page1 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                coordinates: [{ lat: 40.123, lon: -111.456 }],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const page2 = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['5597'],
                name: ['Test Page 2'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Test_Page_2'],
                coordinates: [{ lat: 37.7749, lon: -122.4194 }],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert pages
        const dbRow1 = page1.toDbRow();
        const dbRow2 = page2.toDbRow();
        const inserted1 = await db.insert('RopewikiPage', dbRow1).run(conn);
        const inserted2 = await db.insert('RopewikiPage', dbRow2).run(conn);

        const page1Id = inserted1.id;
        const page2Id = inserted2.id;

        // Query for pages with coordinates
        const results = await getPagesWithCoordinates(conn, [page1Id, page2Id]);

        expect(results).toHaveLength(2);
        
        const result1 = results.find(r => r.pageid === '728');
        const result2 = results.find(r => r.pageid === '5597');

        expect(result1).toBeDefined();
        expect(result1!.name).toBe('Bear Creek Canyon');
        expect(result1!.coordinates).toEqual({ lat: 40.123, lon: -111.456 });
        expect(result1!.isValid).toBe(true);

        expect(result2).toBeDefined();
        expect(result2!.name).toBe('Test Page 2');
        expect(result2!.coordinates).toEqual({ lat: 37.7749, lon: -122.4194 });
        expect(result2!.isValid).toBe(true);
    });

    it('filters out pages without coordinates', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page with coordinates
        const pageWithCoords = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Page With Coordinates'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_With_Coordinates'],
                coordinates: [{ lat: 40.123, lon: -111.456 }],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Create page without coordinates
        const pageWithoutCoords = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['5597'],
                name: ['Page Without Coordinates'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_Without_Coordinates'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert pages
        const dbRowWithCoords = pageWithCoords.toDbRow();
        const dbRowWithoutCoords = pageWithoutCoords.toDbRow();
        const insertedWithCoords = await db.insert('RopewikiPage', dbRowWithCoords).run(conn);
        const insertedWithoutCoords = await db.insert('RopewikiPage', dbRowWithoutCoords).run(conn);

        const pageWithCoordsId = insertedWithCoords.id;
        const pageWithoutCoordsId = insertedWithoutCoords.id;

        // Query for pages with coordinates
        const results = await getPagesWithCoordinates(conn, [pageWithCoordsId, pageWithoutCoordsId]);

        expect(results).toHaveLength(1);
        expect(results[0]!.pageid).toBe('728');
        expect(results[0]!.name).toBe('Page With Coordinates');
    });

    it('returns empty array when no UUIDs provided', async () => {
        const results = await getPagesWithCoordinates(conn, []);

        expect(results).toHaveLength(0);
    });

    it('returns empty array when no pages match the UUIDs', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const results = await getPagesWithCoordinates(conn, [nonExistentId]);

        expect(results).toHaveLength(0);
    });

    it('returns empty array when all pages have null coordinates', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page without coordinates
        const page = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Page Without Coordinates'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Page_Without_Coordinates'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert page
        const dbRow = page.toDbRow();
        const inserted = await db.insert('RopewikiPage', dbRow).run(conn);
        const pageId = inserted.id;

        // Query for pages with coordinates
        const results = await getPagesWithCoordinates(conn, [pageId]);

        expect(results).toHaveLength(0);
    });

    it('handles pages with various optional fields', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // Create page with many optional fields
        const page = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Complex Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Complex_Page'],
                coordinates: [{ lat: 40.123, lon: -111.456 }],
                rating: ['5.10a'],
                quality: [3.5],
                rappelCount: [2],
                months: ['January', 'February'],
                aka: ['Alt Name'],
                betaSites: ['http://beta.com'],
                userVotes: [10],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert page
        const dbRow = page.toDbRow();
        const inserted = await db.insert('RopewikiPage', dbRow).run(conn);
        const pageId = inserted.id;

        // Query for pages with coordinates
        const results = await getPagesWithCoordinates(conn, [pageId]);

        expect(results).toHaveLength(1);
        const result = results[0]!;
        expect(result.pageid).toBe('728');
        expect(result.name).toBe('Complex Page');
        expect(result.coordinates).toEqual({ lat: 40.123, lon: -111.456 });
        expect(result.rating).toBe('5.10a');
        expect(result.quality).toBe(3.5);
        expect(result.rappelCount).toBe(2);
        expect(result.months).toEqual(['January', 'February']);
        expect(result.aka).toEqual(['Alt Name']);
        expect(result.betaSites).toEqual(['http://beta.com']);
        expect(result.userVotes).toBe(10);
        expect(result.isValid).toBe(true);
    });
});
