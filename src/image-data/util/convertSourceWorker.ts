/**
 * Worker for image encoding. workerData: { sourcePath?, sourceBuffer?, versions: ImageVersion[] }.
 */
import { parentPort, workerData } from 'worker_threads';
import { ImageVersion } from 'ropegeo-common/classes';
import { Metadata } from '../types/metadata';
import { runSourceConversionPipeline } from './runSourceConversionPipeline';

type WorkerInput = {
    sourcePath?: string;
    sourceBuffer?: Buffer;
    versions?: ImageVersion[];
    existingMetadataJSON?: unknown;
};

async function run(): Promise<void> {
    const input = workerData as WorkerInput;
    const source = input.sourcePath ?? input.sourceBuffer;
    const versions = input.versions;
    if (source == null || versions == null || versions.length === 0) {
        parentPort!.postMessage({
            error: 'convertSourceWorker: missing sourcePath/sourceBuffer or versions',
        });
        return;
    }

    const existingMetadata =
        input.existingMetadataJSON != null
            ? Metadata.fromJSON(input.existingMetadataJSON)
            : undefined;

    try {
        const { buffers, metadata } = await runSourceConversionPipeline(
            source,
            versions,
            existingMetadata,
        );
        const msg: Record<string, unknown> = { metadata: metadata.toJSON() };
        for (const v of versions) {
            msg[v] = buffers[v];
        }
        parentPort!.postMessage(msg);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        parentPort!.postMessage({ error: message });
    }
}

run();
