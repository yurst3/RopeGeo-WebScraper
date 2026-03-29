import { mkdtemp, rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import MapData from '../types/mapData';
import type { SaveMapDataHookFn } from '../hook-functions/saveMapData';
import { downloadSourceFile } from '../http/downloadSourceFile';
import getSourceFile from '../s3/getSourceFile';
import { convertToGeoJson } from '../util/convertToGeoJson';
import { convertToTileDirectory } from '../util/convertToTileDirectory';
import { getBoundsFromGeoJson } from '../util/getBoundsFromGeoJson';
import ProgressLogger from 'ropegeo-common/helpers/progressLogger';

/**
 * Processes map data by downloading the source file (or fetching from S3 when downloadSource is false),
 * converting to GeoJSON and a tile directory, then calling the save hook to persist files.
 *
 * @param sourceFileUrl - URL of the source file (KML or GPX); used for record-keeping and when downloadSource is true
 * @param saveMapDataHookFn - Hook function to persist produced files and return MapData.
 * @param mapDataId - Optional UUID for the map data. If not provided, a new UUID will be generated.
 * @param logger - Progress logger for tracking processing progress
 * @param abortSignal - Optional AbortSignal; when aborted, the download is cancelled
 * @param downloadSource - If true (default), download from sourceFileUrl; if false, fetch existing source from S3 by mapDataId
 * @returns Promise that resolves to a MapData object with URLs/paths (including tiles)
 */
export const processMapData = async (
    sourceFileUrl: string,
    saveMapDataHookFn: SaveMapDataHookFn,
    mapDataId: string | null | undefined,
    logger: ProgressLogger,
    abortSignal?: AbortSignal,
    downloadSource: boolean = true,
): Promise<MapData> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'map-data-'));
    const finalMapDataId = mapDataId ?? randomUUID();

    try {
        const urlLower = sourceFileUrl.toLowerCase();
        const isKmlFromUrl = urlLower.endsWith('.kml');
        const isGpxFromUrl = urlLower.endsWith('.gpx');

        if (!isKmlFromUrl && !isGpxFromUrl) {
            const errorMessage = `Unsupported file type. Expected .kml or .gpx, got: ${sourceFileUrl}`;
            console.error(errorMessage);
            return new MapData(
                undefined,
                undefined,
                undefined,
                undefined,
                finalMapDataId,
                sourceFileUrl,
                errorMessage,
            );
        }

        let errorMessage: string | undefined;
        let sourceFilePath: string;
        let sourceFileContent: string;
        let isKml: boolean;

        if (downloadSource) {
            isKml = isKmlFromUrl;
            const result = await downloadSourceFile(
                sourceFileUrl,
                tempDir,
                finalMapDataId,
                isKml,
                abortSignal,
            );
            sourceFilePath = result.filePath;
            sourceFileContent = result.content;
        } else {
            const fileExtension = isKmlFromUrl ? 'kml' : 'gpx';
            const content = await getSourceFile(finalMapDataId, fileExtension);
            if (content === null) {
                const noSourceMessage = 'No existing source file';
                const mapData = await saveMapDataHookFn(
                    undefined,
                    undefined,
                    undefined,
                    finalMapDataId,
                    isKmlFromUrl,
                    sourceFileUrl,
                    noSourceMessage,
                    logger,
                );
                return mapData;
            }
            isKml = isKmlFromUrl;
            sourceFilePath = join(tempDir, `${finalMapDataId}.${fileExtension}`);
            sourceFileContent = content;
            await writeFile(sourceFilePath, sourceFileContent, 'utf-8');
        }

        let geoJsonFilePath: string | undefined;
        const { filePath: geoJsonPath, error: geoJsonError } = await convertToGeoJson(
            sourceFileContent,
            tempDir,
            finalMapDataId,
            isKml
        );
        geoJsonFilePath = geoJsonPath;
        errorMessage = geoJsonError;

        let tilesDirPath: string | undefined;
        if (geoJsonFilePath && !errorMessage) {
            const tilesOutputDir = join(tempDir, 'tiles');
            const result = await convertToTileDirectory(
                geoJsonFilePath,
                tilesOutputDir,
                finalMapDataId,
            );
            if ('error' in result) {
                errorMessage = result.error;
            } else {
                tilesDirPath = result.tilesDir;
            }
        }

        if (abortSignal?.aborted) {
            const reason =
                abortSignal.reason instanceof Error
                    ? abortSignal.reason
                    : new Error(String(abortSignal.reason));
            throw reason;
        }

        const mapData = await saveMapDataHookFn(
            sourceFilePath,
            geoJsonFilePath,
            tilesDirPath,
            finalMapDataId,
            isKml,
            sourceFileUrl,
            errorMessage,
            logger,
        );

        if (geoJsonFilePath && !errorMessage) {
            try {
                const geoJsonContent = await readFile(geoJsonFilePath, 'utf-8');
                const geoJson = JSON.parse(geoJsonContent) as GeoJSON.FeatureCollection;
                const bounds = getBoundsFromGeoJson(geoJson);
                mapData.setBounds(bounds);
            } catch {
                mapData.setBounds(null);
            }
        }

        return mapData;
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
};
