import type * as s from 'zapatos/schema';
import { PageDataSource, type ImageVersion } from 'ropegeo-common/models';
import { ImageDataEvent } from '../../image-data/types/lambdaEvent';

/** Plain row shape returned by toDbRow (insert columns we supply). */
export interface ImageInsertRow {
    ropewikiPage: string;
    betaSection: string | null;
    linkUrl: string;
    fileUrl: string;
    caption: string | null;
    order: number;
    latestRevisionDate: Date;
    updatedAt: Date;
    deletedAt: null;
}

export class RopewikiImage {
    /** Set when built from DB (e.g. fromDbRow); required for toImageDataEvent(). */
    id?: string;
    /** Set when built from DB (e.g. upsertImages RETURNING). FK to ImageData when present. */
    processedImage?: string | null;
    betaSectionTitle: string | undefined;
    linkUrl: string;
    fileUrl: string;
    caption: string | undefined;
    order: number;

    constructor(
        betaSectionTitle: string | undefined,
        linkUrl: string,
        fileUrl: string,
        caption: string | undefined,
        order: number,
    ) {
        this.betaSectionTitle = betaSectionTitle;
        this.linkUrl = linkUrl;
        this.fileUrl = fileUrl;
        this.caption = caption;
        this.order = order;
    }

    /**
     * Builds a RopewikiImage from a zapatos RopewikiImage row (e.g. RETURNING or select).
     * betaSectionTitle is not on the row (row has betaSection uuid), so it is left undefined.
     */
    static fromDbRow(row: s.RopewikiImage.JSONSelectable): RopewikiImage {
        const img = new RopewikiImage(
            undefined,
            row.linkUrl,
            row.fileUrl,
            row.caption ?? undefined,
            row.order ?? 0,
        );
        img.id = row.id;
        img.processedImage = row.processedImage ?? null;
        return img;
    }

    /**
     * Returns an ImageDataEvent for this image (e.g. to enqueue for AVIF processing).
     * @throws Error if this image has no id (e.g. not loaded from DB)
     */
    toImageDataEvent(downloadSource: boolean = true, versions?: ImageVersion[]): ImageDataEvent {
        if (this.id === undefined || this.id === null || this.id === '') {
            throw new Error('RopewikiImage must have an id to create ImageDataEvent');
        }
        return new ImageDataEvent(
            PageDataSource.Ropewiki,
            this.id,
            this.fileUrl,
            downloadSource,
            this.processedImage ?? undefined,
            versions,
        );
    }

    /** Column keys for batch INSERT in order (excludes id, createdAt). Use with toDbRow() to build column arrays for unnest(). */
    static getDbInsertColumns(): readonly (keyof ImageInsertRow)[] {
        return [
            'ropewikiPage', 'betaSection', 'linkUrl', 'fileUrl', 'caption', 'order', 'latestRevisionDate', 'updatedAt', 'deletedAt',
        ];
    }

    /** PostgreSQL array type for each getDbInsertColumns() entry. */
    static getDbInsertColumnTypes(): readonly string[] {
        return ['uuid', 'uuid', 'text', 'text', 'text', 'integer', 'timestamp', 'timestamp', 'timestamp'];
    }

    /** Build insert row for this image; call with page context when upserting. */
    toDbRow(
        pageUuid: string,
        betaTitleIds: { [title: string]: string },
        latestRevisionDate: Date,
    ): ImageInsertRow {
        if (this.betaSectionTitle && !betaTitleIds[this.betaSectionTitle]) {
            throw new Error(`No id given for ${this.betaSectionTitle} title`);
        }
        const now = new Date();
        return {
            ropewikiPage: pageUuid,
            betaSection: this.betaSectionTitle ? betaTitleIds[this.betaSectionTitle] ?? null : null,
            linkUrl: this.linkUrl,
            fileUrl: this.fileUrl,
            caption: this.caption ?? null,
            order: this.order,
            latestRevisionDate,
            updatedAt: now,
            deletedAt: null,
        };
    }
}
