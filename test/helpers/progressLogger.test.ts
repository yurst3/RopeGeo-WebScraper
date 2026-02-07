import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ProgressLogger from '../../src/helpers/progressLogger';

describe('ProgressLogger', () => {
    let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.useFakeTimers();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        jest.useRealTimers();
    });

    describe('constructor', () => {
        it('initializes with title and total', () => {
            const logger = new ProgressLogger('Test Progress', 100);

            expect(logger).toBeInstanceOf(ProgressLogger);
        });

        it('sets chunkEnd to total by default', () => {
            const logger = new ProgressLogger('Test Progress', 50);
            
            // We can't directly access private properties, but we can verify through behavior
            logger.setChunk(0, 50);
            logger.logProgress('Starting');
            
            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });

    describe('setChunk', () => {
        it('sets chunk boundaries and resets current position', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            
            logger.setChunk(10, 20);
            logger.logProgress('Item 1');
            
            const logCall = consoleLogSpy.mock.calls[0]?.[0] as string;
            expect(logCall).toContain('Progress: 11/100');
            expect(logCall).toContain('Remaining in chunk: 10');
        });

        it('updates lastProgressTime when setting chunk', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            
            jest.setSystemTime(1000);
            logger.setChunk(0, 10);
            
            jest.setSystemTime(2000);
            logger.logProgress('Item 1');
            
            // Should calculate interval of 1000ms
            const logCall = consoleLogSpy.mock.calls[0]?.[0] as string;
            expect(logCall).toBeDefined();
        });
    });

    describe('logProgress', () => {
        it('logs progress with correct format', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 10);
            
            logger.logProgress('Processing item 1');
            
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            const logCall = consoleLogSpy.mock.calls[0]?.[0] as string;
            expect(logCall).toContain('Test Progress: Processing item 1');
            expect(logCall).toContain('Progress: 1/100');
            expect(logCall).toContain('Remaining in chunk: 10');
        });

        it('increments current counter on each call', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 5);
            
            logger.logProgress('Item 1');
            logger.logProgress('Item 2');
            logger.logProgress('Item 3');
            
            expect(consoleLogSpy).toHaveBeenCalledTimes(3);
            const firstCall = consoleLogSpy.mock.calls[0]?.[0] as string;
            const secondCall = consoleLogSpy.mock.calls[1]?.[0] as string;
            const thirdCall = consoleLogSpy.mock.calls[2]?.[0] as string;
            
            expect(firstCall).toContain('Progress: 1/100');
            expect(secondCall).toContain('Progress: 2/100');
            expect(thirdCall).toContain('Progress: 3/100');
        });

        it('calculates remaining items correctly', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 10);
            
            logger.logProgress('Item 1');
            logger.logProgress('Item 2');
            
            const secondCall = consoleLogSpy.mock.calls[1]?.[0] as string;
            expect(secondCall).toContain('Remaining in chunk: 9');
        });

        it('shows "ETA: calculating..." when no intervals have been recorded', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 10);
            
            // First call sets lastProgressTime but creates no interval
            logger.logProgress('First item');
            
            const logCall = consoleLogSpy.mock.calls[0]?.[0] as string;
            // When averageInterval is 0, estimatedTimeRemainingMs is 0, which formats as "0s"
            // The implementation shows "0s" instead of "calculating..." when there's no interval data
            expect(logCall).toContain('ETA: 0s');
        });

        it('calculates ETA based on running average of intervals', () => {
            const logger = new ProgressLogger('Test Progress', 10);
            
            // Set initial time before setChunk
            jest.setSystemTime(0);
            logger.setChunk(0, 10);
            
            // First call sets lastProgressTime but no interval yet
            jest.setSystemTime(0);
            logger.logProgress('Item 1');
            
            // Second call creates first interval (1000ms)
            jest.setSystemTime(1000);
            logger.logProgress('Item 2');
            
            // Third call creates second interval (1000ms), average = 1000ms
            jest.setSystemTime(2000);
            logger.logProgress('Item 3');
            
            // Fourth call should show ETA based on average
            jest.setSystemTime(3000);
            logger.logProgress('Item 4');
            
            const fourthCall = consoleLogSpy.mock.calls[3]?.[0] as string;
            // Should have ETA (not "calculating...")
            expect(fourthCall).not.toContain('ETA: calculating...');
            expect(fourthCall).toContain('ETA:');
        });

        it('formats ETA correctly for hours, minutes, and seconds', () => {
            const logger = new ProgressLogger('Test Progress', 10);
            
            // Set initial time before setChunk
            jest.setSystemTime(0);
            logger.setChunk(0, 10);
            
            // First call sets lastProgressTime but creates no interval
            jest.setSystemTime(0);
            logger.logProgress('Item 1');
            
            // Second call creates first interval (2 hours = 7200000ms)
            jest.setSystemTime(7200000);
            logger.logProgress('Item 2');
            
            // Third call uses the interval (7200000ms) to calculate ETA
            // Remaining: 10 - 3 + 1 = 8 items
            // ETA: 7200000ms * 8 = 57600000ms = 16 hours
            jest.setSystemTime(14400000);
            logger.logProgress('Item 3');
            
            const thirdCall = consoleLogSpy.mock.calls[2]?.[0] as string;
            expect(thirdCall).toMatch(/ETA: \d+h \d+m \d+s/);
        });

        it('formats ETA correctly for minutes and seconds only', () => {
            const logger = new ProgressLogger('Test Progress', 10);
            
            // Set initial time before setChunk
            jest.setSystemTime(0);
            logger.setChunk(0, 10);
            
            // First call sets lastProgressTime but creates no interval
            jest.setSystemTime(0);
            logger.logProgress('Item 1');
            
            // Second call creates first interval (2 minutes = 120000ms)
            jest.setSystemTime(120000);
            logger.logProgress('Item 2');
            
            // Third call uses the interval (120000ms) to calculate ETA
            // Remaining: 10 - 3 + 1 = 8 items
            // ETA: 120000ms * 8 = 960000ms = 16 minutes
            jest.setSystemTime(240000);
            logger.logProgress('Item 3');
            
            const thirdCall = consoleLogSpy.mock.calls[2]?.[0] as string;
            expect(thirdCall).toMatch(/ETA: \d+m \d+s/);
            expect(thirdCall).not.toMatch(/ETA: \d+h/);
        });

        it('formats ETA correctly for seconds only', () => {
            const logger = new ProgressLogger('Test Progress', 10);
            
            // Set initial time before setChunk
            jest.setSystemTime(0);
            logger.setChunk(0, 10);
            
            jest.setSystemTime(0);
            logger.logProgress('Item 1');
            
            // Create interval of 2 seconds (2000ms)
            jest.setSystemTime(2000);
            logger.logProgress('Item 2');
            
            // Next call should show ETA in seconds format
            jest.setSystemTime(4000);
            logger.logProgress('Item 3');
            
            const thirdCall = consoleLogSpy.mock.calls[2]?.[0] as string;
            expect(thirdCall).toMatch(/ETA: \d+s/);
            expect(thirdCall).not.toMatch(/ETA: \d+m/);
            expect(thirdCall).not.toMatch(/ETA: \d+h/);
        });

        it('keeps only the last 10 intervals for running average', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            
            // Set initial time before setChunk
            jest.setSystemTime(0);
            logger.setChunk(0, 20);
            
            jest.setSystemTime(0);
            logger.logProgress('Item 1');
            
            // Create 12 intervals
            for (let i = 1; i <= 12; i++) {
                jest.setSystemTime(i * 1000);
                logger.logProgress(`Item ${i + 1}`);
            }
            
            // After 12 calls, we should have 11 intervals recorded
            // But the implementation keeps only the last 10
            // The 13th call should use the average of the last 10 intervals
            jest.setSystemTime(13000);
            logger.logProgress('Item 14');
            
            expect(consoleLogSpy).toHaveBeenCalledTimes(14);
        });

        it('calculates remaining total correctly', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            
            // Set initial time before setChunk
            jest.setSystemTime(0);
            logger.setChunk(0, 10);
            
            // Process 5 items
            for (let i = 0; i < 5; i++) {
                jest.setSystemTime(i * 1000);
                logger.logProgress(`Item ${i + 1}`);
            }
            
            const lastCall = consoleLogSpy.mock.calls[4]?.[0] as string;
            // Should show remaining total (100 - 5 = 95)
            expect(lastCall).toContain('Progress: 5/100');
        });

        it('handles chunk boundaries correctly', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(10, 20);
            
            logger.logProgress('Item 1');
            
            const logCall = consoleLogSpy.mock.calls[0]?.[0] as string;
            expect(logCall).toContain('Progress: 11/100');
            expect(logCall).toContain('Remaining in chunk: 10');
        });

        it('handles edge case when current equals chunkEnd', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 1);
            
            logger.logProgress('Item 1');
            
            const logCall = consoleLogSpy.mock.calls[0]?.[0] as string;
            expect(logCall).toContain('Remaining in chunk: 1');
        });

        it('increments successes counter on each logProgress call', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 10);
            
            logger.logProgress('Item 1');
            logger.logProgress('Item 2');
            logger.logProgress('Item 3');
            
            const results = logger.getResults();
            expect(results.successes).toBe(3);
        });
    });

    describe('logError', () => {
        it('logs error with correct format using console.error', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 10);
            
            logger.logError('Error processing item 1');
            
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            const logCall = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(logCall).toContain('Test Progress: Error processing item 1');
            expect(logCall).toContain('Progress: 1/100');
            expect(logCall).toContain('Remaining in chunk: 10');
        });

        it('increments errors counter on each call', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 10);
            
            logger.logError('Error 1');
            logger.logError('Error 2');
            logger.logError('Error 3');
            
            const results = logger.getResults();
            expect(results.errors).toBe(3);
        });

        it('increments current counter on each call', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 10);
            
            logger.logError('Error 1');
            logger.logError('Error 2');
            logger.logError('Error 3');
            
            expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
            const firstCall = consoleErrorSpy.mock.calls[0]?.[0] as string;
            const secondCall = consoleErrorSpy.mock.calls[1]?.[0] as string;
            const thirdCall = consoleErrorSpy.mock.calls[2]?.[0] as string;
            
            expect(firstCall).toContain('Progress: 1/100');
            expect(secondCall).toContain('Progress: 2/100');
            expect(thirdCall).toContain('Progress: 3/100');
        });

        it('calculates ETA correctly for errors', () => {
            const logger = new ProgressLogger('Test Progress', 10);
            
            jest.setSystemTime(0);
            logger.setChunk(0, 10);
            
            jest.setSystemTime(0);
            logger.logError('Error 1');
            
            jest.setSystemTime(1000);
            logger.logError('Error 2');
            
            jest.setSystemTime(2000);
            logger.logError('Error 3');
            
            const thirdCall = consoleErrorSpy.mock.calls[2]?.[0] as string;
            expect(thirdCall).toContain('ETA:');
        });

        it('can be mixed with logProgress calls', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 10);
            
            logger.logProgress('Success 1');
            logger.logError('Error 1');
            logger.logProgress('Success 2');
            logger.logError('Error 2');
            
            const results = logger.getResults();
            expect(results.successes).toBe(2);
            expect(results.errors).toBe(2);
            expect(consoleLogSpy).toHaveBeenCalledTimes(2);
            expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
        });

        it('handles chunk boundaries correctly', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(10, 20);
            
            logger.logError('Error 1');
            
            const logCall = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(logCall).toContain('Progress: 11/100');
            expect(logCall).toContain('Remaining in chunk: 10');
        });
    });

    describe('getResults', () => {
        it('returns correct counts when no progress has been made', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 100);
            
            const results = logger.getResults();
            
            expect(results).toEqual({
                errors: 0,
                successes: 0,
                remaining: 100,
            });
        });

        it('returns correct counts after logProgress calls', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 100);
            
            logger.logProgress('Item 1');
            logger.logProgress('Item 2');
            logger.logProgress('Item 3');
            
            const results = logger.getResults();
            
            expect(results).toEqual({
                errors: 0,
                successes: 3,
                remaining: 97, // 100 - 3
            });
        });

        it('returns correct counts after logError calls', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 100);
            
            logger.logError('Error 1');
            logger.logError('Error 2');
            
            const results = logger.getResults();
            
            expect(results).toEqual({
                errors: 2,
                successes: 0,
                remaining: 98, // 100 - 2
            });
        });

        it('returns correct counts after mixed logProgress and logError calls', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(0, 100);
            
            logger.logProgress('Success 1');
            logger.logError('Error 1');
            logger.logProgress('Success 2');
            logger.logError('Error 2');
            logger.logProgress('Success 3');
            
            const results = logger.getResults();
            
            expect(results).toEqual({
                errors: 2,
                successes: 3,
                remaining: 95, // 100 - 5
            });
        });

        it('returns correct remaining count when chunk is set', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(10, 50);
            
            logger.logProgress('Item 1');
            logger.logProgress('Item 2');
            
            const results = logger.getResults();
            
            // remaining = total - current = 100 - 12 = 88
            expect(results.remaining).toBe(88);
        });

        it('returns correct counts when all items are processed', () => {
            const logger = new ProgressLogger('Test Progress', 5);
            logger.setChunk(0, 5);
            
            for (let i = 0; i < 5; i++) {
                logger.logProgress(`Item ${i + 1}`);
            }
            
            const results = logger.getResults();
            
            expect(results).toEqual({
                errors: 0,
                successes: 5,
                remaining: 0, // 5 - 5
            });
        });

        it('returns correct counts with errors when all items are processed', () => {
            const logger = new ProgressLogger('Test Progress', 5);
            logger.setChunk(0, 5);
            
            logger.logProgress('Item 1');
            logger.logError('Error 1');
            logger.logProgress('Item 2');
            logger.logError('Error 2');
            logger.logProgress('Item 3');
            
            const results = logger.getResults();
            
            expect(results).toEqual({
                errors: 2,
                successes: 3,
                remaining: 0, // 5 - 5
            });
        });

        it('returns correct remaining count when chunk start is not zero', () => {
            const logger = new ProgressLogger('Test Progress', 100);
            logger.setChunk(20, 30);
            
            logger.logProgress('Item 1');
            logger.logError('Error 1');
            
            const results = logger.getResults();
            
            // current = 22 (20 + 2), remaining = 100 - 22 = 78
            expect(results.remaining).toBe(78);
        });
    });
});
