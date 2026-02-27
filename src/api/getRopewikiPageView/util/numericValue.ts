import * as db from 'zapatos/db';

type JsonValue = { value?: number; unit?: string };

/**
 * Extracts the numeric value from a DB jsonb field shaped like { value: number, unit?: string }.
 * Returns 0 if null or missing value.
 */
function numericValue(v: db.JSONValue | null): number {
    if (v == null) return 0;
    const o = v as JsonValue;
    return typeof o?.value === 'number' ? o.value : 0;
}

export default numericValue;
