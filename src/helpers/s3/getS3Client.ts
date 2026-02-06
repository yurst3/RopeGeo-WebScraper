import { S3Client } from '@aws-sdk/client-s3';

let sharedClient: S3Client | null = null;

/**
 * Returns a shared S3 client for the current Lambda container.
 * Reusing a single client avoids repeated DNS lookups (getaddrinfo) and connection churn,
 * which can help prevent EBUSY and similar errors under load.
 */
export const getS3Client = (): S3Client => {
    if (!sharedClient) {
        sharedClient = new S3Client({});
    }
    return sharedClient;
};

/** Reset shared client (for tests only). */
export const resetS3ClientForTests = (): void => {
    sharedClient = null;
};
