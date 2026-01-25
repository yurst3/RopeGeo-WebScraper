import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import getDatabaseConnection from '../src/helpers/getDatabaseConnection';
import RopewikiPage from '../src/ropewiki/types/page';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

/**
 * Script to update the RopewikiPageProcessorSQSEvent.json file with random pages from the database.
 * Usage: ts-node updateRopewikiPageProcessorSQSEvent.ts [numberOfRecords]
 * If numberOfRecords is not provided, defaults to 1.
 * numberOfRecords must be greater than 0.
 */
async function main() {
    // Parse command line argument for number of records
    const numberOfRecordsArg = process.argv[2];
    const numberOfRecords = numberOfRecordsArg ? parseInt(numberOfRecordsArg, 10) : 1;

    if (isNaN(numberOfRecords) || numberOfRecords <= 0) {
        throw new Error(`Invalid number of records: ${numberOfRecordsArg}. Must be a number greater than 0.`);
    }

    const pool = await getDatabaseConnection();

    try {
        // Select random pages from the database
        // Note: numberOfRecords is validated above, so it's safe to use in SQL
        const result = await pool.query(
            `SELECT * FROM "RopewikiPage"
             WHERE "deletedAt" IS NULL
             ORDER BY RANDOM()
             LIMIT $1`,
            [numberOfRecords]
        );
        const rows = result.rows as s.RopewikiPage.JSONSelectable[];

        if (rows.length === 0) {
            throw new Error('No pages found in the database');
        }

        if (rows.length < numberOfRecords) {
            console.warn(`Warning: Only ${rows.length} pages found in the database, expected ${numberOfRecords}`);
        }

        // Parse the database rows into RopewikiPage objects
        const pages = rows.map((row) => RopewikiPage.fromDbRow(row));

        // Log the selected pages
        pages.forEach((page, index) => {
            console.log(`Selected page ${index + 1} - ID: ${page.id}, Name: ${page.name}`);
        });

        // Read the existing event file
        const eventFilePath = join(__dirname, '../events/RopewikiPageProcessorSQSEvent.json');
        const eventFile = JSON.parse(readFileSync(eventFilePath, 'utf-8'));

        // Create records with unique messageIds and receiptHandles
        const records = pages.map((page, index) => {
            // Use the first record as a template for structure
            const templateRecord = eventFile.Records?.[0] || {
                attributes: {
                    ApproximateReceiveCount: '1',
                    SentTimestamp: '1523232000000',
                    SenderId: 'AIDAIENQZJOLO23YVJ4VO',
                    ApproximateFirstReceiveTimestamp: '1523232000001',
                },
                messageAttributes: {},
                md5OfBody: 'test-md5',
                eventSource: 'aws:sqs',
                eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:RopewikiPageProcessorQueue',
                awsRegion: 'us-west-2',
            };

            return {
                ...templateRecord,
                messageId: randomUUID(),
                receiptHandle: `AQEB${randomUUID().replace(/-/g, '')}...`,
                body: JSON.stringify(page),
            };
        });

        // Update the event file with all records
        eventFile.Records = records;

        // Write the updated event file
        writeFileSync(eventFilePath, JSON.stringify(eventFile, null, 2), 'utf-8');

        console.log(`Successfully updated RopewikiPageProcessorSQSEvent.json with ${records.length} records`);
    } finally {
        await pool.end();
    }
}

// Run the script
if (require.main === module) {
    main().catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
}
