/**
 * Daily job: read all GeoJSON files from MapData (where errorMessage and deletedAt are null),
 * process each into trail features (filter Points, expand GeometryCollections) and write one GeoJSON
 * per id to a directory, run Tippecanoe to generate trails/{z}/{x}/{y}.pbf tiles, upload them to the
 * map data S3 bucket, and optionally invalidate the CloudFront cache for that path.
 *
 * Intended to run on ECS Fargate on a schedule (noon daily).
 * Requires: DB_* env (or RDS Proxy), MAP_DATA_BUCKET_NAME, DEV_ENVIRONMENT.
 * Optional: CLOUDFRONT_DISTRIBUTION_ARN to run a CloudFront invalidation after upload.
 */

import getDatabaseConnection from '../../helpers/getDatabaseConnection';
import { getMapDataIds } from './database/getMapDataIds';
import { getMapDataBucketName } from './s3/getMapDataBucketName';
import { processGeojsons } from './processors/processGeojsons';
import { makeTiles } from './util/makeTiles';
import { invalidateCloudFrontCache } from './cloudfront/invalidateCloudFrontCache';
import { getCloudfrontDistributionArn } from './cloudfront/getCloudfrontDistributionArn';
import { uploadTilesToS3 } from './s3/uploadTilesToS3';

const GEOJSON_DIR = 'geojson';
const TILES_DIR = 'trails';
const S3_TILES_PREFIX = 'tiles/trails';

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
            console.error('No MapData rows with valid GeoJSON; skipping trail tile generation.');
            return;
        }

        await processGeojsons(ids, GEOJSON_DIR, bucket);

        await makeTiles(GEOJSON_DIR, TILES_DIR);
        await uploadTilesToS3(TILES_DIR, S3_TILES_PREFIX, bucket);

        await invalidateCloudFrontCache(distributionArn, S3_TILES_PREFIX);
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
