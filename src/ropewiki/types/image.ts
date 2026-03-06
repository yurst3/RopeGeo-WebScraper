import type * as s from 'zapatos/schema';

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
