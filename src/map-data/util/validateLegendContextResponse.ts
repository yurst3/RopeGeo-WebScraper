import type { Context } from './legendContextSchema';
import {
    imageHasCaption,
    type LegendItemContextResult,
    type PageRelevanceInput,
} from '../types/relevanceTypes';

function captionedImageIds(input: PageRelevanceInput): Set<string> {
    return new Set(
        input.images.filter((image) => imageHasCaption(image.caption)).map((image) => image.id),
    );
}

export function validateLegendContext(
    response: Context,
    input: PageRelevanceInput,
): Context {
    const betaSectionIds = new Set(input.betaSections.map((section) => section.id));
    const imageIds = captionedImageIds(input);
    const removed: string[] = [];

    const next: Context = {
        measurements: response.measurements,
        betaSectionExcerpts: response.betaSectionExcerpts,
        images: response.images,
    };

    if (next.betaSectionExcerpts != null) {
        const excerpts = next.betaSectionExcerpts.filter((excerpt, excerptIndex) => {
            if (betaSectionIds.has(excerpt.id)) {
                return true;
            }
            removed.push(`betaSectionExcerpts[${excerptIndex}]: id "${excerpt.id}"`);
            return false;
        });
        next.betaSectionExcerpts = excerpts.length > 0 ? excerpts : null;
    }

    if (next.images != null) {
        const images = next.images.flatMap((image, imageIndex) => {
            if (!imageIds.has(image.id)) {
                removed.push(`images[${imageIndex}]: id "${image.id}"`);
                return [];
            }

            if (image.betaSectionId != null && !betaSectionIds.has(image.betaSectionId)) {
                removed.push(`images[${imageIndex}]: betaSectionId "${image.betaSectionId}"`);
                return [{ id: image.id, betaSectionId: null, confidence: image.confidence }];
            }

            return [image];
        });
        next.images = images.length > 0 ? images : null;
    }

    if (removed.length > 0) {
        console.log('  Removed invalid IDs:');
        for (const line of removed) {
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
