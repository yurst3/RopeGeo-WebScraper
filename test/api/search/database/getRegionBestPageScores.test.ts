import { Pool } from 'pg';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as db from 'zapatos/db';
import getRegionBestPageScores from '../../../../src/api/search/database/getRegionBestPageScores';

describe('getRegionBestPageScores (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT
            ? parseInt(process.env.TEST_PORT, 10)
            : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    const parentRegionId = 'd2000001-0001-4000-8000-000000000001';
    const childRegionId = 'd2000002-0002-4000-8000-000000000002';
    const pageInParentId = 'e2000001-0001-4000-8000-000000000001';
    const pageInChildId = 'e2000002-0002-4000-8000-000000000002';

    beforeAll(async () => {
        await db
            .insert('RopewikiRegion', {
                id: parentRegionId,
                parentRegion: null,
                name: 'ScoreTestParent',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/ScoreTestParent',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: childRegionId,
                parentRegion: parentRegionId,
                name: 'ScoreTestChild',
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 1,
                bestMonths: [],
                url: 'https://ropewiki.com/ScoreTestChild',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInParentId,
                pageId: 'score-parent-1',
                name: 'Page In Parent',
                region: parentRegionId,
                url: 'https://ropewiki.com/Page_In_Parent',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 1,
                userVotes: 2,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInChildId,
                pageId: 'score-child-1',
                name: 'Page In Child',
                region: childRegionId,
                url: 'https://ropewiki.com/Page_In_Child',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 5,
                userVotes: 10,
            })
            .run(conn);
    });

    afterAll(async () => {
        await db
            .sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(pageInParentId)}, ${db.param(pageInChildId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id IN (${db.param(childRegionId)}, ${db.param(parentRegionId)})`.run(conn);
        await pool.end();
    });

    it('returns empty Map when regionIds is empty', async () => {
        const result = await getRegionBestPageScores(conn, []);
        expect(result.size).toBe(0);
    });

    it('returns score for child region (quality * userVotes of its only page)', async () => {
        const result = await getRegionBestPageScores(conn, [childRegionId]);
        expect(result.get(childRegionId)).toBe(50);
    });

    it('returns best page score in subtree for parent (child page wins)', async () => {
        const result = await getRegionBestPageScores(conn, [parentRegionId]);
        expect(result.get(parentRegionId)).toBe(50);
    });

    it('omits region with no pages', async () => {
        const regionId = 'd2000003-0003-4000-8000-000000000003';
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegion: null,
                name: 'ScoreTestNoPages',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/ScoreTestNoPages',
            })
            .run(conn);

        const result = await getRegionBestPageScores(conn, [regionId]);
        expect(result.has(regionId)).toBe(false);

        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}`.run(conn);
    });

    it('returns multiple region scores in one call', async () => {
        const result = await getRegionBestPageScores(conn, [
            parentRegionId,
            childRegionId,
        ]);
        expect(result.get(parentRegionId)).toBe(50);
        expect(result.get(childRegionId)).toBe(50);
    });

    it('uses COALESCE(userVotes, 1) when userVotes is null', async () => {
        const regionId = 'd2000004-0004-4000-8000-000000000004';
        const pageId = 'e2000004-0004-4000-8000-000000000004';
        await db
            .insert('RopewikiRegion', {
                id: regionId,
                parentRegion: null,
                name: 'ScoreTestNullVotes',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/ScoreTestNullVotes',
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageId,
                pageId: 'score-null-votes-1',
                name: 'Page With Null Votes',
                region: regionId,
                url: 'https://ropewiki.com/Page_With_Null_Votes',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 3,
                userVotes: null,
            })
            .run(conn);

        const result = await getRegionBestPageScores(conn, [regionId]);
        expect(result.get(regionId)).toBe(3);

        await db
            .sql`DELETE FROM "RopewikiPage" WHERE id = ${db.param(pageId)}`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id = ${db.param(regionId)}`.run(conn);
    });

    it('considers all layers of nested regions (name-based parentRegion)', async () => {
        const grandparentId = 'd2000005-0005-4000-8000-000000000005';
        const parentId = 'd2000006-0006-4000-8000-000000000006';
        const childId = 'd2000007-0007-4000-8000-000000000007';
        const pageInGrandparentId = 'e2000005-0005-4000-8000-000000000005';
        const pageInParentId = 'e2000006-0006-4000-8000-000000000006';
        const pageInChildId = 'e2000007-0007-4000-8000-000000000007';
        const grandparentName = 'ScoreTestGrandparent';
        const parentName = 'ScoreTestMidParent';
        const childName = 'ScoreTestDeepChild';

        await db
            .insert('RopewikiRegion', {
                id: grandparentId,
                parentRegion: null,
                name: grandparentName,
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 0,
                bestMonths: [],
                url: 'https://ropewiki.com/ScoreTestGrandparent',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: parentId,
                parentRegion: grandparentName,
                name: parentName,
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 1,
                bestMonths: [],
                url: 'https://ropewiki.com/ScoreTestMidParent',
            })
            .run(conn);
        await db
            .insert('RopewikiRegion', {
                id: childId,
                parentRegion: parentName,
                name: childName,
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                rawPageCount: 0,
                level: 2,
                bestMonths: [],
                url: 'https://ropewiki.com/ScoreTestDeepChild',
            })
            .run(conn);

        await db
            .insert('RopewikiPage', {
                id: pageInGrandparentId,
                pageId: 'score-gp-1',
                name: 'Page In Grandparent',
                region: grandparentId,
                url: 'https://ropewiki.com/Page_In_Grandparent',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 2,
                userVotes: 2,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInParentId,
                pageId: 'score-mid-1',
                name: 'Page In Parent',
                region: parentId,
                url: 'https://ropewiki.com/Page_In_Mid',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 3,
                userVotes: 4,
            })
            .run(conn);
        await db
            .insert('RopewikiPage', {
                id: pageInChildId,
                pageId: 'score-deep-1',
                name: 'Page In Deep Child',
                region: childId,
                url: 'https://ropewiki.com/Page_In_Deep',
                latestRevisionDate:
                    '2025-01-01T00:00:00' as db.TimestampString,
                quality: 5,
                userVotes: 10,
            })
            .run(conn);

        const result = await getRegionBestPageScores(conn, [grandparentId]);
        expect(result.get(grandparentId)).toBe(50);

        await db
            .sql`DELETE FROM "RopewikiPage" WHERE id IN (${db.param(pageInGrandparentId)}, ${db.param(pageInParentId)}, ${db.param(pageInChildId)})`.run(conn);
        await db
            .sql`DELETE FROM "RopewikiRegion" WHERE id IN (${db.param(childId)}, ${db.param(parentId)}, ${db.param(grandparentId)})`.run(conn);
    });
});
