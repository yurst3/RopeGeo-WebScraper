import { CreateInvalidationCommand, CloudFrontClient } from '@aws-sdk/client-cloudfront';

/** CloudFront request path for the trails pmtiles file. */
export const PMTILES_CLOUDFRONT_PATH = '/mapdata/pmtiles/trails.pmtiles';

/**
 * Creates a CloudFront invalidation for the trails pmtiles file so the edge cache serves the new tileset.
 * @param distributionArn - ARN of the CloudFront distribution (e.g. arn:aws:cloudfront::123456789:distribution/E2ABC123)
 */
export async function createCloudFrontInvalidation(distributionArn: string): Promise<void> {
    const distributionId = distributionArn.split('/').pop();
    if (!distributionId) {
        throw new Error(`Invalid CLOUDFRONT_DISTRIBUTION_ARN: ${distributionArn}`);
    }
    const client = new CloudFrontClient({});
    const callerReference = `generate-trail-tiles-${Date.now()}`;
    await client.send(
        new CreateInvalidationCommand({
            DistributionId: distributionId,
            InvalidationBatch: {
                Paths: {
                    Quantity: 1,
                    Items: [PMTILES_CLOUDFRONT_PATH],
                },
                CallerReference: callerReference,
            },
        })
    );
    console.log(`Created CloudFront invalidation for ${PMTILES_CLOUDFRONT_PATH} (distribution ${distributionId})`);
}
