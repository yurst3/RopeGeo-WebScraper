import { imageHasCaption, type LegendItemInput, type PageRelevanceInput } from './types';

function pruneNullStats(stats: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(stats)) {
        if (value == null) continue;
        if (typeof value === 'string' && value.trim().length === 0) continue;
        out[key] = value;
    }
    return out;
}

/** JSON payload sent to the model for a single legend item. */
export function formatPageRelevancePayload(
    input: PageRelevanceInput,
    legendItem: LegendItemInput,
): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        pageName: input.page.name,
        legendItem: {
            id: legendItem.id,
            featureType: legendItem.featureType,
            name: legendItem.name,
        },
        betaSections: input.betaSections.map((section) => ({
            id: section.id,
            title: section.title,
            text: section.text,
        })),
        images: input.images
            .filter((image) => imageHasCaption(image.caption))
            .map((image) => ({
                id: image.id,
                caption: image.caption,
                betaSectionTitle: image.betaSectionTitle,
            })),
    };

    if (legendItem.featureType === 'line') {
        payload.pageStats = pruneNullStats(input.pageStats);
    }

    return payload;
}

export function formatPageRelevanceUserPrompt(
    input: PageRelevanceInput,
    legendItem: LegendItemInput,
): string {
    const payload = formatPageRelevancePayload(input, legendItem);
    return [
        `Find relevant content for legend item "${legendItem.name}" (featureType: ${legendItem.featureType}).`,
        'Return a single context object with relevant measurements, beta section excerpts, and images.',
        '',
        JSON.stringify(payload, null, 2),
    ].join('\n');
}
