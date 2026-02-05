import changeSQSMessageVisibilityTimeout from '../../helpers/sqs/changeSQSMessageVisibilityTimeout';

/**
 * Reads visibility timeout in seconds from ROPEWIKI_PAGE_PROCESSOR_TIMEOUT_SECONDS (e.g. Lambda timeout).
 * @throws Error if ROPEWIKI_PAGE_PROCESSOR_TIMEOUT_SECONDS is not set or not in 0–43200
 */
const getVisibilityTimeoutSeconds = (): number => {
    const raw = process.env.ROPEWIKI_PAGE_PROCESSOR_TIMEOUT_SECONDS;
    if (raw === undefined || raw === '') {
        throw new Error('ROPEWIKI_PAGE_PROCESSOR_TIMEOUT_SECONDS environment variable is not set');
    }
    const value = parseInt(raw, 10);
    if (Number.isNaN(value) || value < 0 || value > 43200) {
        throw new Error(
            `ROPEWIKI_PAGE_PROCESSOR_TIMEOUT_SECONDS must be between 0 and 43200, got: ${raw}`,
        );
    }
    return value;
};

/**
 * Sets the visibility timeout for a message in the RopewikiPageProcessingQueue using
 * ROPEWIKI_PAGE_PROCESSOR_TIMEOUT_SECONDS (typically the Lambda timeout, e.g. 900 seconds).
 * This keeps the message hidden until the Lambda would have timed out, avoiding duplicate processing.
 * If DEV_ENVIRONMENT is "local", skips setting the visibility timeout and logs instead.
 *
 * @param receiptHandle - The receipt handle of the message
 * @throws Error if ROPEWIKI_PAGE_PROCESSING_QUEUE_URL is not set
 * @throws Error if ROPEWIKI_PAGE_PROCESSOR_TIMEOUT_SECONDS is not set or invalid
 */
const setProcessPageSQSMessageVisibilityTimeout = async (receiptHandle: string): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log('Skipping SQS message visibility timeout change - no queue configured locally');
        return;
    }

    const queueUrl = process.env.ROPEWIKI_PAGE_PROCESSING_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('ROPEWIKI_PAGE_PROCESSING_QUEUE_URL environment variable is not set');
    }

    const visibilityTimeoutSeconds = getVisibilityTimeoutSeconds();
    await changeSQSMessageVisibilityTimeout(queueUrl, receiptHandle, visibilityTimeoutSeconds);
};

export default setProcessPageSQSMessageVisibilityTimeout;
