import { Pool } from 'pg';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import upsertBetaSections from '../../../src/ropewiki/database/upsertBetaSections';
import type { RopewikiBetaSection } from '../../../src/ropewiki/types/page';
import RopewikiPage from '../../../src/ropewiki/types/page';
import upsertPages from '../../../src/ropewiki/database/upsertPages';

describe('upsertBetaSections (integration)', () => {
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
    let testPageUuid: string;

    beforeAll(async () => {
        // Clean tables
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
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

        // Insert a test page (required foreign key for beta sections)
        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');
        const pageInfo = RopewikiPage.fromResponseBody({
            printouts: {
                pageid: ['9999'],
                name: ['Test Page'],
                region: [{ fulltext: 'Test Region' }],
                url: ['https://ropewiki.com/Test_Page'],
                latestRevisionDate: [{ timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)), raw: '2025-01-01T00:00:00Z' }],
            },
        }, regionNameIds);
        const results = await upsertPages(conn, [pageInfo], regionNameIds);
        testPageUuid = results[0].id;
    });

    afterEach(async () => {
        // Clean between tests
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('returns empty object when betaSections array is empty', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const betaSections: RopewikiBetaSection[] = [];

        const result = await upsertBetaSections(conn, testPageUuid, betaSections, latestRevisionDate);

        expect(result).toEqual({});

        const rows = await db.select('RopewikiBetaSection', {}).run(conn);
        expect(rows).toHaveLength(0);
    });

    it('inserts net new beta sections', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const betaSections: RopewikiBetaSection[] = [
            { title: 'Introduction', text: 'This is the introduction text.', order: 1 },
            { title: 'Approach', text: 'This is the approach text.', order: 2 },
            { title: 'Descent', text: 'This is the descent text.', order: 3 },
        ];

        const result = await upsertBetaSections(conn, testPageUuid, betaSections, latestRevisionDate);

        // Verify all titles are in the result with valid UUIDs
        expect(Object.keys(result)).toHaveLength(3);
        expect(result).toHaveProperty('Introduction');
        expect(result).toHaveProperty('Approach');
        expect(result).toHaveProperty('Descent');

        // Verify all IDs are valid UUIDs
        expect(result.Introduction).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(result.Approach).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(result.Descent).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        // Verify all IDs are unique
        expect(result.Introduction).not.toBe(result.Approach);
        expect(result.Approach).not.toBe(result.Descent);
        expect(result.Introduction).not.toBe(result.Descent);

        // Verify the beta sections were inserted correctly
        const rows = await db
            .select('RopewikiBetaSection', { ropewikiPage: testPageUuid })
            .run(conn);
        expect(rows).toHaveLength(3);

        const introduction = rows.find((r) => r.title === 'Introduction') as s.RopewikiBetaSection.JSONSelectable;
        const approach = rows.find((r) => r.title === 'Approach') as s.RopewikiBetaSection.JSONSelectable;
        const descent = rows.find((r) => r.title === 'Descent') as s.RopewikiBetaSection.JSONSelectable;

        expect(introduction.id).toBe(result.Introduction);
        expect(introduction.text).toBe('This is the introduction text.');
        expect(introduction.order).toBe(1);
        expect(new Date(introduction.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());

        expect(approach.id).toBe(result.Approach);
        expect(approach.text).toBe('This is the approach text.');
        expect(approach.order).toBe(2);
        expect(new Date(approach.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());

        expect(descent.id).toBe(result.Descent);
        expect(descent.text).toBe('This is the descent text.');
        expect(descent.order).toBe(3);
        expect(new Date(descent.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());
    });

    it('updates existing beta sections via upsert and returns the existing IDs', async () => {
        const initialRevisionDate = new Date('2025-01-01T00:00:00Z');
        const updatedRevisionDate = new Date('2025-01-03T14:20:10Z');

        // First, insert beta sections
        const initialBetaSections: RopewikiBetaSection[] = [
            { title: 'Introduction', text: 'Initial introduction text.', order: 1 },
            { title: 'Approach', text: 'Initial approach text.', order: 2 },
        ];

        const initialResult = await upsertBetaSections(conn, testPageUuid, initialBetaSections, initialRevisionDate);

        // Verify the initial insert returned IDs
        expect(Object.keys(initialResult)).toHaveLength(2);
        expect(initialResult.Introduction).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(initialResult.Approach).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        // Verify the beta sections were inserted
        const initialRows = await db
            .select('RopewikiBetaSection', { ropewikiPage: testPageUuid })
            .run(conn);
        expect(initialRows).toHaveLength(2);
        expect(initialRows.find((r) => r.title === 'Introduction')?.id).toBe(initialResult.Introduction);
        expect(initialRows.find((r) => r.title === 'Approach')?.id).toBe(initialResult.Approach);

        // Now update the same beta sections with new text
        const updatedBetaSections: RopewikiBetaSection[] = [
            { title: 'Introduction', text: 'Updated introduction text.', order: 1 },
            { title: 'Approach', text: 'Updated approach text.', order: 2 },
        ];

        const updatedResult = await upsertBetaSections(conn, testPageUuid, updatedBetaSections, updatedRevisionDate);

        // Should return the same IDs, not new ones
        expect(updatedResult.Introduction).toBe(initialResult.Introduction);
        expect(updatedResult.Approach).toBe(initialResult.Approach);

        // Verify the beta sections were updated
        const updatedRows = await db
            .select('RopewikiBetaSection', { ropewikiPage: testPageUuid })
            .run(conn);
        expect(updatedRows).toHaveLength(2);

        const introduction = updatedRows.find((r) => r.title === 'Introduction') as s.RopewikiBetaSection.JSONSelectable;
        const approach = updatedRows.find((r) => r.title === 'Approach') as s.RopewikiBetaSection.JSONSelectable;

        expect(introduction.id).toBe(initialResult.Introduction);
        expect(introduction.text).toBe('Updated introduction text.');
        expect(introduction.order).toBe(1);
        expect(new Date(introduction.latestRevisionDate).toISOString()).toBe(updatedRevisionDate.toISOString());

        expect(approach.id).toBe(initialResult.Approach);
        expect(approach.text).toBe('Updated approach text.');
        expect(approach.order).toBe(2);
        expect(new Date(approach.latestRevisionDate).toISOString()).toBe(updatedRevisionDate.toISOString());
    });

    it('sets deletedAt to null when upserting', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const betaSections: RopewikiBetaSection[] = [
            { title: 'Deleted Section', text: 'Deleted text.', order: 1 },
        ];

        // Insert a beta section with deletedAt set
        await db
            .insert('RopewikiBetaSection', {
                ropewikiPage: testPageUuid,
                title: 'Deleted Section',
                text: 'Deleted text.',
                order: 1,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                deletedAt: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        // Get the inserted beta section ID
        const insertedRows = await db.select('RopewikiBetaSection', { title: 'Deleted Section', ropewikiPage: testPageUuid }).run(conn);
        const betaSectionId = insertedRows[0]?.id as string;

        // Verify deletedAt is set
        const beforeRows = await db.select('RopewikiBetaSection', { id: betaSectionId }).run(conn);
        expect(beforeRows[0]?.deletedAt).not.toBeNull();

        // Upsert the beta section
        await upsertBetaSections(conn, testPageUuid, betaSections, latestRevisionDate);

        // Verify deletedAt is now null
        const afterRows = await db.select('RopewikiBetaSection', { id: betaSectionId }).run(conn);
        expect(afterRows).toHaveLength(1);
        const betaSection = afterRows[0] as s.RopewikiBetaSection.JSONSelectable;
        expect(betaSection.deletedAt).toBeNull();
        expect(betaSection.text).toBe('Deleted text.');
    });

    it('throws an error when attempting to insert duplicate order for the same page', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        const betaSections: RopewikiBetaSection[] = [
            { title: 'Section 1', text: 'Text 1.', order: 1 },
            { title: 'Section 2', text: 'Text 2.', order: 1 }, // Same order as Section 1
        ];

        await expect(
            upsertBetaSections(conn, testPageUuid, betaSections, latestRevisionDate)
        ).rejects.toThrow();
    });

    it('updates order when upserting existing beta section', async () => {
        const latestRevisionDate = new Date('2025-01-02T12:34:56Z');
        
        // First insert with order 1
        const initialBetaSections: RopewikiBetaSection[] = [
            { title: 'Section', text: 'Initial text.', order: 1 },
        ];
        await upsertBetaSections(conn, testPageUuid, initialBetaSections, latestRevisionDate);

        // Update with order 2
        const updatedBetaSections: RopewikiBetaSection[] = [
            { title: 'Section', text: 'Updated text.', order: 2 },
        ];
        await upsertBetaSections(conn, testPageUuid, updatedBetaSections, latestRevisionDate);

        // Verify order was updated
        const rows = await db
            .select('RopewikiBetaSection', { ropewikiPage: testPageUuid, title: 'Section' })
            .run(conn);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.order).toBe(2);
        expect(rows[0]?.text).toBe('Updated text.');
    });

    it('propagates errors from the database layer', async () => {
        const latestRevisionDate = new Date('2025-01-04T10:00:00Z');
        const betaSections: RopewikiBetaSection[] = [
            { title: 'Introduction', text: 'Test text.', order: 1 },
        ];

        // Use a client with a non-existent database to force an error
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_upsert_beta_sections',
        });

        await expect(upsertBetaSections(badPool, testPageUuid, betaSections, latestRevisionDate)).rejects.toBeDefined();

        await badPool.end();
    });
});

