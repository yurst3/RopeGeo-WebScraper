import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { invalidateCloudFrontCache } from '../../../../src/fargate-tasks/generateRouteMarkerTiles/cloudfront/invalidateCloudFrontCache';

const mockCreateCloudFrontInvalidationForPaths = jest.fn();

jest.mock('../../../../src/helpers/cloudfront/createCloudFrontInvalidation', () => ({
    createCloudFrontInvalidation: (arn: string, paths: string[], callerRef: string) =>
        mockCreateCloudFrontInvalidationForPaths(arn, paths, callerRef),
}));

describe('invalidateCloudFrontCache (generateRouteMarkerTiles)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateCloudFrontInvalidationForPaths.mockResolvedValue(undefined);
    });

    it('calls helper with distributionArn, /mapdata/{s3Prefix}/* path, and generate-route-marker-tiles caller ref', async () => {
        const arn = 'arn:aws:cloudfront::123:distribution/E2';
        await invalidateCloudFrontCache(arn, 'routeMarkers');

        expect(mockCreateCloudFrontInvalidationForPaths).toHaveBeenCalledTimes(1);
        expect(mockCreateCloudFrontInvalidationForPaths).toHaveBeenCalledWith(
            arn,
            ['/mapdata/routeMarkers/*'],
            'generate-route-marker-tiles'
        );
    });
});
