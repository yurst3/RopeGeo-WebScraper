import * as db from 'zapatos/db';

/**
 * Parses a DB jsonb array into a string array. Returns [] if null or not an array.
 */
function stringArray(v: db.JSONValue | null): string[] {
    if (v == null) return [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export default stringArray;
