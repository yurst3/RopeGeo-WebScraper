import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { invalidateCloudFrontCache } from '../../../../src/fargate-tasks/generateTrailTiles/cloudfront/invalidateCloudFrontCache';

const mockCreateCloudFrontInvalidationForPaths = jest.fn();

jest.mock('ropegeo-common/helpers', () => ({
    createCloudFrontInvalidation: (arn: string, paths: string[], callerRef: string) =>
        mockCreateCloudFrontInvalidationForPaths(arn, paths, callerRef),
}));

describe('invalidateCloudFrontCache (generateTrailTiles)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateCloudFrontInvalidationForPaths.mockResolvedValue(undefined);
    });

    it('calls helper with distributionArn, /mapdata/{s3Prefix}/* path, and generate-trail-tiles caller ref', async () => {
        const arn = 'arn:aws:cloudfront::123:distribution/E2';
        await invalidateCloudFrontCache(arn, 'trails');

        expect(mockCreateCloudFrontInvalidationForPaths).toHaveBeenCalledTimes(1);
        expect(mockCreateCloudFrontInvalidationForPaths).toHaveBeenCalledWith(
            arn,
            ['/mapdata/trails/*'],
            'generate-trail-tiles'
        );
    });
});
