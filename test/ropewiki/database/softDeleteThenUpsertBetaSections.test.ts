import { Pool } from 'pg';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import setBetaSectionsDeletedAt from '../../../src/ropewiki/database/setBetaSectionsDeletedAt';
import upsertBetaSections from '../../../src/ropewiki/database/upsertBetaSections';
import type { RopewikiBetaSection } from '../../../src/ropewiki/types/page';
import RopewikiPage from '../../../src/ropewiki/types/page';
import upsertPages from '../../../src/ropewiki/database/upsertPages';

/**
 * Integration test for the "soft delete then upsert" flow used in processPage.
 * Verifies that when we simulate a second "parse" with a different set of beta sections:
 * - Sections removed from the parse are soft-deleted (deletedAt set, order null).
 * - Sections that remain or are added have the correct order.
 * - Only the target page is affected; other pages' beta sections are unchanged.
 */
describe('soft delete then upsert beta sections (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;
    const testRegionId = 'ffebfa80-656e-4e48-99a6-81608cc0051d';
    const regionNameIds: { [name: string]: string } = { 'Test Region': testRegionId };
    let testPageUuid: string;
    let otherPageUuid: string;

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

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

        const latestRevisionDate = new Date('2025-01-01T00:00:00Z');
        const pageInfo = RopewikiPage.fromResponseBody(
            {
                printouts: {
                    pageid: ['9999'],
                    name: ['Test Page'],
                    region: [{ fulltext: 'Test Region' }],
                    url: ['https://ropewiki.com/Test_Page'],
                    latestRevisionDate: [
                        {
                            timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)),
                            raw: '2025-01-01T00:00:00Z',
                        },
                    ],
                },
            },
            regionNameIds
        );
        const otherPageInfo = RopewikiPage.fromResponseBody(
            {
                printouts: {
                    pageid: ['8888'],
                    name: ['Other Page'],
                    region: [{ fulltext: 'Test Region' }],
                    url: ['https://ropewiki.com/Other_Page'],
                    latestRevisionDate: [
                        {
                            timestamp: String(Math.floor(latestRevisionDate.getTime() / 1000)),
                            raw: '2025-01-01T00:00:00Z',
                        },
                    ],
                },
            },
            regionNameIds
        );
        const results = await upsertPages(conn, [pageInfo, otherPageInfo]);
        expect(results).toHaveLength(2);
        testPageUuid = results[0]!.id ?? '';
        otherPageUuid = results[1]!.id ?? '';
        expect(testPageUuid).toBeTruthy();
        expect(otherPageUuid).toBeTruthy();
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('soft-deletes removed sections and maintains correct order when new section is added', async () => {
        const rev1 = new Date('2025-01-01T00:00:00Z');
        const rev2 = new Date('2025-01-02T00:00:00Z');

        // First "parse": Introduction (0), Approach (1), Descent (2)
        const firstParse: RopewikiBetaSection[] = [
            { title: 'Introduction', text: 'Intro text.', order: 0 },
            { title: 'Approach', text: 'Approach text.', order: 1 },
            { title: 'Descent', text: 'Descent text.', order: 2 },
        ];
        await upsertBetaSections(conn, testPageUuid, firstParse, rev1);

        // Other page: different sections that must remain untouched by soft-delete/upsert of test page
        const otherPageSections: RopewikiBetaSection[] = [
            { title: 'Overview', text: 'Overview text.', order: 0 },
            { title: 'Route', text: 'Route text.', order: 1 },
        ];
        await upsertBetaSections(conn, otherPageUuid, otherPageSections, rev1);

        const afterFirst = await db
            .select('RopewikiBetaSection', { ropewikiPage: testPageUuid, deletedAt: db.conditions.isNull })
            .run(conn);
        expect(afterFirst).toHaveLength(3);

        // Second "parse": Approach is removed, "New Section" added between Introduction and Descent
        // So we have Introduction (0), New Section (1), Descent (2)
        const secondParse: RopewikiBetaSection[] = [
            { title: 'Introduction', text: 'Intro text.', order: 0 },
            { title: 'New Section', text: 'New section text.', order: 1 },
            { title: 'Descent', text: 'Descent text.', order: 2 },
        ];

        // Replicate processPage order: soft-delete all, then upsert
        await setBetaSectionsDeletedAt(conn, testPageUuid);
        await upsertBetaSections(conn, testPageUuid, secondParse, rev2);

        // Live sections (deletedAt null) should be exactly the second parse set with correct order
        const liveRows = await db
            .select('RopewikiBetaSection', { ropewikiPage: testPageUuid, deletedAt: db.conditions.isNull })
            .run(conn);
        expect(liveRows).toHaveLength(3);

        const introduction = liveRows.find((r) => r.title === 'Introduction') as s.RopewikiBetaSection.JSONSelectable;
        const newSection = liveRows.find((r) => r.title === 'New Section') as s.RopewikiBetaSection.JSONSelectable;
        const descent = liveRows.find((r) => r.title === 'Descent') as s.RopewikiBetaSection.JSONSelectable;

        expect(introduction).toBeDefined();
        expect(introduction.order).toBe(0);
        expect(introduction.text).toBe('Intro text.');

        expect(newSection).toBeDefined();
        expect(newSection.order).toBe(1);
        expect(newSection.text).toBe('New section text.');

        expect(descent).toBeDefined();
        expect(descent.order).toBe(2);
        expect(descent.text).toBe('Descent text.');

        // Approach must be soft-deleted (deletedAt set, order null)
        const approachRows = await db
            .select('RopewikiBetaSection', { ropewikiPage: testPageUuid, title: 'Approach' })
            .run(conn);
        expect(approachRows).toHaveLength(1);
        expect(approachRows[0]?.deletedAt).not.toBeNull();
        expect(approachRows[0]?.order).toBeNull();

        // Other page must be unaffected: same sections, still live, same order and text
        const otherPageRows = await db
            .select('RopewikiBetaSection', { ropewikiPage: otherPageUuid, deletedAt: db.conditions.isNull })
            .run(conn);
        expect(otherPageRows).toHaveLength(2);
        const overview = otherPageRows.find((r) => r.title === 'Overview');
        const route = otherPageRows.find((r) => r.title === 'Route');
        expect(overview).toBeDefined();
        expect(overview?.order).toBe(0);
        expect(overview?.text).toBe('Overview text.');
        expect(overview?.deletedAt).toBeNull();
        expect(route).toBeDefined();
        expect(route?.order).toBe(1);
        expect(route?.text).toBe('Route text.');
        expect(route?.deletedAt).toBeNull();
    });

    it('allows multiple soft-deleted beta sections with order null for the same page', async () => {
        const rev = new Date('2025-01-01T00:00:00Z');
        const sections: RopewikiBetaSection[] = [
            { title: 'Section A', text: 'Text A.', order: 0 },
            { title: 'Section B', text: 'Text B.', order: 1 },
            { title: 'Section C', text: 'Text C.', order: 2 },
        ];
        await upsertBetaSections(conn, testPageUuid, sections, rev);

        // Soft-delete all; multiple rows will have order = null (constraint allows this)
        await setBetaSectionsDeletedAt(conn, testPageUuid);

        const softDeleted = await db
            .select('RopewikiBetaSection', { ropewikiPage: testPageUuid, deletedAt: db.conditions.isNotNull })
            .run(conn);
        expect(softDeleted).toHaveLength(3);
        for (const row of softDeleted) {
            expect(row.deletedAt).not.toBeNull();
            expect(row.order).toBeNull();
        }
    });
});
