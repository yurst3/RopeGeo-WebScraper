import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Pool } from 'pg';
import * as db from 'zapatos/db';
import getRopewikiPageRelevanceSourceData from '../../../src/ropewiki/database/getRopewikiPageRelevanceSourceData';

describe('getRopewikiPageRelevanceSourceData (database)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;

    const regionId = 'e1000001-0001-4000-8000-000000000001';
    const pageId = 'e2000001-0001-4000-8000-000000000001';
    const betaId = 'e3000001-0001-4000-8000-000000000001';
    const imageId = 'e4000001-0001-4000-8000-000000000001';
    const deletedBetaId = 'e3000001-0001-4000-8000-000000000002';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE "ropewikiPage" = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection" WHERE "ropewikiPage" = ${db.param(pageId)}::uuid`.run(
            conn,
        );
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);

        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'Relevance Source Region',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/Relevance_Source_Region',
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiImage" WHERE "ropewikiPage" = ${db.param(pageId)}::uuid`.run(conn);
        await db.sql`DELETE FROM "RopewikiBetaSection" WHERE "ropewikiPage" = ${db.param(pageId)}::uuid`.run(
            conn,
        );
        await db.sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}::uuid`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    it('throws when the page is missing', async () => {
        await expect(getRopewikiPageRelevanceSourceData(conn, pageId)).rejects.toThrow(
            `RopewikiPage not found: ${pageId}`,
        );
    });

    it('returns active beta sections and images only', async () => {
        await db
            .insert('RopewikiPage', {
                id: pageId,
                externalPageId: 'relevance-source-page',
                name: 'Relevance Source Page',
                region: regionId,
                url: 'https://ropewiki.com/Relevance_Source_Page',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        await db
            .insert('RopewikiBetaSection', [
                {
                    id: betaId,
                    ropewikiPage: pageId,
                    title: 'Descent',
                    text: 'Active',
                    order: 0,
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                },
                {
                    id: deletedBetaId,
                    ropewikiPage: pageId,
                    title: 'Old',
                    text: 'Deleted',
                    order: 1,
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    deletedAt: new Date(),
                },
            ])
            .run(conn);

        await db
            .insert('RopewikiImage', {
                id: imageId,
                ropewikiPage: pageId,
                fileUrl: 'https://example.com/a.jpg',
                linkUrl: 'https://example.com/a',
                caption: 'Caption',
                order: 0,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
            })
            .run(conn);

        const result = await getRopewikiPageRelevanceSourceData(conn, pageId);
        expect(result.page.id).toBe(pageId);
        expect(result.betaSections.map((s) => s.id)).toEqual([betaId]);
        expect(result.images.map((i) => i.id)).toEqual([imageId]);
    });
});
