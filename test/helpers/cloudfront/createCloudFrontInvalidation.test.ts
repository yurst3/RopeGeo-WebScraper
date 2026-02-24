import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createCloudFrontInvalidation } from '../../../src/helpers/cloudfront/createCloudFrontInvalidation';

const mockSend = jest.fn();
let createInvalidationCommandInput: Record<string, unknown> = {};

jest.mock('@aws-sdk/client-cloudfront', () => ({
    CloudFrontClient: jest.fn().mockImplementation(() => ({
        send: mockSend,
    })),
    CreateInvalidationCommand: jest.fn().mockImplementation((input: unknown) => {
        createInvalidationCommandInput = (input ?? {}) as Record<string, unknown>;
        return { input };
    }),
}));

describe('createCloudFrontInvalidation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createInvalidationCommandInput = {};
        (mockSend as jest.Mock).mockResolvedValue(undefined);
    });

    it('sends CreateInvalidation with distribution ID, paths, and caller reference', async () => {
        const arn = 'arn:aws:cloudfront::123456789012:distribution/E2ABC123XYZ';
        await createCloudFrontInvalidation(arn, ['/mapdata/trails/*'], 'generate-trail-tiles');

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(createInvalidationCommandInput.DistributionId).toBe('E2ABC123XYZ');
        const batch = createInvalidationCommandInput.InvalidationBatch as {
            Paths?: { Quantity: number; Items: string[] };
            CallerReference?: string;
        };
        expect(batch.Paths).toEqual({ Quantity: 1, Items: ['/mapdata/trails/*'] });
        expect(batch.CallerReference).toMatch(/^generate-trail-tiles-\d+$/);
    });

    it('supports multiple paths and custom caller reference', async () => {
        const arn = 'arn:aws:cloudfront::123:distribution/XYZ';
        await createCloudFrontInvalidation(arn, ['/mapdata/routeMarkers/*'], 'generate-route-marker-tiles');

        const batch = createInvalidationCommandInput.InvalidationBatch as {
            Paths?: { Quantity: number; Items: string[] };
            CallerReference?: string;
        };
        expect(batch.Paths).toEqual({ Quantity: 1, Items: ['/mapdata/routeMarkers/*'] });
        expect(batch.CallerReference).toMatch(/^generate-route-marker-tiles-\d+$/);
    });

    it('throws when distribution ARN has no ID segment', async () => {
        await expect(
            createCloudFrontInvalidation('arn:aws:cloudfront::123456789012:distribution/', ['/x'], 'test')
        ).rejects.toThrow(/Invalid CLOUDFRONT_DISTRIBUTION_ARN/);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('throws when ARN is empty after split', async () => {
        await expect(createCloudFrontInvalidation('', ['/x'], 'test')).rejects.toThrow(
            /Invalid CLOUDFRONT_DISTRIBUTION_ARN/
        );
        expect(mockSend).not.toHaveBeenCalled();
    });
});
