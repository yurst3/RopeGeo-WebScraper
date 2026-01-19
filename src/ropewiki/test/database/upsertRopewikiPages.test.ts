import { Pool } from 'pg';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import upsertPages from '../../database/upsertPages';
import RopewikiPage from '../../types/page';

describe('upsertPages (integration)', () => {
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

    it('inserts a net new page', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const pageInfo = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['728'],
                name: ['Bear Creek Canyon'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Bear_Creek_Canyon'],
                rating: ['4.5'],
                quality: [8],
                coordinates: [{ lat: 40.123, lon: -111.456 }],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        const results = await upsertPages(conn, [pageInfo]);

        // Verify an array with one result was returned
        expect(results).toHaveLength(1);
        const result = results[0]!;
        expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(result.pageid).toBe('728');
        expect(result.name).toBe('Bear Creek Canyon');
        expect(result.latestRevisionDate).toEqual(latestRevisionDate);

        const rows = await db.select('RopewikiPage', { pageId: '728' }).run(conn);
        expect(rows).toHaveLength(1);

        const page = rows[0] as s.RopewikiPage.JSONSelectable;
        expect(page.id).toBe(result.id);
        expect(page.pageId).toBe('728');
        expect(page.name).toBe('Bear Creek Canyon');
        expect(page.region).toBe(testRegionId);
        expect(page.url).toBe('https://ropewiki.com/Bear_Creek_Canyon');
        expect(page.rating).toBe('4.5');
        expect(page.quality).toBe(8);
        expect(page.coordinates).toEqual({ lat: 40.123, lon: -111.456 });
        expect(new Date(page.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());
    });

    it('updates an existing page via upsert and returns the existing UUID', async () => {
        const initialRevisionDate = new Date('2025-01-01T00:00:00Z');
        const updatedRevisionDate = new Date('2025-01-03T14:20:10Z');

        // First, insert a page
        const initialPageInfo = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['5597'],
                name: ['Regions'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Regions'],
                rating: ['3.0'],
                latestRevisionDate: [{ timestamp: String(Math.floor(initialRevisionDate.getTime() / 1000)), raw: '2025-01-01T00:00:00Z' }],
            },
        }, regionNameIds);

        const initialResults = await upsertPages(conn, [initialPageInfo]);
        
        // Verify the initial insert returned an array with one result
        expect(initialResults).toHaveLength(1);
        const initialId = initialResults[0]!.id;
        expect(initialId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        // Verify the page was inserted with the expected ID
        const initialRows = await db.select('RopewikiPage', { pageId: '5597' }).run(conn);
        expect(initialRows).toHaveLength(1);
        expect(initialRows[0]?.id).toBe(initialId);

        // Now update the same page with new data
        const updatedPageInfo = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['5597'],
                name: ['Regions Updated'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Regions_Updated'],
                rating: ['4.0'],
                quality: [9],
                technicalRating: ['5.10'],
                latestRevisionDate: [{ timestamp: String(Math.floor(updatedRevisionDate.getTime() / 1000)), raw: '2025-01-03T14:20:10Z' }],
            },
        }, regionNameIds);

        const updatedResults = await upsertPages(conn, [updatedPageInfo]);

        // Should return an array with one result containing the existing UUID, not a new one
        expect(updatedResults).toHaveLength(1);
        const resultId = updatedResults[0]!.id;
        expect(resultId).toBe(initialId);

        const rows = await db.select('RopewikiPage', { pageId: '5597' }).run(conn);
        expect(rows).toHaveLength(1);

        const page = rows[0] as s.RopewikiPage.JSONSelectable;
        expect(page.id).toBe(initialId);
        expect(page.pageId).toBe('5597');
        expect(page.name).toBe('Regions Updated');
        expect(page.url).toBe('https://ropewiki.com/Regions_Updated');
        expect(page.rating).toBe('4.0');
        expect(page.quality).toBe(9);
        expect(page.technicalRating).toBe('5.10');
        expect(new Date(page.latestRevisionDate).toISOString()).toBe(updatedRevisionDate.toISOString());
    });

    it('sets deletedAt to null when upserting', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const pageInfo = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['8888'],
                name: ['Deleted Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Deleted_Page'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);

        // Insert a page with deletedAt set
        const initialResults = await upsertPages(conn, [pageInfo]);
        const pageId = initialResults[0]!.id;
        await db
            .update('RopewikiPage', { deletedAt: '2025-01-01T00:00:00' as db.TimestampString }, { id: pageId })
            .run(conn);

        // Verify deletedAt is set
        const beforeRows = await db.select('RopewikiPage', { id: pageId }).run(conn);
        expect(beforeRows[0]?.deletedAt).not.toBeNull();

        // Upsert the page
        const updatedPageInfo = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['8888'],
                name: ['Restored Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Restored_Page'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-02T12:34:56Z' }],
            },
        }, regionNameIds);
        await upsertPages(conn, [updatedPageInfo]);

        // Verify deletedAt is now null
        const afterRows = await db.select('RopewikiPage', { id: pageId }).run(conn);
        expect(afterRows).toHaveLength(1);
        const page = afterRows[0] as s.RopewikiPage.JSONSelectable;
        expect(page.deletedAt).toBeNull();
        expect(page.name).toBe('Restored Page');
    });

    it('propagates errors from the database layer', async () => {
        const latestRevisionDate = new Date('2025-01-04T10:00:00Z');
        const pageInfo = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['9999'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Test_Page'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-04T10:00:00Z' }],
            },
        }, regionNameIds);

        // Use a client with a non-existent database to force an error
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_upsert_page',
        });

        await expect(upsertPages(badPool, [pageInfo])).rejects.toBeDefined();

        await badPool.end();
    });
});

