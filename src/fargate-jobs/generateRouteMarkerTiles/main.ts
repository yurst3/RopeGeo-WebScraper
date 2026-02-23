/**
 * Daily job: export all Route coordinates as point features to a GeoJSON file,
 * run Tippecanoe to generate a .pmtiles tileset, upload it to the map data S3 bucket,
 * and optionally invalidate the CloudFront cache for that path.
 *
 * Intended to run on ECS Fargate on a schedule (e.g. once per day).
 * Requires: DB_* env (or RDS Proxy), MAP_DATA_BUCKET_NAME, DEV_ENVIRONMENT.
 * Optional: CLOUDFRONT_DISTRIBUTION_ARN to run a CloudFront invalidation after upload.
 */

import { readFileSync } from 'fs';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import { getRoutes } from './database/getRoutes';
import { makeGeojson } from './util/makeGeojson';
import { makePmtiles } from './util/makePmtiles';
import { createCloudFrontInvalidation } from './util/createCloudFrontInvalidation';
import putS3Object from '../../helpers/s3/putS3Object';

const GEOJSON_PATH = '/tmp/routes.geojson';
const PMTILES_PATH = '/tmp/routes.pmtiles';
const S3_KEY = 'pmtiles/routes.pmtiles';
const PMTILES_CONTENT_TYPE = 'application/vnd.pmtiles';

export async function main(): Promise<void> {
    const bucket = process.env.MAP_DATA_BUCKET_NAME;
    if (!bucket) {
        throw new Error('MAP_DATA_BUCKET_NAME is required');
    }

    const pool = await getDatabaseConnection();
    let client;
    try {
        client = await pool.connect();
        const rows = await getRoutes(client);
        makeGeojson(rows, GEOJSON_PATH);
    } finally {
        client?.release();
        await pool.end();
    }

    await makePmtiles(GEOJSON_PATH, PMTILES_PATH);
    const body = readFileSync(PMTILES_PATH);
    await putS3Object(bucket, S3_KEY, body, PMTILES_CONTENT_TYPE);
    console.log(`Uploaded ${S3_KEY} to s3://${bucket}/${S3_KEY}`);

    const distributionArn = process.env.CLOUDFRONT_DISTRIBUTION_ARN;
    if (distributionArn?.trim()) {
        await createCloudFrontInvalidation(distributionArn.trim());
    }
}

if (require.main === module) {
    main().then(
        () => process.exit(0),
        (err) => {
            console.error(err);
            process.exit(1);
        }
    );
}
