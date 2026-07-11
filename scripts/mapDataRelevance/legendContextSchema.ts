import { z } from 'zod';
import { MEASUREMENT_UNIT_NAMES, PAGE_STAT_KEYS } from './types';

const pageStatKeySchema = z.enum(PAGE_STAT_KEYS);
const measurementUnitNameSchema = z.enum(MEASUREMENT_UNIT_NAMES);

const measurementSchema = z.object({
    label: pageStatKeySchema,
    value: z.number(),
    unitName: measurementUnitNameSchema.describe(
        'Measurement unit name. Plain numeric elevation stats (approachElevGain, descentElevGain, exitElevGain) are stored in feet. Plain numeric segment length stats (approachLength, descentLength, exitLength) are stored in miles.',
    ),
    confidence: z.number().min(0).max(1),
});

const betaSectionExcerptSchema = z.object({
    id: z.string(),
    text: z.string().nullable(),
    confidence: z.number().min(0).max(1),
});

const legendContextImageSchema = z.object({
    id: z.string(),
    betaSectionId: z.string().nullable(),
    confidence: z.number().min(0).max(1),
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
