/**
 * Returns CLOUDFRONT_DISTRIBUTION_ARN from env, trimmed. Throws if missing or falsy after trim.
 */
export function getCloudfrontDistributionArn(): string {
    const value = (process.env.CLOUDFRONT_DISTRIBUTION_ARN ?? '').trim();
    if (!value) {
        throw new Error('CLOUDFRONT_DISTRIBUTION_ARN is required');
    }
    return value;
}
