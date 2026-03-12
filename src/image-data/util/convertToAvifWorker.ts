/**
 * Worker script for AVIF conversion. Loaded by convertToAvif when abortSignal is provided.
 * Receives workerData: { sourcePath?: string, sourceBuffer?: Buffer }, runs the shared pipeline,
 * posts { preview, banner, full, lossless, metadata } or { error: string } back to the parent.
 */
import { parentPort, workerData } from 'worker_threads';
import { runAvifPipeline } from './runAvifPipeline';

type WorkerInput = { sourcePath?: string; sourceBuffer?: Buffer };

async function run(): Promise<void> {
    const input = workerData as WorkerInput;
    const source = input.sourcePath ?? input.sourceBuffer;
    if (source == null) {
        parentPort!.postMessage({ error: 'convertToAvifWorker: missing sourcePath and sourceBuffer' });
        return;
    }

    try {
        const outputs = await runAvifPipeline(source);
        parentPort!.postMessage({
            preview: outputs.preview,
            banner: outputs.banner,
            full: outputs.full,
            lossless: outputs.lossless,
            metadata: outputs.metadata.toJSON(),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        parentPort!.postMessage({ error: message });
    }
}

run();
