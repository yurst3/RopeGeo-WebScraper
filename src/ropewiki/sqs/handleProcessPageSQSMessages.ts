import { PoolClient } from 'pg';
import type { SqsRecord } from '@aws-lambda-powertools/parser/types';
import { processPage } from '../processors/processPage';
import RopewikiPage from '../types/page';
import ProgressLogger from '../../helpers/progressLogger';
import deleteProcessPageSQSMessage from './deleteProcessPageSQSMessage';
import setProcessPageSQSMessageRetryTime from './setProcessPageSQSMessageRetryTime';

/**
 * Handles processing of Ropewiki pages from SQS records.
 * Processes each record, handles errors gracefully, and manages the database transaction.
 * 
 * @param records - Array of SQS records containing RopewikiPage data in each record's body
 * @param client - Database client (should be a PoolClient in a transaction)
 * @returns Object containing the number of successes, errors, and remaining pages
 */
const handleProcessPageSQSMessages = async (
    records: SqsRecord[],
    client: PoolClient,
): Promise<{ successes: number; errors: number; remaining: number }> => {
    const totalRecords = records.length;

    // Initialize progress logger
    const logger = new ProgressLogger('Processing Ropewiki pages', totalRecords);
    logger.setChunk(0, totalRecords);

    // Track which records have been successfully processed (message deleted)
    const processedIndices = new Set<number>();

    try {
        // Begin transaction
        await client.query('BEGIN');

        // Process each record
        for (let i = 0; i < records.length; i++) {
            const record: SqsRecord = records[i]!;
            let page: RopewikiPage | undefined;

            try {
                // Parse the page from the SQS record
                page = RopewikiPage.fromSQSEventRecord(record);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.logError(`Error parsing Ropewiki Page from SQSEventRecord: ${errorMessage}`);
                
                // Delete the message from the queue so we don't keep reprocessing the bad message
                await deleteProcessPageSQSMessage(record.receiptHandle);
                processedIndices.add(i);
                continue;
            }
            
            // Process the page with a savepoint
            // HTTP errors will propagate to the outer try-catch
            // Parser/database errors are caught and logged inside processPage
            const savepointName = `sp_page_${i}`;
            await processPage(client, page, logger, savepointName);

            // Delete the message from the queue so we don't keep reprocessing it
            await deleteProcessPageSQSMessage(record.receiptHandle);
            processedIndices.add(i);
        }

        // Commit transaction
        await client.query('COMMIT');

        return logger.getResults();
    } catch (error) {
        // Rollback entire transaction on error
        await client.query('ROLLBACK').catch(() => {
            // Ignore rollback errors if transaction was already rolled back
        });
        
        // Set retry time for all unprocessed records (HTTP error case)
        for (let i = 0; i < records.length; i++) {
            if (!processedIndices.has(i)) {
                try {
                    await setProcessPageSQSMessageRetryTime(records[i]!.receiptHandle, 43200);
                } catch (retryError) {
                    // Log but don't throw - we're already in error handling
                    console.error(`Failed to set retry time for record ${i}:`, retryError);
                }
            }
        }
        
        // Log the error but don't throw - return results instead
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Unexpected error in handleProcessPageSQSMessages:', errorMessage);

        return logger.getResults();
    }
};

export default handleProcessPageSQSMessages;
