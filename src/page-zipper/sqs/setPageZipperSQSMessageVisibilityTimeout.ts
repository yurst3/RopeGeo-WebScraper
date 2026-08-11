import { changeSQSMessageVisibilityTimeout } from 'ropegeo-common/helpers';

const getVisibilityTimeoutSeconds = (): number => {
    const raw = process.env.PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS;
    if (raw === undefined || raw === '') {
        throw new Error('PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS environment variable is not set');
    }
    const value = parseInt(raw, 10);
    if (Number.isNaN(value) || value < 0 || value > 43200) {
        throw new Error(
            `PAGE_ZIPPER_PROCESSOR_TIMEOUT_SECONDS must be between 0 and 43200, got: ${raw}`,
        );
    }
    return value;
};

/**
 * Sets visibility timeout for a page zipper queue message.
 * Pass `visibilityTimeoutSeconds` (e.g. 0) to override the processor timeout default.
 */
const setPageZipperSQSMessageVisibilityTimeout = async (
    receiptHandle: string,
    visibilityTimeoutSeconds?: number,
): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    if (devEnvironment === 'local') {
        console.log(
            'Skipping page zipper SQS visibility timeout change - no queue configured locally',
        );
        return;
    }

    const queueUrl = process.env.PAGE_ZIPPER_QUEUE_URL;
    if (queueUrl == null || queueUrl.trim().length === 0) {
        throw new Error('PAGE_ZIPPER_QUEUE_URL environment variable is not set');
    }

    const timeoutSeconds =
        visibilityTimeoutSeconds !== undefined
            ? visibilityTimeoutSeconds
            : getVisibilityTimeoutSeconds();

    if (timeoutSeconds < 0 || timeoutSeconds > 43200) {
        throw new Error(
            `visibilityTimeoutSeconds must be between 0 and 43200, got: ${timeoutSeconds}`,
        );
    }

    await changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, timeoutSeconds);
};

export default setPageZipperSQSMessageVisibilityTimeout;
