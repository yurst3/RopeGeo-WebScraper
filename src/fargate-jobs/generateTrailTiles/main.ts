/**
 * Daily job: read all GeoJSON files from MapData (where errorMessage and deletedAt are null),
 * combine features into one GeoJSON with id (mapDataId) on each feature,
 * run Tippecanoe to generate trails.pmtiles, upload to the map data S3 bucket,
 * and optionally invalidate the CloudFront cache for that path.
 *
 * Intended to run on ECS Fargate on a schedule (noon daily).
 * Requires: DB_* env (or RDS Proxy), MAP_DATA_BUCKET_NAME, DEV_ENVIRONMENT.
 * Optional: CLOUDFRONT_DISTRIBUTION_ARN to run a CloudFront invalidation after upload.
 */

import { readFileSync } from 'fs';
import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import getS3Object from '../../helpers/s3/getS3Object';
import putS3Object from '../../helpers/s3/putS3Object';
import { getMapDataIds } from './database/getMapDataIds';
import { combineTrailGeojson } from './util/combineTrailGeojson';
import { makePmtiles } from './util/makePmtiles';
import { createCloudFrontInvalidation } from './util/createCloudFrontInvalidation';

const GEOJSON_PATH = '/tmp/trails.geojson';
const PMTILES_PATH = '/tmp/trails.pmtiles';
const S3_KEY = 'pmtiles/trails.pmtiles';
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
        const ids = await getMapDataIds(client);
        if (ids.length === 0) {
            console.log('No MapData rows with valid GeoJSON; writing empty FeatureCollection.');
        }

        const inputs = await Promise.all(
            ids.map(async (id) => {
                const key = `geojson/${id}.geojson`;
                const { body } = await getS3Object(bucket, key);
                return { id, geojsonBody: body };
            })
        );

        combineTrailGeojson(inputs, GEOJSON_PATH);
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
