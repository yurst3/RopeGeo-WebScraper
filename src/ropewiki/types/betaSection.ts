import type * as s from 'zapatos/schema';

/** Plain row shape returned by toDbRow (insert columns we supply). */
export interface BetaSectionInsertRow {
    ropewikiPage: string;
    title: string;
    text: string;
    order: number;
    latestRevisionDate: Date;
    updatedAt: Date;
    deletedAt: null;
}

export class RopewikiBetaSection {
    title: string;
    text: string;
    order: number;

    constructor(title: string, text: string, order: number) {
        this.title = title;
        this.text = text;
        this.order = order;
    }

    /** Column keys for batch INSERT in order (excludes id, createdAt). Use with toDbRow() to build column arrays for unnest(). */
    static getDbInsertColumns(): readonly (keyof BetaSectionInsertRow)[] {
        return [
            'ropewikiPage', 'title', 'text', 'order', 'latestRevisionDate', 'updatedAt', 'deletedAt',
        ];
    }

    /** PostgreSQL array type for each getDbInsertColumns() entry. */
    static getDbInsertColumnTypes(): readonly string[] {
        return ['uuid', 'text', 'text', 'integer', 'timestamp', 'timestamp', 'timestamp'];
    }

    /** Build insert row for this section; call with page context when upserting. */
    toDbRow(pageUuid: string, latestRevisionDate: Date): BetaSectionInsertRow {
        const now = new Date();
        return {
            ropewikiPage: pageUuid,
            title: this.title,
            text: this.text,
            order: this.order,
            latestRevisionDate,
            updatedAt: now,
            deletedAt: null,
        };
    }
}
