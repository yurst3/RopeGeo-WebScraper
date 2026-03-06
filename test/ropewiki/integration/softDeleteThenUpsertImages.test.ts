import { Pool } from 'pg';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';
import setImagesDeletedAt from '../../../src/ropewiki/database/setImagesDeletedAt';
import upsertImages from '../../../src/ropewiki/database/upsertImages';
import { RopewikiImage } from '../../../src/ropewiki/types/image';
import RopewikiPage from '../../../src/ropewiki/types/page';
import upsertPages from '../../../src/ropewiki/database/upsertPages';

const BASE_FILE = 'https://ropewiki.com/files/';
const BASE_LINK = 'https://ropewiki.com/';

/**
 * Integration test for the "soft delete then upsert" flow used in processPage for images.
 * Verifies that when we simulate a second "parse" with a different set of images:
 * - Images removed from the parse are soft-deleted (deletedAt set, order null).
 * - Images that remain or are added have the correct order.
 * - Only the target page is affected; other pages' images are unchanged.
 */
describe('soft delete then upsert images (integration)', () => {
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
    const betaTitleIds: { [title: string]: string } = {};

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: testRegionId,
                parentRegion: null,
                name: 'Test Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
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
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection"`.run(conn);
        await db.sql`DELETE FROM "RopewikiPage"`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('soft-deletes removed images and maintains correct order when new image is added', async () => {
        const rev1 = new Date('2025-01-01T00:00:00Z');
        const rev2 = new Date('2025-01-02T00:00:00Z');

        const imgA = (order = 0) => new RopewikiImage(undefined, `${BASE_LINK}ImgA`, `${BASE_FILE}ImgA.jpg`, 'A', order);
        const imgB = (order = 1) => new RopewikiImage(undefined, `${BASE_LINK}ImgB`, `${BASE_FILE}ImgB.jpg`, 'B', order);
        const imgC = (order = 2) => new RopewikiImage(undefined, `${BASE_LINK}ImgC`, `${BASE_FILE}ImgC.jpg`, 'C', order);
        const imgD = (order = 1) => new RopewikiImage(undefined, `${BASE_LINK}ImgD`, `${BASE_FILE}ImgD.jpg`, 'D', order);

        // First "parse": ImgA (0), ImgB (1), ImgC (2)
        const firstParse: RopewikiImage[] = [imgA(0), imgB(1), imgC(2)];
        await upsertImages(conn, testPageUuid, firstParse, betaTitleIds, rev1);

        // Other page: two images that must remain untouched
        const otherImages: RopewikiImage[] = [
            new RopewikiImage(undefined, `${BASE_LINK}Other1`, `${BASE_FILE}Other1.jpg`, 'Other 1', 0),
            new RopewikiImage(undefined, `${BASE_LINK}Other2`, `${BASE_FILE}Other2.jpg`, 'Other 2', 1),
        ];
        await upsertImages(conn, otherPageUuid, otherImages, betaTitleIds, rev1);

        const afterFirst = await db
            .select('RopewikiImage', { ropewikiPage: testPageUuid, deletedAt: db.conditions.isNull })
            .run(conn);
        expect(afterFirst).toHaveLength(3);

        // Second "parse": ImgB removed, ImgD added in the middle → ImgA (0), ImgD (1), ImgC (2)
        const secondParse: RopewikiImage[] = [imgA(0), imgD(1), imgC(2)];

        await setImagesDeletedAt(conn, testPageUuid);
        await upsertImages(conn, testPageUuid, secondParse, betaTitleIds, rev2);

        const liveRows = await db
            .select('RopewikiImage', { ropewikiPage: testPageUuid, deletedAt: db.conditions.isNull })
            .run(conn);
        expect(liveRows).toHaveLength(3);

        const rowA = liveRows.find((r) => r.fileUrl === `${BASE_FILE}ImgA.jpg`) as s.RopewikiImage.JSONSelectable;
        const rowD = liveRows.find((r) => r.fileUrl === `${BASE_FILE}ImgD.jpg`) as s.RopewikiImage.JSONSelectable;
        const rowC = liveRows.find((r) => r.fileUrl === `${BASE_FILE}ImgC.jpg`) as s.RopewikiImage.JSONSelectable;

        expect(rowA).toBeDefined();
        expect(rowA.order).toBe(0);
        expect(rowD).toBeDefined();
        expect(rowD.order).toBe(1);
        expect(rowC).toBeDefined();
        expect(rowC.order).toBe(2);

        const imgBRows = await db
            .select('RopewikiImage', { ropewikiPage: testPageUuid, fileUrl: `${BASE_FILE}ImgB.jpg` })
            .run(conn);
        expect(imgBRows).toHaveLength(1);
        expect(imgBRows[0]?.deletedAt).not.toBeNull();
        expect(imgBRows[0]?.order).toBeNull();

        const otherPageRows = await db
            .select('RopewikiImage', { ropewikiPage: otherPageUuid, deletedAt: db.conditions.isNull })
            .run(conn);
        expect(otherPageRows).toHaveLength(2);
        const other1 = otherPageRows.find((r) => r.fileUrl === `${BASE_FILE}Other1.jpg`);
        const other2 = otherPageRows.find((r) => r.fileUrl === `${BASE_FILE}Other2.jpg`);
        expect(other1?.order).toBe(0);
        expect(other1?.deletedAt).toBeNull();
        expect(other2?.order).toBe(1);
        expect(other2?.deletedAt).toBeNull();
    });

    it('allows multiple soft-deleted images with order null for the same page', async () => {
        const rev = new Date('2025-01-01T00:00:00Z');
        const images: RopewikiImage[] = [
            new RopewikiImage(undefined, `${BASE_LINK}X`, `${BASE_FILE}X.jpg`, 'X', 0),
            new RopewikiImage(undefined, `${BASE_LINK}Y`, `${BASE_FILE}Y.jpg`, 'Y', 1),
            new RopewikiImage(undefined, `${BASE_LINK}Z`, `${BASE_FILE}Z.jpg`, 'Z', 2),
        ];
        await upsertImages(conn, testPageUuid, images, betaTitleIds, rev);

        await setImagesDeletedAt(conn, testPageUuid);

        const softDeleted = await db
            .select('RopewikiImage', { ropewikiPage: testPageUuid, deletedAt: db.conditions.isNotNull })
            .run(conn);
        expect(softDeleted).toHaveLength(3);
        for (const row of softDeleted) {
            expect(row.deletedAt).not.toBeNull();
            expect(row.order).toBeNull();
        }
    });
});
