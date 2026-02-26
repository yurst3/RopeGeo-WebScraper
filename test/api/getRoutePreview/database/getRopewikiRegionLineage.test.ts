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
import getRopewikiRegionLineage from '../../../../src/api/getRoutePreview/database/getRopewikiRegionLineage';

describe('getRopewikiRegionLineage (integration)', () => {
    const pool = new Pool({
        user: process.env.TEST_USER,
        password: process.env.TEST_PASS,
        host: process.env.TEST_HOST,
        port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
        database: process.env.TEST_DB,
    });

    const conn: db.Queryable = pool;

    /** parentRegion is the parent region's name (not id), matching DB column semantics. */
    const insertRegion = async (
        id: string,
        name: string,
        parentRegion: string | null,
    ) => {
        await db
            .insert('RopewikiRegion', {
                id,
                parentRegion,
                name,
                latestRevisionDate: '2025-01-01T00:00:00' as db.TimestampString,
                pageCount: 0,
                level: 0,
                bestMonths: JSON.stringify([]),
                url: `https://ropewiki.com/${name.replace(/\s/g, '_')}`,
            })
            .run(conn);
    };

    beforeAll(async () => {
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
    });

    afterEach(async () => {
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
    });

    afterAll(async () => {
        await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
        await pool.end();
    });

    it('returns single name when region has no parent', async () => {
        const regionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        await insertRegion(regionId, 'Utah', null);

        const result = await getRopewikiRegionLineage(conn, regionId);

        expect(result).toEqual(['Utah']);
    });

    it('returns lineage root to leaf when region has parent and grandparent', async () => {
        const rootId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        const childId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
        const grandchildId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

        await insertRegion(rootId, 'United States', null);
        await insertRegion(childId, 'Utah', 'United States');
        await insertRegion(grandchildId, 'Bear Creek', 'Utah');

        const result = await getRopewikiRegionLineage(conn, grandchildId);

        expect(result).toEqual(['United States', 'Utah', 'Bear Creek']);
    });

    it('returns two names when region has one parent', async () => {
        const parentId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
        const childId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

        await insertRegion(parentId, 'Nevada', null);
        await insertRegion(childId, 'Red Rock', 'Nevada');

        const result = await getRopewikiRegionLineage(conn, childId);

        expect(result).toEqual(['Nevada', 'Red Rock']);
    });

    it('returns empty array when region id does not exist', async () => {
        const result = await getRopewikiRegionLineage(
            conn,
            '00000000-0000-0000-0000-000000000000',
        );

        expect(result).toEqual([]);
    });
});
