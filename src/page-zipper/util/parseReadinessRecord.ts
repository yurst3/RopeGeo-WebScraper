/**
 * Coerces a jsonb readiness map to `Record<string, boolean>`, or null when missing/invalid.
 * Empty object `{}` is a valid seeded-ready map.
 */
export function parseReadinessRecord(value: unknown): Record<string, boolean> | null {
    if (value == null) {
        return null;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const record: Record<string, boolean> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (typeof entry !== 'boolean') {
            return null;
        }
        record[key] = entry;
    }
    return record;
}
