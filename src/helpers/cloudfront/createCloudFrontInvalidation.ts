import { CreateInvalidationCommand, CloudFrontClient } from '@aws-sdk/client-cloudfront';

/**
 * Creates a CloudFront invalidation for the given paths so the edge cache serves fresh content.
 *
 * @param distributionArn - ARN of the CloudFront distribution (e.g. arn:aws:cloudfront::123456789:distribution/E2ABC123)
 * @param paths - Paths to invalidate (e.g. ['/mapdata/trails/*'])
 * @param callerReference - Base string for the invalidation caller reference; timestamp is appended for uniqueness
 */
export async function createCloudFrontInvalidation(
    distributionArn: string,
    paths: string[],
    callerReference: string
): Promise<void> {
    const distributionId = distributionArn.split('/').pop();
    if (!distributionId) {
        throw new Error(`Invalid CLOUDFRONT_DISTRIBUTION_ARN: ${distributionArn}`);
    }
    const client = new CloudFrontClient({});
    const callerRef = `${callerReference}-${Date.now()}`;
    await client.send(
        new CreateInvalidationCommand({
            DistributionId: distributionId,
            InvalidationBatch: {
                Paths: {
                    Quantity: paths.length,
                    Items: paths,
                },
                CallerReference: callerRef,
            },
        })
    );
    console.log(`Created CloudFront invalidation for ${paths.join(', ')} (distribution ${distributionId})`);
}
