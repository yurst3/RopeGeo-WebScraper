import type * as s from 'zapatos/schema';
import type * as db from 'zapatos/db';
import { parseReadinessRecord } from '../util/parseReadinessRecord';

export type ReadinessRecord = Record<string, boolean>;

export type PageZipperJobMessage = {
    id: string;
    pageId: string;
    pageSource: string;
};

/**
 * Domain model for a PageZipperJob row, including enqueue readiness.
 */
export class PageZipperJob {
    id: string;
    pageId: string;
    pageSource: string;
    pageReady: boolean;
    pageHasMapData: boolean;
    mapDataId: string | null;
    imageDataReady: ReadinessRecord | null;
    mapDataLegendItemsReady: ReadinessRecord | null;
    createdAt: db.TimestampString;
    updatedAt: db.TimestampString;

    constructor(
        id: string,
        pageId: string,
        pageSource: string,
        pageReady: boolean,
        pageHasMapData: boolean,
        mapDataId: string | null,
        imageDataReady: ReadinessRecord | null,
        mapDataLegendItemsReady: ReadinessRecord | null,
        createdAt: db.TimestampString,
        updatedAt: db.TimestampString,
    ) {
        this.id = id;
        this.pageId = pageId;
        this.pageSource = pageSource;
        this.pageReady = pageReady;
        this.pageHasMapData = pageHasMapData;
        this.mapDataId = mapDataId;
        this.imageDataReady = imageDataReady;
        this.mapDataLegendItemsReady = mapDataLegendItemsReady;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    static fromDbRow(row: s.PageZipperJob.JSONSelectable): PageZipperJob {
        return new PageZipperJob(
            row.id,
            row.pageId,
            row.pageSource,
            row.pageReady,
            row.pageHasMapData,
            row.mapDataId,
            parseReadinessRecord(row.imageDataReady),
            parseReadinessRecord(row.mapDataLegendItemsReady),
            row.createdAt,
            row.updatedAt,
        );
    }

    /**
     * True when page, images, and (when needed) map legend readiness are all satisfied.
     * Empty `{}` readiness maps count as ready.
     */
    readyToEnqueueMessage(): boolean {
        if (!this.pageReady) {
            return false;
        }

        if (
            this.imageDataReady == null
            || !Object.values(this.imageDataReady).every(Boolean)
        ) {
            return false;
        }

        if (!this.pageHasMapData) {
            return true;
        }

        if (this.mapDataId == null) {
            return false;
        }

        if (
            this.mapDataLegendItemsReady == null
            || !Object.values(this.mapDataLegendItemsReady).every(Boolean)
        ) {
            return false;
        }

        return true;
    }

    /** SQS body fields for enqueueing this job. */
    toMessage(): PageZipperJobMessage {
        return {
            id: this.id,
            pageId: this.pageId,
            pageSource: this.pageSource,
        };
    }
}

export default PageZipperJob;
