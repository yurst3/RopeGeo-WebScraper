/**
 * Daily job: export all Route coordinates as point features to a GeoJSON file,
 * run Tippecanoe to generate routeMarkers/{z}/{x}/{y}.pbf tiles, upload them to the map data
 * S3 bucket, and optionally invalidate the CloudFront cache for that path.
 *
 * Intended to run on ECS Fargate on a schedule (e.g. once per day).
 * Requires: DB_* env (or RDS Proxy), MAP_DATA_BUCKET_NAME, DEV_ENVIRONMENT.
 * Optional: CLOUDFRONT_DISTRIBUTION_ARN to run a CloudFront invalidation after upload.
 */

import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import { getRoutes } from './database/getRoutes';
import { makeGeojson } from './util/makeGeojson';
import { makeTiles } from './util/makeTiles';
import { invalidateCloudFrontCache } from './cloudfront/invalidateCloudFrontCache';
import { getCloudfrontDistributionArn } from './cloudfront/getCloudfrontDistributionArn';
import { getMapDataBucketName } from './s3/getMapDataBucketName';
import { uploadTilesToS3 } from './s3/uploadTilesToS3';

const GEOJSON_FILE = 'routes.geojson';
const TILES_DIR = 'routeMarkers';

export async function main(): Promise<void> {
    let pool;
    let client;
    try {
        const bucket = getMapDataBucketName();
        const distributionArn = getCloudfrontDistributionArn();

        pool = await getDatabaseConnection();
        client = await pool.connect();
        const rows = await getRoutes(client);
        if (rows.length === 0) {
            console.error('No routes from database; skipping route marker tile generation.');
            return;
        }
        makeGeojson(rows, '/tmp/' + GEOJSON_FILE);

        await makeTiles(GEOJSON_FILE, TILES_DIR);
        await uploadTilesToS3(TILES_DIR, bucket);

        await invalidateCloudFrontCache(distributionArn, TILES_DIR);
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
