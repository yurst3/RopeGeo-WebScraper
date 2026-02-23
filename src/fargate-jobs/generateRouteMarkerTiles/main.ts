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
import { createCloudFrontInvalidation } from './cloudfront/createCloudFrontInvalidation';
import { getCloudfrontDistributionArn } from './cloudfront/getCloudfrontDistributionArn';
import { getMapDataBucketName } from './s3/getMapDataBucketName';
import { putS3Pmtiles } from './s3/putS3Pmtiles';

const GEOJSON_PATH = '/tmp/routes.geojson';
const PMTILES_PATH = '/tmp/routes.pmtiles';

export async function main(): Promise<void> {
    let pool;
    let client;
    try {
        const bucket = getMapDataBucketName();
        const distributionArn = getCloudfrontDistributionArn();

        pool = await getDatabaseConnection();
        client = await pool.connect();
        const rows = await getRoutes(client);
        makeGeojson(rows, GEOJSON_PATH);

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
