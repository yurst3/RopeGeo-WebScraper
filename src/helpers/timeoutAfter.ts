/**
 * Runs the callback and returns its promise, but rejects immediately with an error
 * if timeoutMs elapses before the callback settles. The callback receives the
 * AbortSignal that fires when the time is up, so it can perform cleanup (e.g. close
 * a resource) on timeout.
 *
 * @param timeoutMs - Max time in ms before timing out
 * @param callback - Async work; receives the AbortSignal that fires when time is up
 * @returns The callback's result, or rejects with Error if timeoutMs is reached
 */
export async function timeoutAfter<T>(
    timeoutMs: number,
    callback: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
    const signal = AbortSignal.timeout(timeoutMs);
    const work = callback(signal);
    const timeoutPromise = new Promise<never>((_, rej) => {
        const onAbort = () => rej(new Error(`Timed out after ${timeoutMs}ms`));
        signal.addEventListener('abort', onAbort);
        if (signal.aborted) onAbort();
    });
    return Promise.race([work, timeoutPromise]);
}
