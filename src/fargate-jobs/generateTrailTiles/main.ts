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
import { getMapDataIds } from './database/getMapDataIds';
import { getMapDataBucketName } from './s3/getMapDataBucketName';
import { combineTrailGeojson } from './util/combineTrailGeojson';
import { makePmtiles } from './util/makePmtiles';
import { createCloudFrontInvalidation } from './cloudfront/createCloudFrontInvalidation';
import { getCloudfrontDistributionArn } from './cloudfront/getCloudfrontDistributionArn';
import { putS3Pmtiles } from './s3/putS3Pmtiles';

const GEOJSON_PATH = '/tmp/trails.geojson';
const PMTILES_PATH = '/tmp/trails.pmtiles';

export async function main(): Promise<void> {
    let pool;
    let client;
    try {
        const bucket = getMapDataBucketName();
        const distributionArn = getCloudfrontDistributionArn();

        pool = await getDatabaseConnection();
        client = await pool.connect();
        const ids = await getMapDataIds(client);
        if (ids.length === 0) {
            console.log('No MapData rows with valid GeoJSON; writing empty FeatureCollection.');
        }

        await combineTrailGeojson(ids, GEOJSON_PATH, bucket);

        await makePmtiles(GEOJSON_PATH, PMTILES_PATH);
        const body = readFileSync(PMTILES_PATH);
        await putS3Pmtiles(body, bucket);

        if (distributionArn) {
            await createCloudFrontInvalidation(distributionArn);
        }
    } catch (err) {
        console.error(err);
        throw err;
    } finally {
        client?.release();
        await pool?.end();
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
