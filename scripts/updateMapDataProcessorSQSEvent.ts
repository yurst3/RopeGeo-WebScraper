import * as db from 'zapatos/db';
import type * as s from 'zapatos/schema';
import getDatabaseConnection from '../src/helpers/getDatabaseConnection';
import { PageDataSource } from 'ropegeo-common/classes';
import { RopewikiRoute } from '../src/types/pageRoute';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const queries: Record<PageDataSource, string> = {
    [PageDataSource.Ropewiki]: `SELECT rr.* FROM "RopewikiRoute" rr
        JOIN "RopewikiPage" rp ON rr."ropewikiPage" = rp.id
        WHERE rr."deletedAt" IS NULL AND rp."deletedAt" IS NULL AND rp."kmlUrl" IS NOT NULL
        ORDER BY RANDOM()
        LIMIT $1`,
};

/**
 * Script to update the MapDataProcessorSQSEvent.json file with random MapDataEvents from the database.
 * Usage: ts-node updateMapDataProcessorSQSEvent.ts <pageRouteType> [numberOfRecords]
 * Currently only 'ropewiki' is supported.
 * If numberOfRecords is not provided, defaults to 1.
 * numberOfRecords must be greater than 0.
 */
async function main() {
    const pageRouteTypeArg = process.argv[2];
    const numberOfRecordsArg = process.argv[3];

    if (!pageRouteTypeArg) {
        console.error('Usage: ts-node updateMapDataProcessorSQSEvent.ts <pageRouteType> [numberOfRecords]');
        console.error('Currently only "ropewiki" is supported.');
        process.exit(1);
    }

    if (!Object.values(PageDataSource).includes(pageRouteTypeArg as PageDataSource)) {
        console.error(`Invalid pageRouteType: ${pageRouteTypeArg}. pageRouteType must be one of ${Object.values(PageDataSource).join(', ')}`);
        process.exit(1);
    }

    const numberOfRecords = numberOfRecordsArg ? parseInt(numberOfRecordsArg, 10) : 1;

    if (isNaN(numberOfRecords) || numberOfRecords <= 0) {
        throw new Error(`Invalid number of records: ${numberOfRecordsArg}. Must be a number greater than 0.`);
    }

    const pool = await getDatabaseConnection();

    try {
        // Select random page routes from the database
        const pageRouteType = pageRouteTypeArg as PageDataSource;
        // Note: numberOfRecords is validated above, so it's safe to use in SQL
        const result = await pool.query<s.RopewikiRoute.JSONSelectable>(
            queries[pageRouteType],
            [numberOfRecords]
        );
        const rows = result.rows as s.RopewikiRoute.JSONSelectable[];

        if (rows.length === 0) {
            throw new Error('No page routes found in the database');
        }

        if (rows.length < numberOfRecords) {
            console.warn(`Warning: Only ${rows.length} page routes found in the database, expected ${numberOfRecords}`);
        }

        // Convert the database rows to RopewikiRoute objects
        const pageRoutes = rows.map((row) => RopewikiRoute.fromDbRow(row));

        // Convert each page route to a MapDataEvent
        const mapDataEvents = pageRoutes.map((route) => route.toMapDataEvent());

        // Log the selected routes
        pageRoutes.forEach((route, index) => {
            console.log(`Selected route ${index + 1} - Route: ${route.route}, Page: ${route.page}, MapData: ${route.mapData ?? 'none'}`);
        });

        // Read the existing event file
        const eventFilePath = join(__dirname, '../events/MapDataProcessorSQSEvent.json');
        let eventFile: any;
        try {
            const fileContent = readFileSync(eventFilePath, 'utf-8');
            eventFile = JSON.parse(fileContent);
        } catch (error) {
            // If file doesn't exist or is empty, create a new structure
            eventFile = { Records: [] };
        }

        // Create records with unique messageIds and receiptHandles
        const records = mapDataEvents.map((mapDataEvent) => {
            // Use the first record as a template for structure, or create a default template
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
                eventSourceARN: 'arn:aws:sqs:us-west-2:123456789012:MapDataProcessingQueue',
                awsRegion: 'us-west-2',
            };

            return {
                ...templateRecord,
                messageId: randomUUID(),
                receiptHandle: `AQEB${randomUUID().replace(/-/g, '')}...`,
                body: JSON.stringify({
                    source: mapDataEvent.source,
                    routeId: mapDataEvent.routeId,
                    pageId: mapDataEvent.pageId,
                    mapDataId: mapDataEvent.mapDataId,
                }),
            };
        });

        // Update the event file with all records
        eventFile.Records = records;

        // Write the updated event file
        writeFileSync(eventFilePath, JSON.stringify(eventFile, null, 2), 'utf-8');

        console.log(`Successfully updated MapDataProcessorSQSEvent.json with ${records.length} records`);
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
