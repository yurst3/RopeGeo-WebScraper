import { mkdirSync } from 'fs';
import ProgressLogger from '../../../helpers/progressLogger';
import { getFeaturesForGeojson } from '../util/getFeaturesForGeojson';
import { writeGeojsonFile } from '../util/writeGeojsonFile';

/**
 * Processes one MapData id: fetches and expands its GeoJSON, writes a file when there are
 * features, and logs progress or errors via the provided logger. Swallows errors (logs only).
 */
async function processGeojson(
    id: string,
    bucket: string,
    outputDir: string,
    logger: ProgressLogger
): Promise<void> {
    try {
        const features = await getFeaturesForGeojson(id, bucket);
        if (features.length > 0) {
            writeGeojsonFile(id, features, outputDir);
        }
        logger.logProgress(`Processed ${id}`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.logError(message);
    }
}

/**
 * Fetches each MapData GeoJSON from S3 (via getS3Geojson), expands features
 * (filters out Points, unpacks GeometryCollections), then writes one GeoJSON file per id
 * into /tmp/{geojsonDir} (e.g. {id}.geojson). Skips writing a file when an id yields no features.
 * Logs progress via ProgressLogger.
 */
export async function processGeojsons(ids: string[], geojsonDir: string, bucket: string): Promise<void> {
    const localGeojsonDir = '/tmp/' + geojsonDir;
    const logger = new ProgressLogger('Processing trail GeoJSON', ids.length);
    mkdirSync(localGeojsonDir, { recursive: true });

    await Promise.all(ids.map((id: string) => processGeojson(id, bucket, localGeojsonDir, logger)));

    const { successes, errors } = logger.getResults();
    console.log(`Processing complete: ${successes} success(es), ${errors} error(s).`);
}
