import { Worker } from 'worker_threads';
import { existsSync } from 'fs';
import { join } from 'path';
import { ImageVersion } from 'ropegeo-common/models';
import { runSourceConversionPipeline } from './runSourceConversionPipeline';
import { Metadata } from '../types/metadata';

/**
 * Resolves the path to the worker script. In Lambda artifact layout: task root contains src/image-data/util/convertSourceWorker.js.
 */
function getWorkerPath(): string {
    if (typeof __dirname !== 'undefined') {
        return join(__dirname, '..', 'util', 'convertSourceWorker.js');
    }
    return join(process.cwd(), 'src', 'image-data', 'util', 'convertSourceWorker.js');
}

export type SourceConversionResult = {
    buffers: Partial<Record<ImageVersion, Buffer>>;
    metadata: Metadata;
};

type WorkerData = {
    sourcePath?: string;
    sourceBuffer?: Buffer;
    versions: ImageVersion[];
    /** Result of {@link Metadata.toJSON} when re-processing with stored metadata */
    existingMetadataJSON?: ReturnType<Metadata['toJSON']>;
};

/**
 * worker_threads postMessage uses the structured clone algorithm; Buffers from the worker
 * often arrive on the parent as Uint8Array, so Buffer.isBuffer is false.
 */
function bufferFromWorkerMessage(value: unknown): Buffer | null {
    if (Buffer.isBuffer(value)) {
        return value;
    }
    if (value instanceof Uint8Array) {
        return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    }
    return null;
}

/**
 * Converts an image to the requested encoded variants using Sharp.
 * When abortSignal is provided, conversion runs in a worker thread.
 * {@link existingMetadata} is passed through to the pipeline (and worker) so output metadata extends it in one pass.
 */
export async function convertSource(
    source: string | Buffer,
    versions: readonly ImageVersion[],
    abortSignal?: AbortSignal,
    existingMetadata?: Metadata,
): Promise<SourceConversionResult> {
    if (abortSignal == null) {
        return runSourceConversionPipeline(source, versions, existingMetadata);
    }

    const workerPath = getWorkerPath();
    if (!existsSync(workerPath)) {
        throw new Error(
            `convertSourceWorker not found at ${workerPath}; build the ImageProcessor artifact to include the worker.`,
        );
    }

    const workerData: WorkerData =
        typeof source === 'string'
            ? { sourcePath: source, versions: [...versions] }
            : { sourceBuffer: source, versions: [...versions] };
    if (existingMetadata != null) {
        workerData.existingMetadataJSON = existingMetadata.toJSON();
    }

    return new Promise<SourceConversionResult>((resolve, reject) => {
        let settled = false;
        const settle = (fn: () => void) => {
            if (!settled) {
                settled = true;
                fn();
            }
        };

        const worker = new Worker(workerPath, {
            workerData,
            resourceLimits: undefined,
        });

        const onAbort = () => {
            worker.terminate().catch(() => {});
            const reason =
                abortSignal.reason instanceof Error
                    ? abortSignal.reason
                    : new Error(String(abortSignal.reason));
            settle(() => reject(reason));
        };
        abortSignal.addEventListener('abort', onAbort);
        if (abortSignal.aborted) {
            onAbort();
            return;
        }

        worker.on('message', (msg: Record<string, unknown> & { error?: string; metadata?: unknown }) => {
            abortSignal.removeEventListener('abort', onAbort);
            if (msg.error != null) {
                settle(() => reject(new Error(msg.error)));
                return;
            }
            const buffers: Partial<Record<ImageVersion, Buffer>> = {};
            for (const v of versions) {
                const raw = msg[v];
                const b = bufferFromWorkerMessage(raw);
                if (b == null) {
                    const kind = raw === undefined ? 'undefined' : typeof raw;
                    settle(() =>
                        reject(
                            new Error(
                                `convertSourceWorker: invalid message (expected Buffer or Uint8Array for version ${String(v)}, got ${kind})`,
                            ),
                        ),
                    );
                    return;
                }
                buffers[v] = b;
            }
            if (msg.metadata == null) {
                settle(() => reject(new Error('convertSourceWorker: invalid message (missing metadata)')));
                return;
            }
            settle(() =>
                resolve({
                    buffers,
                    metadata: Metadata.fromJSON(msg.metadata),
                }),
            );
        });

        worker.on('error', (err) => {
            abortSignal.removeEventListener('abort', onAbort);
            worker.terminate().catch(() => {});
            settle(() => reject(err));
        });

        worker.on('exit', (code) => {
            abortSignal.removeEventListener('abort', onAbort);
            if (!settled && code !== 0) {
                settle(() => reject(new Error(`convertSourceWorker exited with code ${code}`)));
            }
        });
    });
}
