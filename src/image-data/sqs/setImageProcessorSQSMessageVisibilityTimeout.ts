import changeSQSMessageVisibilityTimeout from 'ropegeo-common/helpers/sqs/changeSQSMessageVisibilityTimeout';

/**
 * Reads visibility timeout in seconds from IMAGE_PROCESSOR_TIMEOUT_SECONDS (e.g. Lambda timeout).
 * @throws Error if IMAGE_PROCESSOR_TIMEOUT_SECONDS is not set or not in 0–43200
 */
const getVisibilityTimeoutSeconds = (): number => {
    const raw = process.env.IMAGE_PROCESSOR_TIMEOUT_SECONDS;
    if (raw === undefined || raw === '') {
        throw new Error('IMAGE_PROCESSOR_TIMEOUT_SECONDS environment variable is not set');
    }
    const value = parseInt(raw, 10);
    if (Number.isNaN(value) || value < 0 || value > 43200) {
        throw new Error(
            `IMAGE_PROCESSOR_TIMEOUT_SECONDS must be between 0 and 43200, got: ${raw}`,
        );
    }
    return value;
};

/**
 * Sets the visibility timeout for a message in the ImageProcessorQueue.
 * If DEV_ENVIRONMENT is "local", skips and logs instead.
 *
 * @param receiptHandle - The receipt handle of the message
 */
const setImageProcessorSQSMessageVisibilityTimeout = async (
    receiptHandle: string,
): Promise<void> => {
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (devEnvironment === 'local') {
        console.log('Skipping SQS message visibility timeout change - no queue configured locally');
        return;
    }

    const queueUrl = process.env.IMAGE_PROCESSOR_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('IMAGE_PROCESSOR_QUEUE_URL environment variable is not set');
    }

    const visibilityTimeoutSeconds = getVisibilityTimeoutSeconds();
    await changeSQSMessageVisibilityTimeout(
        queueUrl,
        receiptHandle,
        visibilityTimeoutSeconds,
    );
};

export default setImageProcessorSQSMessageVisibilityTimeout;
