import { Pool } from 'pg';
import * as db from 'zapatos/db';
import { describe, it, expect, afterAll, beforeAll, afterEach } from '@jest/globals';
import { listPageZipReprocessTargets } from '../../../src/page-zipper/database/listPageZipReprocessTargets';

describe('listPageZipReprocessTargets (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });
    const conn: db.Queryable = pool;
    const regionId = 'f3000010-0010-4000-8000-000000000010';
    const needingPageId = 'f3000011-0011-4000-8000-000000000011';
    const builtPageId = 'f3000012-0012-4000-8000-000000000012';
    const deletedPageId = 'f3000013-0013-4000-8000-000000000013';

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.vals([needingPageId, builtPageId, deletedPageId])})`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegionName: null,
                name: 'ListPageZipReprocessRegion',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/ListPageZipReprocessRegion',
            })
            .run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.vals([needingPageId, builtPageId, deletedPageId])})`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.vals([needingPageId, builtPageId, deletedPageId])})`.run(conn);
        await db.sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}::uuid`.run(conn);
        await pool.end();
    });

    async function seedPages(): Promise<void> {
        await db
            .insert('RopewikiPage', [
                {
                    id: needingPageId,
                    externalPageId: 'list-zip-needing',
                    name: 'Needing Folder',
                    region: regionId,
                    url: 'https://ropewiki.com/Needing',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    downloadFolder: null,
                },
                {
                    id: builtPageId,
                    externalPageId: 'list-zip-built',
                    name: 'Built Folder',
                    region: regionId,
                    url: 'https://ropewiki.com/Built',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    downloadFolder: 'https://cdn.example.com/built.zip',
                },
                {
                    id: deletedPageId,
                    externalPageId: 'list-zip-deleted',
                    name: 'Deleted Page',
                    region: regionId,
                    url: 'https://ropewiki.com/Deleted',
                    latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                    downloadFolder: null,
                    deletedAt: '2025-06-01T00:00:00' as db.TimestampString,
                },
            ])
            .run(conn);
    }

    it('returns undeleted pages without downloadFolder', async () => {
        await seedPages();
        const rows = await listPageZipReprocessTargets(conn);
        const ids = rows.map((r) => r.pageId);
        expect(ids).toContain(needingPageId);
        expect(ids).not.toContain(builtPageId);
        expect(ids).not.toContain(deletedPageId);
    });

    it('filters to includePageIds when provided', async () => {
        await seedPages();
        const rows = await listPageZipReprocessTargets(conn, [needingPageId, builtPageId]);
        expect(rows).toEqual([{ pageId: needingPageId }]);
    });
});
