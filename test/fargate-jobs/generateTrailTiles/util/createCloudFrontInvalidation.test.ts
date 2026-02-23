import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
    createCloudFrontInvalidation,
    PMTILES_CLOUDFRONT_PATH,
} from '../../../../src/fargate-jobs/generateTrailTiles/util/createCloudFrontInvalidation';

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

describe('createCloudFrontInvalidation (generateTrailTiles)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createInvalidationCommandInput = {};
        (mockSend as jest.Mock).mockResolvedValue(undefined);
    });

    it('sends CreateInvalidation with distribution ID and trails path', async () => {
        const arn = 'arn:aws:cloudfront::123456789012:distribution/E2ABC123XYZ';
        await createCloudFrontInvalidation(arn);

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(createInvalidationCommandInput.DistributionId).toBe('E2ABC123XYZ');
        const batch = createInvalidationCommandInput.InvalidationBatch as {
            Paths?: { Quantity: number; Items: string[] };
            CallerReference?: string;
        };
        expect(batch.Paths).toEqual({ Quantity: 1, Items: [PMTILES_CLOUDFRONT_PATH] });
        expect(batch.CallerReference).toMatch(/^generate-trail-tiles-\d+$/);
    });

    it('exports PMTILES_CLOUDFRONT_PATH for trails', () => {
        expect(PMTILES_CLOUDFRONT_PATH).toBe('/mapdata/pmtiles/trails.pmtiles');
    });

    it('throws when distribution ARN has no ID segment', async () => {
        await expect(createCloudFrontInvalidation('arn:aws:cloudfront::123456789012:distribution/')).rejects.toThrow(
            /Invalid CLOUDFRONT_DISTRIBUTION_ARN/
        );
        expect(mockSend).not.toHaveBeenCalled();
    });
});
