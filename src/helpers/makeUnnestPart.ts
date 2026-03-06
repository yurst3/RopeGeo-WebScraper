import * as db from 'zapatos/db';

/**
 * Build one unnest param fragment with correct array type cast for zapatos tagged template.
 */
function unnestParam(
    sql: typeof db.sql,
    param: typeof db.param,
    arr: unknown[],
    type: string,
): ReturnType<typeof sql> {
    switch (type) {
        case 'text':
            return sql`${param(arr)}::text[]`;
        case 'uuid':
            return sql`${param(arr)}::uuid[]`;
        case 'integer':
            return sql`${param(arr)}::integer[]`;
        case 'numeric':
            return sql`${param(arr)}::numeric[]`;
        case 'jsonb':
            return sql`${param(arr)}::jsonb[]`;
        case 'timestamp':
            return sql`${param(arr)}::timestamp[]`;
        case 'boolean':
            return sql`${param(arr)}::boolean[]`;
        default:
            return sql`${param(arr)}::text[]`;
    }
}

/**
 * Type for a class/object that provides insert column metadata for batch unnest().
 * Used with makeUnnestPart.
 */
export interface DbInsertRowClass<TRow extends object> {
    getDbInsertColumns(): readonly (keyof TRow)[];
    getDbInsertColumnTypes(): readonly string[];
}

/**
 * Build the unnest(...) SQL fragment for batch INSERT from a row class and rows array.
 * Uses RowClass.getDbInsertColumns() and getDbInsertColumnTypes(); throws if either is missing.
 */
export function makeUnnestPart<TRow extends object>(
    RowClass: DbInsertRowClass<TRow>,
    rows: TRow[],
): ReturnType<typeof db.sql> {
    if (typeof RowClass.getDbInsertColumns !== 'function' || typeof RowClass.getDbInsertColumnTypes !== 'function') {
        throw new Error('Row class must have getDbInsertColumns() and getDbInsertColumnTypes()');
    }
    const columns = RowClass.getDbInsertColumns();
    const columnTypes = RowClass.getDbInsertColumnTypes();
    const columnArrays = columns.map((col) => rows.map((r) => (r as Record<keyof TRow, unknown>)[col]));
    const unnestFragments = columnArrays.map((arr, i) =>
        unnestParam(db.sql, db.param, arr, columnTypes[i]!),
    );
    return unnestFragments.length > 0
        ? unnestFragments.slice(1).reduce((prev, f) => db.sql`${prev}, ${f}`, unnestFragments[0]!)
        : db.sql``;
}
