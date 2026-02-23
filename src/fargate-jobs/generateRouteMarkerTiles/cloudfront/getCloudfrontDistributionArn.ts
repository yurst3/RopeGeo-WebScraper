/**
 * Returns CLOUDFRONT_DISTRIBUTION_ARN from env, trimmed. Throws if undefined.
 */
export function getCloudfrontDistributionArn(): string {
    const value = process.env.CLOUDFRONT_DISTRIBUTION_ARN;
    if (value === undefined) {
        throw new Error('CLOUDFRONT_DISTRIBUTION_ARN is required');
    }
    return value.trim();
}
