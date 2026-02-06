import { SQSClient } from '@aws-sdk/client-sqs';

let sharedClient: SQSClient | null = null;

/**
 * Returns a shared SQS client for the current Lambda container.
 * Reusing a single client avoids repeated DNS lookups (getaddrinfo) and connection churn,
 * which can trigger EBUSY under load when many SQS calls run concurrently.
 */
export const getSQSClient = (): SQSClient => {
    if (!sharedClient) {
        sharedClient = new SQSClient({});
    }
    return sharedClient;
};

/** Reset shared client (for tests only). */
export const resetSQSClientForTests = (): void => {
    sharedClient = null;
};
