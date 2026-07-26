import type {
    BetaSectionExcerpt,
    Context,
    LegendContextImage,
} from './legendContextSchema';
import {
    imageHasCaption,
    type LegendItemContextResult,
    type LegendItemInput,
    type PageRelevanceInput,
    type PageStatKey,
} from '../types/relevanceTypes';
import { pageStatsHasKey } from './formatPageRelevancePayload';

function captionedImagesById(input: PageRelevanceInput) {
    return new Map(
        input.images
            .filter((image) => imageHasCaption(image.caption))
            .map((image) => [image.id, image]),
    );
}

function textById(input: PageRelevanceInput) {
    return new Map(input.betaSections.map((section) => [section.id, section]));
}

function excerptWithoutRelevantPhrase(excerpt: BetaSectionExcerpt): BetaSectionExcerpt {
    return {
        id: excerpt.id,
        text: excerpt.text,
        relevanceStrength: excerpt.relevanceStrength,
    };
}

function imageWithoutRelevantPhrase(image: LegendContextImage): LegendContextImage {
    return {
        id: image.id,
        relevanceStrength: image.relevanceStrength,
    };
}

export function validateLegendContext(
    response: Context,
    input: PageRelevanceInput,
    legendItem: LegendItemInput,
): Context {
    const texts = textById(input);
    const imagesById = captionedImagesById(input);
    const removed: string[] = [];
    const cleared: string[] = [];

    const next: Context = {
        measurements: response.measurements,
        betaSectionExcerpts: response.betaSectionExcerpts,
        images: response.images,
    };

    if (next.measurements != null) {
        if (legendItem.featureType !== 'line') {
            removed.push('measurements: not allowed for non-line map features');
            next.measurements = null;
        } else {
            const measurements = next.measurements.filter((measurement, index) => {
                if (!pageStatsHasKey(input.pageStats, measurement.key as PageStatKey)) {
                    removed.push(
                        `measurements[${index}]: key "${measurement.key}" is not present in page measurements`,
                    );
                    return false;
                }
                return true;
            });
            next.measurements = measurements.length > 0 ? measurements : null;
        }
    }

    if (next.betaSectionExcerpts != null) {
        const excerpts: BetaSectionExcerpt[] = [];
        for (const [excerptIndex, excerpt] of next.betaSectionExcerpts.entries()) {
            const section = texts.get(excerpt.id);
            if (section == null) {
                removed.push(`betaSectionExcerpts[${excerptIndex}]: id "${excerpt.id}"`);
                continue;
            }
            const phrase = excerpt.relevantPhrase;
            if (phrase == null) {
                excerpts.push(excerptWithoutRelevantPhrase(excerpt));
                continue;
            }
            const inTitle = section.title.includes(phrase);
            const inBody = section.text.includes(phrase);
            if (!inTitle && !inBody) {
                cleared.push(
                    `betaSectionExcerpts[${excerptIndex}]: relevantPhrase not found in title/body`,
                );
                excerpts.push(excerptWithoutRelevantPhrase(excerpt));
                continue;
            }
            if (excerpt.text != null && !excerpt.text.includes(phrase)) {
                cleared.push(
                    `betaSectionExcerpts[${excerptIndex}]: relevantPhrase not found in excerpt text`,
                );
                excerpts.push(excerptWithoutRelevantPhrase(excerpt));
                continue;
            }
            excerpts.push(excerpt);
        }
        next.betaSectionExcerpts = excerpts.length > 0 ? excerpts : null;
    }

    if (next.images != null) {
        const images: LegendContextImage[] = [];
        for (const [imageIndex, image] of next.images.entries()) {
            const source = imagesById.get(image.id);
            if (source == null) {
                removed.push(`images[${imageIndex}]: id "${image.id}"`);
                continue;
            }
            const phrase = image.relevantPhrase;
            if (phrase == null) {
                images.push(imageWithoutRelevantPhrase(image));
                continue;
            }
            if (!(source.caption ?? '').includes(phrase)) {
                cleared.push(`images[${imageIndex}]: relevantPhrase not found in caption`);
                images.push(imageWithoutRelevantPhrase(image));
                continue;
            }
            images.push(image);
        }
        next.images = images.length > 0 ? images : null;
    }

    if (removed.length > 0) {
        console.log('  Removed invalid relevant-context entries:');
        for (const line of removed) {
            console.log(`    - ${line}`);
        }
    }
    if (cleared.length > 0) {
        console.log('  Cleared relevantPhrase on entries (kept without phrase):');
        for (const line of cleared) {
            console.log(`    - ${line}`);
        }
    }

    return next;
}

function legendFeatureTypeLabel(featureType: 'point' | 'line' | 'polygon'): string {
    switch (featureType) {
        case 'point':
            return 'point';
        case 'line':
            return 'line';
        case 'polygon':
            return 'polygon';
    }
}

export function formatLegendContextResultsForLog(results: LegendItemContextResult[]): string {
    const annotated = results.map(({ legendItem, context }) => ({
        legendId: legendItem.id,
        legendName: legendItem.name,
        legendType: legendFeatureTypeLabel(legendItem.featureType),
        ...context,
    }));
    return JSON.stringify(annotated, null, 2);
}
