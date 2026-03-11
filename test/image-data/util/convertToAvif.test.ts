import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { convertToAvif } from '../../../src/image-data/util/convertToAvif';

let messageHandler: ((msg: { preview?: Buffer; banner?: Buffer; full?: Buffer; error?: string }) => void) | null = null;
let errorHandler: ((err: Error) => void) | null = null;
let exitHandler: ((code: number | null) => void) | null = null;
const mockTerminate = jest.fn().mockResolvedValue(undefined);

const mockWorkerInstance = {
    on(event: string, handler: (...args: unknown[]) => void) {
        if (event === 'message') messageHandler = handler as typeof messageHandler;
        if (event === 'error') errorHandler = handler as typeof errorHandler;
        if (event === 'exit') exitHandler = handler as typeof exitHandler;
        return mockWorkerInstance;
    },
    terminate: mockTerminate,
};

jest.mock('worker_threads', () => ({
    Worker: jest.fn(() => mockWorkerInstance),
}));

jest.mock('fs', () => ({
    existsSync: jest.fn(),
}));

jest.mock('../../../src/image-data/util/runAvifPipeline', () => ({
    runAvifPipeline: jest.fn(),
}));

const mockExistsSync = require('fs').existsSync as jest.MockedFunction<typeof import('fs').existsSync>;
const mockRunAvifPipeline = require('../../../src/image-data/util/runAvifPipeline')
    .runAvifPipeline as jest.MockedFunction<typeof import('../../../src/image-data/util/runAvifPipeline').runAvifPipeline>;

describe('convertToAvif', () => {
    const previewBuffer = Buffer.from([1]);
    const bannerBuffer = Buffer.from([2]);
    const fullBuffer = Buffer.from([3]);

    beforeEach(() => {
        jest.clearAllMocks();
        messageHandler = null;
        errorHandler = null;
        exitHandler = null;
        mockExistsSync.mockReturnValue(true);
        mockRunAvifPipeline.mockResolvedValue({
            preview: previewBuffer,
            banner: bannerBuffer,
            full: fullBuffer,
        });
    });

    describe('without abortSignal', () => {
        it('calls runAvifPipeline and returns result when source is path', async () => {
            const source = '/tmp/image.jpg';
            const result = await convertToAvif(source);

            expect(mockRunAvifPipeline).toHaveBeenCalledWith(source);
            expect(result).toEqual({
                preview: previewBuffer,
                banner: bannerBuffer,
                full: fullBuffer,
            });
        });

        it('calls runAvifPipeline when source is buffer', async () => {
            const source = Buffer.from([0xff, 0xd8]);
            await convertToAvif(source);

            expect(mockRunAvifPipeline).toHaveBeenCalledWith(source);
        });
    });

    describe('with abortSignal when worker path does not exist', () => {
        it('throws with message including worker path', async () => {
            mockExistsSync.mockReturnValue(false);
            const controller = new AbortController();

            await expect(convertToAvif('/path/to/source.jpg', controller.signal)).rejects.toThrow(
                /convertToAvifWorker not found at .*; build the ImageProcessor artifact to include the worker/,
            );
        });
    });

    describe('with abortSignal and worker', () => {
        it('resolves when worker posts success message', async () => {
            const controller = new AbortController();
            const promise = convertToAvif('/path/to/source.jpg', controller.signal);

            expect(messageHandler).not.toBeNull();
            messageHandler!({
                preview: previewBuffer,
                banner: bannerBuffer,
                full: fullBuffer,
            });

            await expect(promise).resolves.toEqual({
                preview: previewBuffer,
                banner: bannerBuffer,
                full: fullBuffer,
            });
        });

        it('passes sourcePath in workerData when source is string', async () => {
            const { Worker } = require('worker_threads');
            const source = '/tmp/image.png';
            const promise = convertToAvif(source, new AbortController().signal);

            expect(Worker).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    workerData: { sourcePath: source },
                }),
            );
            messageHandler!({
                preview: previewBuffer,
                banner: bannerBuffer,
                full: fullBuffer,
            });
            await promise;
        });

        it('passes sourceBuffer in workerData when source is buffer', async () => {
            const { Worker } = require('worker_threads');
            const source = Buffer.from([1, 2, 3]);
            const promise = convertToAvif(source, new AbortController().signal);

            expect(Worker).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    workerData: { sourceBuffer: source },
                }),
            );
            messageHandler!({
                preview: previewBuffer,
                banner: bannerBuffer,
                full: fullBuffer,
            });
            await promise;
        });

        it('rejects when worker posts error message', async () => {
            const controller = new AbortController();
            const promise = convertToAvif('/path', controller.signal);

            messageHandler!({ error: 'Sharp conversion failed' });

            await expect(promise).rejects.toThrow('Sharp conversion failed');
        });

        it('rejects when worker posts invalid message (missing preview)', async () => {
            const controller = new AbortController();
            const promise = convertToAvif('/path', controller.signal);

            messageHandler!({ banner: bannerBuffer, full: fullBuffer });

            await expect(promise).rejects.toThrow('convertToAvifWorker: invalid message');
        });

        it('rejects when worker posts invalid message (empty object)', async () => {
            const controller = new AbortController();
            const promise = convertToAvif('/path', controller.signal);

            messageHandler!({});

            await expect(promise).rejects.toThrow('convertToAvifWorker: invalid message');
        });

        it('rejects when worker emits error', async () => {
            const controller = new AbortController();
            const promise = convertToAvif('/path', controller.signal);

            const workerError = new Error('Worker thread crashed');
            errorHandler!(workerError);

            await expect(promise).rejects.toThrow('Worker thread crashed');
            expect(mockTerminate).toHaveBeenCalled();
        });

        it('rejects when worker exits with non-zero code', async () => {
            const controller = new AbortController();
            const promise = convertToAvif('/path', controller.signal);

            exitHandler!(1);

            await expect(promise).rejects.toThrow('convertToAvifWorker exited with code 1');
        });

        it('rejects when worker exits with null code', async () => {
            const controller = new AbortController();
            const promise = convertToAvif('/path', controller.signal);

            exitHandler!(null);

            await expect(promise).rejects.toThrow('convertToAvifWorker exited with code null');
        });

        it('does not reject on exit when already settled by message', async () => {
            const controller = new AbortController();
            const promise = convertToAvif('/path', controller.signal);

            messageHandler!({
                preview: previewBuffer,
                banner: bannerBuffer,
                full: fullBuffer,
            });
            exitHandler!(1);

            await expect(promise).resolves.toEqual({
                preview: previewBuffer,
                banner: bannerBuffer,
                full: fullBuffer,
            });
        });

        it('calls worker.terminate() and rejects when abortSignal aborts', async () => {
            const controller = new AbortController();
            const promise = convertToAvif('/path', controller.signal);

            controller.abort(new Error('Timed out'));

            await expect(promise).rejects.toThrow('Timed out');
            expect(mockTerminate).toHaveBeenCalled();
        });

        it('rejects immediately when abortSignal is already aborted', async () => {
            const controller = new AbortController();
            controller.abort(new Error('Already aborted'));

            const promise = convertToAvif('/path', controller.signal);

            await expect(promise).rejects.toThrow('Already aborted');
            expect(mockTerminate).toHaveBeenCalled();
        });
    });
});
