import * as db from 'zapatos/db';
import { Metadata } from '../types/metadata';

/**
 * Returns parsed metadata for the row, or null if no row or metadata column is null.
 */
const getImageDataMetadataById = async (
    conn: db.Queryable,
    imageDataId: string,
): Promise<Metadata | null> => {
    type Row = { metadata: db.JSONValue | null };
    const rows = await db.sql<db.SQL, Row[]>`
        SELECT "metadata" FROM "ImageData" WHERE "id" = ${db.param(imageDataId)}::uuid
    `.run(conn);
    const row = rows[0];
    if (row == null || row.metadata == null) {
        return null;
    }
    return Metadata.fromJSON(row.metadata);
};

export default getImageDataMetadataById;
