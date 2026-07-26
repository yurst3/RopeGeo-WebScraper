import type { Context } from './legendContextSchema';

export type RelevantContextDbJson = {
    measurements: { key: string; relevanceStrength: string }[] | null;
    betaSectionExcerpts: Record<
        string,
        { text?: string; relevanceStrength: string; relevantPhrase?: string }[]
    > | null;
    images: { id: string; relevanceStrength: string; relevantPhrase?: string }[] | null;
};

/** True when the model response has at least one measurements, beta excerpt, or image. */
export function hasRelevantContextContent(context: Context): boolean {
    const hasMeasurements = context.measurements != null && context.measurements.length > 0;
    const hasBeta =
        context.betaSectionExcerpts != null && context.betaSectionExcerpts.length > 0;
    const hasImages = context.images != null && context.images.length > 0;
    return hasMeasurements || hasBeta || hasImages;
}

export function contextToDbJson(context: Context): RelevantContextDbJson {
    let measurements: RelevantContextDbJson['measurements'] = null;
    if (context.measurements != null && context.measurements.length > 0) {
        measurements = context.measurements.map((entry) => ({
            key: entry.key,
            relevanceStrength: entry.relevanceStrength,
        }));
    }

    let betaSectionExcerpts: RelevantContextDbJson['betaSectionExcerpts'] = null;
    if (context.betaSectionExcerpts != null && context.betaSectionExcerpts.length > 0) {
        const grouped: NonNullable<RelevantContextDbJson['betaSectionExcerpts']> = {};
        for (const excerpt of context.betaSectionExcerpts) {
            const key = excerpt.id;
            if (!grouped[key]) grouped[key] = [];
            const item: {
                text?: string;
                relevanceStrength: string;
                relevantPhrase?: string;
            } = {
                relevanceStrength: excerpt.relevanceStrength,
            };
            if (excerpt.relevantPhrase != null) {
                item.relevantPhrase = excerpt.relevantPhrase;
            }
            if (excerpt.text != null && excerpt.text.length > 0) {
                item.text = excerpt.text;
            }
            grouped[key].push(item);
        }
        betaSectionExcerpts = grouped;
    }

    let images: RelevantContextDbJson['images'] = null;
    if (context.images != null && context.images.length > 0) {
        images = context.images.map((image) => {
            const item: {
                id: string;
                relevanceStrength: string;
                relevantPhrase?: string;
            } = {
                id: image.id,
                relevanceStrength: image.relevanceStrength,
            };
            if (image.relevantPhrase != null) {
                item.relevantPhrase = image.relevantPhrase;
            }
            return item;
        });
    }

    return { measurements, betaSectionExcerpts, images };
}
