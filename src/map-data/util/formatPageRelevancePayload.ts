import {
    imageHasCaption,
    type LegendItemInput,
    type PageRelevanceInput,
    type PageStatKey,
    type PageStatsInput,
} from '../types/relevanceTypes';

function pruneNullStats(stats: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(stats)) {
        if (value == null) continue;
        if (typeof value === 'string' && value.trim().length === 0) continue;
        out[key] = value;
    }
    return out;
}

/** Measurements object presented to the model for a line map feature (pruned page stats). */
export function measurementsForMapFeature(
    input: PageRelevanceInput,
    legendItem: LegendItemInput,
): Record<string, unknown> | undefined {
    if (legendItem.featureType !== 'line') return undefined;
    const pruned = pruneNullStats(input.pageStats);
    return Object.keys(pruned).length > 0 ? pruned : {};
}

/** JSON payload sent to the model for a single map feature. */
export function formatPageRelevancePayload(
    input: PageRelevanceInput,
    legendItem: LegendItemInput,
): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        pageName: input.page.name,
        mapFeature: {
            id: legendItem.id,
            featureType: legendItem.featureType,
            name: legendItem.name,
        },
        text: input.betaSections.map((section) => ({
            id: section.id,
            title: section.title,
            body: section.text,
        })),
        images: input.images
            .filter((image) => imageHasCaption(image.caption))
            .map((image) => ({
                id: image.id,
                caption: image.caption,
            })),
    };

    const measurements = measurementsForMapFeature(input, legendItem);
    if (measurements != null) {
        payload.measurements = measurements;
    }

    return payload;
}

export function formatPageRelevanceUserPrompt(
    input: PageRelevanceInput,
    legendItem: LegendItemInput,
): string {
    const payload = formatPageRelevancePayload(input, legendItem);
    return [
        `Find relevant content for map feature "${legendItem.name}" (featureType: ${legendItem.featureType}).`,
        'Return a single context object with relevant measurements, text excerpts (betaSectionExcerpts), and images.',
        '',
        JSON.stringify(payload, null, 2),
    ].join('\n');
}

/** Normalize a page-stat / measurements entry to comparable value + optional unitName. */
export function normalizeMeasurementEntry(
    raw: unknown,
): { value: number; unitName?: string } | null {
    if (raw == null) return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return { value: raw };
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.value !== 'number' || !Number.isFinite(r.value)) return null;
    let unitName: string | undefined;
    if (typeof r.unitName === 'string') {
        unitName = r.unitName;
    } else if (typeof r.unit === 'string') {
        unitName = r.unit;
    } else if (
        r.unit != null &&
        typeof r.unit === 'object' &&
        !Array.isArray(r.unit) &&
        typeof (r.unit as { name?: unknown }).name === 'string'
    ) {
        unitName = (r.unit as { name: string }).name;
    }
    return unitName != null ? { value: r.value, unitName } : { value: r.value };
}

export function pageStatsHasKey(pageStats: PageStatsInput, key: PageStatKey): boolean {
    return normalizeMeasurementEntry(pageStats[key]) != null;
}
