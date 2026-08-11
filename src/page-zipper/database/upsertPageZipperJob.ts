import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import { PageDataSource } from 'ropegeo-common/models';
import PageZipperJob, { type ReadinessRecord } from '../types/pageZipperJob';

export type { ReadinessRecord };
export { PageZipperJob };

function readinessAsJsonb(value: ReadinessRecord | null): db.JSONValue | null {
    if (value == null) {
        return null;
    }
    return value as db.JSONValue;
}

type UpdateColumn = Exclude<keyof s.PageZipperJob.Updatable, 'id' | 'pageId' | 'createdAt'>;

/**
 * Upserts a PageZipperJob by pageId, writing only fields the caller supplies (`undefined` = leave alone).
 * `flipImageId` / `flipLegendItemId` merge that key to true when the readiness map is already seeded;
 * if there is no job or the map is still NULL, returns undefined.
 */
const upsertPageZipperJob = async (
    conn: db.Queryable,
    pageId: string,
    pageSource?: PageDataSource | string,
    pageReady?: boolean,
    mapDataId?: string | null,
    pageHasMapData?: boolean,
    imageDataReady?: ReadinessRecord | null,
    mapDataLegendItemsReady?: ReadinessRecord | null,
    flipImageId?: string,
    flipLegendItemId?: string,
): Promise<PageZipperJob | undefined> => {
    const existingRow = await db.selectOne('PageZipperJob', { pageId }).run(conn);
    const existing = existingRow != null ? PageZipperJob.fromDbRow(existingRow) : undefined;

    let nextImageDataReady = imageDataReady;
    let nextMapDataLegendItemsReady = mapDataLegendItemsReady;
    let nextPageHasMapData = pageHasMapData;

    if (flipImageId != null) {
        if (existing == null) {
            return undefined;
        }
        const current =
            nextImageDataReady !== undefined
                ? nextImageDataReady
                : existing.imageDataReady;
        if (current == null) {
            return undefined;
        }
        nextImageDataReady = { ...current, [flipImageId]: true };
    }

    if (flipLegendItemId != null) {
        if (existing == null) {
            return undefined;
        }
        const current =
            nextMapDataLegendItemsReady !== undefined
                ? nextMapDataLegendItemsReady
                : existing.mapDataLegendItemsReady;
        if (current == null) {
            return undefined;
        }
        nextMapDataLegendItemsReady = { ...current, [flipLegendItemId]: true };
    }

    if (nextPageHasMapData === false && nextMapDataLegendItemsReady === undefined) {
        nextMapDataLegendItemsReady = {};
    }

    const resolvedPageSource = pageSource ?? existing?.pageSource;
    if (resolvedPageSource == null || resolvedPageSource === '') {
        throw new Error(
            `upsertPageZipperJob: pageSource is required when inserting PageZipperJob for pageId=${pageId}`,
        );
    }

    const now = new Date();
    const insertRow: s.PageZipperJob.Insertable = {
        pageId,
        pageSource: resolvedPageSource,
        updatedAt: now,
    };
    const updateColumns: UpdateColumn[] = ['updatedAt'];

    if (pageSource !== undefined) {
        updateColumns.push('pageSource');
    }
    if (pageReady !== undefined) {
        insertRow.pageReady = pageReady;
        updateColumns.push('pageReady');
    }
    if (mapDataId !== undefined) {
        insertRow.mapDataId = mapDataId;
        updateColumns.push('mapDataId');
    }
    if (nextPageHasMapData !== undefined) {
        insertRow.pageHasMapData = nextPageHasMapData;
        updateColumns.push('pageHasMapData');
    }
    if (nextImageDataReady !== undefined) {
        insertRow.imageDataReady = readinessAsJsonb(nextImageDataReady);
        updateColumns.push('imageDataReady');
    }
    if (nextMapDataLegendItemsReady !== undefined) {
        insertRow.mapDataLegendItemsReady = readinessAsJsonb(nextMapDataLegendItemsReady);
        updateColumns.push('mapDataLegendItemsReady');
    }

    await db
        .upsert('PageZipperJob', insertRow, 'pageId', { updateColumns })
        .run(conn);

    const row = await db.selectOne('PageZipperJob', { pageId }).run(conn);
    if (row == null) {
        throw new Error(`PageZipperJob missing after write for pageId=${pageId}`);
    }

    return PageZipperJob.fromDbRow(row);
};

export default upsertPageZipperJob;
export { upsertPageZipperJob };
