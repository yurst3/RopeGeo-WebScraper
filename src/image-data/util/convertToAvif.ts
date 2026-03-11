import { Worker } from 'worker_threads';
import { existsSync } from 'fs';
import { join } from 'path';
import { runAvifPipeline, type AvifOutputs } from './runAvifPipeline';

export type { AvifOutputs };

/**
 * Resolves the path to the worker script. In Lambda artifact layout: task root contains src/image-data/util/convertToAvifWorker.js.
 * When bundled, __dirname is the handler dir (lambda-handlers), so ../util/convertToAvifWorker.js. Otherwise use process.cwd().
 */
function getWorkerPath(): string {
    if (typeof __dirname !== 'undefined') {
        return join(__dirname, '..', 'util', 'convertToAvifWorker.js');
    }
    return join(process.cwd(), 'src', 'image-data', 'util', 'convertToAvifWorker.js');
}

/**
 * Converts an image (file path or buffer) to three AVIF variants using Sharp.
 * - Preview: resized to 256x256 (fit inside), quality 50
 * - Banner: same dimensions as source, quality 75
 * - Full: same dimensions, lossless
 *
 * When abortSignal is provided, conversion runs in a worker thread (worker must exist at build path);
 * on abort, the worker is terminated to stop Sharp. When abortSignal is not provided, runs in the main thread.
 *
 * @param source - Path to the source image file, or buffer (e.g. PNG from single-page PDF)
 * @param abortSignal - Optional AbortSignal; when aborted, the worker is terminated (if used)
 * @returns Buffers for preview.avif, banner.avif, full.avif
 */
export async function convertToAvif(
    source: string | Buffer,
    abortSignal?: AbortSignal,
): Promise<AvifOutputs> {
    if (abortSignal == null) {
        return runAvifPipeline(source);
    }

    const workerPath = getWorkerPath();
    if (!existsSync(workerPath)) {
        throw new Error(`convertToAvifWorker not found at ${workerPath}; build the ImageProcessor artifact to include the worker.`);
    }

    const workerData: { sourcePath?: string; sourceBuffer?: Buffer } =
        typeof source === 'string' ? { sourcePath: source } : { sourceBuffer: source };

    return new Promise<AvifOutputs>((resolve, reject) => {
        let settled = false;
        const settle = (fn: () => void) => {
            if (!settled) {
                settled = true;
                fn();
            }
        };

        const worker = new Worker(workerPath, {
            workerData,
            // In Lambda, the worker runs in the same deployment; resource limits apply to the process
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

        worker.on('message', (msg: { preview?: Buffer; banner?: Buffer; full?: Buffer; error?: string }) => {
            abortSignal.removeEventListener('abort', onAbort);
            if (msg.error != null) {
                settle(() => reject(new Error(msg.error)));
            } else if (msg.preview != null && msg.banner != null && msg.full != null) {
                const { preview, banner, full } = msg;
                settle(() => resolve({ preview, banner, full }));
            } else {
                settle(() => reject(new Error('convertToAvifWorker: invalid message')));
            }
        });

        worker.on('error', (err) => {
            abortSignal.removeEventListener('abort', onAbort);
            worker.terminate().catch(() => {});
            settle(() => reject(err));
        });

        worker.on('exit', (code) => {
            abortSignal.removeEventListener('abort', onAbort);
            if (!settled && code !== 0) {
                settle(() => reject(new Error(`convertToAvifWorker exited with code ${code}`)));
            }
        });
    });
}
