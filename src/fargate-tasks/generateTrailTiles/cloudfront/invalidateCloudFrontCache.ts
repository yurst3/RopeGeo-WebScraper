import { createCloudFrontInvalidation as createCloudFrontInvalidationForPaths } from 'ropegeo-common/helpers/cloudfront/createCloudFrontInvalidation';

const CALLER_REFERENCE = 'generate-trail-tiles';

/**
 * Invalidates the CloudFront cache for the trail tiles path using the job's caller reference.
 */
export async function invalidateCloudFrontCache(
    distributionArn: string,
    s3Prefix: string
): Promise<void> {
    await createCloudFrontInvalidationForPaths(
        distributionArn,
        [`/mapdata/${s3Prefix}/*`],
        CALLER_REFERENCE
    );
}
