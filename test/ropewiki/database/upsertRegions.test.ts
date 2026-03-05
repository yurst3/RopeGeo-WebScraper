import { Pool } from 'pg';
import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import upsertRegions from '../../../src/ropewiki/database/upsertRegions';
import { RopewikiRegion } from '../../../src/ropewiki/types/region';
import { describe, it, expect, afterEach, beforeAll, afterAll } from '@jest/globals';

describe('upsertRegions (integration)', () => {
  const pool = new Pool({
    user: process.env.TEST_USER,
    password: process.env.TEST_PASS,
    host: process.env.TEST_HOST,
    port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
    database: process.env.TEST_DB,
  });

  const conn: db.Queryable = pool;

  beforeAll(async () => {
    // Ensure the table exists and is empty for tests
    await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
  });

  afterEach(async () => {
    // Clean up between tests
    await db.sql`DELETE FROM "RopewikiRegion"`.run(conn);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('does nothing when regions array is empty', async () => {
    await upsertRegions(conn, []);

    const rows = await db.select('RopewikiRegion', {}).run(conn);
    expect(rows).toHaveLength(0);
  });

  it('inserts net new regions', async () => {
    const latestRevisionDate = new Date('2024-01-01T00:00:00Z');
    const regions: RopewikiRegion[] = [
      new RopewikiRegion('World', undefined, 0, 0, undefined, [], false, false, latestRevisionDate),
      new RopewikiRegion('Africa', 'World', 0, 1, undefined, [], false, false, latestRevisionDate),
    ];

    await upsertRegions(conn, regions);

    const rows = await db
      .select('RopewikiRegion', {}, { order: { by: 'name', direction: 'ASC' } })
      .run(conn);

    expect(rows).toHaveLength(2);

    const world = rows.find((r) => r.name === 'World') as s.RopewikiRegion.JSONSelectable;
    const africa = rows.find((r) => r.name === 'Africa') as s.RopewikiRegion.JSONSelectable;

    expect(world.name).toBe('World');
    expect(world.parentRegion).toBeNull();
    expect(new Date(world.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());

    expect(africa.name).toBe('Africa');
    expect(africa.parentRegion).toBe('World');
    expect(new Date(africa.latestRevisionDate).toISOString()).toBe(latestRevisionDate.toISOString());
  });

  it('updates existing regions via upsert when name and parentRegion match', async () => {
    const initialRevisionDate = new Date('2024-01-01T00:00:00Z');
    const latestRevisionDate = new Date('2024-02-01T00:00:00Z');

    // Seed an existing region
    await upsertRegions(
      conn,
      [new RopewikiRegion('World', undefined, 0, 0, undefined, [], false, false, initialRevisionDate)],
    );

    // Update the same region (same name and parentRegion)
    await upsertRegions(
      conn,
      [new RopewikiRegion('World', undefined, 10, 0, 'Updated overview', ['January'], true, true, latestRevisionDate)],
    );

    const rows = await db.select('RopewikiRegion', { name: 'World' }).run(conn);
    const region = rows.find((r) => r.parentRegion === null) as s.RopewikiRegion.JSONSelectable;
    expect(region).toBeDefined();
    expect(region.name).toBe('World');
    expect(region.parentRegion).toBeNull();
    expect(region.rawPageCount).toBe(10);
    expect(region.overview).toBe('Updated overview');
    expect(region.bestMonths).toEqual(['January']);
    expect(region.isMajorRegion).toBe(true);
    expect(region.isTopLevelRegion).toBe(true);
    expect(new Date(region.latestRevisionDate).toISOString()).toBe(
      latestRevisionDate.toISOString(),
    );
  });

  it('sets deletedAt to null when upserting', async () => {
    const latestRevisionDate = new Date('2024-01-01T00:00:00Z');

    // Insert a region with deletedAt set
    await db
      .insert('RopewikiRegion', {
        name: 'Deleted Region',
        parentRegion: null,
        latestRevisionDate: '2024-01-01T00:00:00' as db.TimestampString,
        deletedAt: '2024-01-01T00:00:00' as db.TimestampString,
        rawPageCount: 0,
        level: 0,
        bestMonths: JSON.stringify([]),
        isMajorRegion: false,
        isTopLevelRegion: false,
        url: 'https://ropewiki.com/Deleted_Region',
      })
      .run(conn);

    // Verify deletedAt is set
    const beforeRows = await db.select('RopewikiRegion', { name: 'Deleted Region' }).run(conn);
    const beforeRegion = beforeRows.find((r) => r.parentRegion === null);
    expect(beforeRegion?.deletedAt).not.toBeNull();

    // Upsert the region (same name and parentRegion)
    await upsertRegions(
      conn,
      [new RopewikiRegion('Deleted Region', undefined, 0, 0, undefined, [], false, false, latestRevisionDate)],
    );

    // Verify deletedAt is now null
    const afterRows = await db.select('RopewikiRegion', { name: 'Deleted Region' }).run(conn);
    const region = afterRows.find((r) => r.parentRegion === null) as s.RopewikiRegion.JSONSelectable;
    expect(region).toBeDefined();
    expect(region.deletedAt).toBeNull();
    expect(region.name).toBe('Deleted Region');
  });

  it('treats regions with same name but different parentRegion as different', async () => {
    const latestRevisionDate = new Date('2024-01-01T00:00:00Z');

    // Insert two regions with the same name but different parent regions
    await upsertRegions(
      conn,
      [
        new RopewikiRegion('Utah', 'World', 0, 1, undefined, [], false, false, latestRevisionDate),
        new RopewikiRegion('Utah', 'United States', 0, 2, undefined, [], false, false, latestRevisionDate),
      ],
    );

    const rows = await db.select('RopewikiRegion', { name: 'Utah' }).run(conn);
    expect(rows).toHaveLength(2);

    const utahWorld = rows.find((r) => r.parentRegion === 'World') as s.RopewikiRegion.JSONSelectable;
    const utahUS = rows.find((r) => r.parentRegion === 'United States') as s.RopewikiRegion.JSONSelectable;

    expect(utahWorld.name).toBe('Utah');
    expect(utahWorld.parentRegion).toBe('World');
    expect(utahUS.name).toBe('Utah');
    expect(utahUS.parentRegion).toBe('United States');
  });

  it('treats regions with same parentRegion but different name as different', async () => {
    const latestRevisionDate = new Date('2024-01-01T00:00:00Z');

    // Insert two regions with different names but same parent region
    await upsertRegions(
      conn,
      [
        new RopewikiRegion('Utah', 'World', 0, 1, undefined, [], false, false, latestRevisionDate),
        new RopewikiRegion('Nevada', 'World', 0, 1, undefined, [], false, false, latestRevisionDate),
      ],
    );

    const rows = await db.select('RopewikiRegion', { parentRegion: 'World' }).run(conn);
    expect(rows).toHaveLength(2);

    const utah = rows.find((r) => r.name === 'Utah') as s.RopewikiRegion.JSONSelectable;
    const nevada = rows.find((r) => r.name === 'Nevada') as s.RopewikiRegion.JSONSelectable;

    expect(utah.name).toBe('Utah');
    expect(utah.parentRegion).toBe('World');
    expect(nevada.name).toBe('Nevada');
    expect(nevada.parentRegion).toBe('World');
  });

  it('handles null parentRegion correctly for top-level regions', async () => {
    const latestRevisionDate = new Date('2024-01-01T00:00:00Z');

    // Insert a top-level region (parentRegion is null)
    await upsertRegions(
      conn,
      [new RopewikiRegion('World', undefined, 0, 0, undefined, [], false, false, latestRevisionDate)],
    );

    // Try to insert another region with same name but null parentRegion - should update
    await upsertRegions(
      conn,
      [new RopewikiRegion('World', undefined, 10, 0, 'Updated', [], true, true, latestRevisionDate)],
    );

    const rows = await db.select('RopewikiRegion', { name: 'World' }).run(conn);
    const region = rows.find((r) => r.parentRegion === null) as s.RopewikiRegion.JSONSelectable;
    expect(region).toBeDefined();
    expect(region.name).toBe('World');
    expect(region.parentRegion).toBeNull();
    expect(region.rawPageCount).toBe(10);
    expect(region.overview).toBe('Updated');
  });

  it('propagates errors from the database layer', async () => {
    const latestRevisionDate = new Date('2024-03-01T00:00:00Z');
    const regions: RopewikiRegion[] = [
      new RopewikiRegion('World', undefined, 0, 0, undefined, [], false, false, latestRevisionDate),
    ];

    // Use a client with a closed pool to force an error
    const badPool = new Pool({
      user: process.env.TEST_USER,
      password: process.env.TEST_PASS,
      host: process.env.TEST_HOST,
      port: process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : undefined,
      database: 'nonexistent_database_for_test_error',
    });

    await expect(upsertRegions(badPool, regions)).rejects.toBeDefined();

    await badPool.end();
  });
});
