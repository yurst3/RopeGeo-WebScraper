import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getCloudfrontDistributionArn } from '../../../../src/fargate-jobs/generateTrailTiles/cloudfront/getCloudfrontDistributionArn';

describe('getCloudfrontDistributionArn (generateTrailTiles)', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = process.env;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('returns trimmed CLOUDFRONT_DISTRIBUTION_ARN from env', () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = '  arn:aws:cloudfront::123:distribution/E2  ';

        expect(getCloudfrontDistributionArn()).toBe('arn:aws:cloudfront::123:distribution/E2');
    });

    it('throws when CLOUDFRONT_DISTRIBUTION_ARN is undefined', () => {
        delete process.env.CLOUDFRONT_DISTRIBUTION_ARN;

        expect(() => getCloudfrontDistributionArn()).toThrow('CLOUDFRONT_DISTRIBUTION_ARN is required');
    });

    it('throws when CLOUDFRONT_DISTRIBUTION_ARN is empty or whitespace only', () => {
        process.env.CLOUDFRONT_DISTRIBUTION_ARN = '';
        expect(() => getCloudfrontDistributionArn()).toThrow('CLOUDFRONT_DISTRIBUTION_ARN is required');

        process.env.CLOUDFRONT_DISTRIBUTION_ARN = '   ';
        expect(() => getCloudfrontDistributionArn()).toThrow('CLOUDFRONT_DISTRIBUTION_ARN is required');
    });
});
