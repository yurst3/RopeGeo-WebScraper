import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import setBetaSectionsDeletedAt from '../../../src/ropewiki/database/setBetaSectionsDeletedAt';

describe('setBetaSectionsDeletedAt (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
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
        testPageUuid = '11111111-1111-1111-1111-111111111111';
        await db
            .insert('RopewikiPage', {
                id: testPageUuid,
                pageId: '9999',
                name: 'Test Page',
                region: testRegionId,
                url: 'https://ropewiki.com/Test_Page',
                months: [],
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);
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

    it('sets deletedAt and order null for all beta sections for the page', async () => {
        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');

        // Insert beta sections directly
        const section1Id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const section2Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        const section3Id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

        await db
            .insert('RopewikiBetaSection', [
                {
                    id: section1Id,
                    ropewikiPage: testPageUuid,
                    title: 'Section 1',
                    text: 'Text 1',
                    order: 1,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
                {
                    id: section2Id,
                    ropewikiPage: testPageUuid,
                    title: 'Section 2',
                    text: 'Text 2',
                    order: 2,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
                {
                    id: section3Id,
                    ropewikiPage: testPageUuid,
                    title: 'Section 3',
                    text: 'Text 3',
                    order: 3,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
            ])
            .run(conn);

        // Verify all sections have deletedAt as null
        const beforeRows = await db.select('RopewikiBetaSection', { ropewikiPage: testPageUuid }).run(conn);
        expect(beforeRows).toHaveLength(3);
        beforeRows.forEach(section => {
            expect(section.deletedAt).toBeNull();
        });

        await setBetaSectionsDeletedAt(conn, testPageUuid);

        // Verify all sections now have deletedAt set and order null
        const afterRows = await db.select('RopewikiBetaSection', { ropewikiPage: testPageUuid }).run(conn);
        expect(afterRows).toHaveLength(3);
        afterRows.forEach(section => {
            expect(section.deletedAt).not.toBeNull();
            expect(new Date(section.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
            expect(section.order).toBeNull();
        });
    });

    it('only affects beta sections for the specified pageUuid', async () => {
        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');

        // Create a second page
        const testPageUuid2 = '33333333-3333-3333-3333-333333333333';
        await db
            .insert('RopewikiPage', {
                id: testPageUuid2,
                pageId: '8888',
                name: 'Test Page 2',
                region: testRegionId,
                url: 'https://ropewiki.com/Test_Page_2',
                months: [],
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        // Insert beta sections for both pages with known IDs
        const page1SectionId = '44444444-4444-4444-4444-444444444444';
        const page2SectionId = '55555555-5555-5555-5555-555555555555';

        await db
            .insert('RopewikiBetaSection', [
                {
                    id: page1SectionId,
                    ropewikiPage: testPageUuid,
                    title: 'Page1 Section',
                    text: 'Text 1',
                    order: 1,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
                {
                    id: page2SectionId,
                    ropewikiPage: testPageUuid2,
                    title: 'Page2 Section',
                    text: 'Text 2',
                    order: 1,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
            ])
            .run(conn);

        await setBetaSectionsDeletedAt(conn, testPageUuid);

        // Verify page1 section is deleted
        const page1Section = await db.select('RopewikiBetaSection', { id: page1SectionId }).run(conn);
        expect(page1Section[0]?.deletedAt).not.toBeNull();

        // Verify page2 section is NOT deleted
        const page2Section = await db.select('RopewikiBetaSection', { id: page2SectionId }).run(conn);
        expect(page2Section[0]?.deletedAt).toBeNull();
    });

    it('does not update deletedAt for sections that already have deletedAt set', async () => {
        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');

        // Insert beta sections directly with known IDs
        const section1Id = '66666666-6666-6666-6666-666666666666';
        const section2Id = '77777777-7777-7777-7777-777777777777';
        const section3Id = '88888888-8888-8888-8888-888888888888';
        const oldDeletedAt = new Date('2025-01-01T10:00:00Z');

        await db
            .insert('RopewikiBetaSection', [
                {
                    id: section1Id,
                    ropewikiPage: testPageUuid,
                    title: 'Section 1',
                    text: 'Text 1',
                    order: 1,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
                {
                    id: section2Id,
                    ropewikiPage: testPageUuid,
                    title: 'Section 2',
                    text: 'Text 2',
                    order: 2,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                    deletedAt: oldDeletedAt.toISOString() as db.TimestampString,
                },
                {
                    id: section3Id,
                    ropewikiPage: testPageUuid,
                    title: 'Section 3',
                    text: 'Text 3',
                    order: 3,
                    latestRevisionDate: latestRevisionDate.toISOString() as db.TimestampString,
                },
            ])
            .run(conn);

        // Verify section2 is already deleted
        const beforeSection2 = await db.select('RopewikiBetaSection', { id: section2Id }).run(conn);
        expect(beforeSection2[0]?.deletedAt).not.toBeNull();
        const beforeDeletedAtValue = beforeSection2[0]?.deletedAt as string;

        // Wait a bit to ensure new timestamp would be different
        await new Promise(resolve => setTimeout(resolve, 100));

        await setBetaSectionsDeletedAt(conn, testPageUuid);

        // Verify section1 was updated (had deletedAt null)
        const section1 = await db.select('RopewikiBetaSection', { id: section1Id }).run(conn);
        expect(section1[0]?.deletedAt).not.toBeNull();

        // Verify section2's deletedAt was NOT updated (it already had a value)
        const afterSection2 = await db.select('RopewikiBetaSection', { id: section2Id }).run(conn);
        expect(afterSection2[0]?.deletedAt).not.toBeNull();
        const afterDeletedAtValue = afterSection2[0]?.deletedAt as string;
        // The value should be exactly the same (not updated)
        expect(afterDeletedAtValue).toBe(beforeDeletedAtValue);

        // Verify section3's deletedAt was updated (it was null and not in updatedBetaSectionIds)
        const section3 = await db.select('RopewikiBetaSection', { id: section3Id }).run(conn);
        expect(section3[0]?.deletedAt).not.toBeNull();
        expect(new Date(section3[0]?.deletedAt as string).getTime()).toBeCloseTo(Date.now(), -3);
    });

    it('propagates errors from the database layer', async () => {
        // Use a client with a non-existent database to force an error
        const badPool = new Pool({
            user: process.env.TEST_USER,
            password: process.env.TEST_PASS,
            host: process.env.TEST_HOST,
            port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
            database: 'nonexistent_database_for_test_error_set_beta_sections_deleted_at',
        });

        await expect(setBetaSectionsDeletedAt(badPool, testPageUuid)).rejects.toBeDefined();

        await badPool.end();
    });
});

