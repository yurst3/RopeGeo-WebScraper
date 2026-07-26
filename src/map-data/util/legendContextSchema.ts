import { z } from 'zod';
import { MEASUREMENT_KEYS, RELEVANCE_STRENGTHS } from 'ropegeo-common/models';

const measurementKeySchema = z.enum(MEASUREMENT_KEYS);
const relevanceStrengthSchema = z.enum(RELEVANCE_STRENGTHS);

const measurementSchema = z.object({
    key: measurementKeySchema.describe(
        'Page-stat key from the request measurements object (e.g. approachElevGain, shuttleTime)',
    ),
    relevanceStrength: relevanceStrengthSchema,
});

const betaSectionExcerptSchema = z.object({
    id: z.string().describe('id of the text block from the request text[] array'),
    text: z
        .string()
        .nullable()
        .describe(
            'Verbatim body excerpt surrounding the relevantPhrase, or null when relevance is title-only',
        ),
    relevanceStrength: relevanceStrengthSchema,
    relevantPhrase: z
        .string()
        .min(1)
        .optional()
        .describe('Verbatim substring of the text title and/or body that connects to the map feature'),
});

const legendContextImageSchema = z.object({
    id: z.string(),
    relevanceStrength: relevanceStrengthSchema,
    relevantPhrase: z
        .string()
        .min(1)
        .optional()
        .describe('Verbatim substring of the image caption'),
});

export const legendContextSchema = z.object({
    measurements: z.array(measurementSchema).nullable(),
    betaSectionExcerpts: z.array(betaSectionExcerptSchema).nullable(),
    images: z.array(legendContextImageSchema).nullable(),
});

export type Measurement = z.infer<typeof measurementSchema>;
export type BetaSectionExcerpt = z.infer<typeof betaSectionExcerptSchema>;
export type LegendContextImage = z.infer<typeof legendContextImageSchema>;
export type Context = z.infer<typeof legendContextSchema>;
