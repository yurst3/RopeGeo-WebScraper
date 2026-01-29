import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mainHandler } from '../../../src/ropewiki/lambda-handlers/mainHandler';

// Mock the main function
let mockMain: jest.MockedFunction<typeof import('../../../src/ropewiki/main').main>;
jest.mock('../../../src/ropewiki/main', () => ({
    main: jest.fn(),
}));

// Mock console methods
let consoleLogSpy: ReturnType<typeof jest.spyOn>;
let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

describe('mainHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup console spies
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Setup mock
        const mainModule = require('../../../src/ropewiki/main');
        mockMain = mainModule.main;
        
        // Default mock implementation
        mockMain.mockResolvedValue(0);
    });

    it('successfully processes and returns formatted time', async () => {
        mockMain.mockResolvedValue(3665); // 1 hour, 1 minute, 5 seconds

        const result = await mainHandler();

        expect(mockMain).toHaveBeenCalledTimes(1);
        expect(mockMain).toHaveBeenCalledWith(
            expect.any(Function), // lambdaProcessPagesChunk
            expect.any(Function), // lambdaProcessRopewikiRoutes
        );
        expect(consoleLogSpy).toHaveBeenCalledWith('\nTotal time: 1h 1m 5s');
        expect(result).toEqual({
            statusCode: 200,
            body: JSON.stringify({
                message: 'Ropewiki scraper completed successfully',
                totalTime: '1h 1m 5s',
            }),
        });
    });

    it('formats time correctly for zero seconds', async () => {
        mockMain.mockResolvedValue(0);

        const result = await mainHandler();

        expect(consoleLogSpy).toHaveBeenCalledWith('\nTotal time: 0h 0m 0s');
        expect(result.body).toContain('"totalTime":"0h 0m 0s"');
    });

    it('formats time correctly for less than a minute', async () => {
        mockMain.mockResolvedValue(45);

        const result = await mainHandler();

        expect(consoleLogSpy).toHaveBeenCalledWith('\nTotal time: 0h 0m 45s');
        expect(result.body).toContain('"totalTime":"0h 0m 45s"');
    });

    it('formats time correctly for less than an hour', async () => {
        mockMain.mockResolvedValue(125); // 2 minutes, 5 seconds

        const result = await mainHandler();

        expect(consoleLogSpy).toHaveBeenCalledWith('\nTotal time: 0h 2m 5s');
        expect(result.body).toContain('"totalTime":"0h 2m 5s"');
    });

    it('formats time correctly for exactly one hour', async () => {
        mockMain.mockResolvedValue(3600); // 1 hour

        const result = await mainHandler();

        expect(consoleLogSpy).toHaveBeenCalledWith('\nTotal time: 1h 0m 0s');
        expect(result.body).toContain('"totalTime":"1h 0m 0s"');
    });

    it('formats time correctly for multiple hours', async () => {
        mockMain.mockResolvedValue(7325); // 2 hours, 2 minutes, 5 seconds

        const result = await mainHandler();

        expect(consoleLogSpy).toHaveBeenCalledWith('\nTotal time: 2h 2m 5s');
        expect(result.body).toContain('"totalTime":"2h 2m 5s"');
    });

    it('formats time correctly for large values', async () => {
        mockMain.mockResolvedValue(36665); // 10 hours, 11 minutes, 5 seconds

        const result = await mainHandler();

        expect(consoleLogSpy).toHaveBeenCalledWith('\nTotal time: 10h 11m 5s');
        expect(result.body).toContain('"totalTime":"10h 11m 5s"');
    });

    it('handles errors and returns 500 status code', async () => {
        const error = new Error('Database connection failed');
        mockMain.mockRejectedValue(error);

        const result = await mainHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in Ropewiki scraper:', error);
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki scraper failed',
                error: 'Database connection failed',
            }),
        });
    });

    it('handles non-Error objects in catch block', async () => {
        const error = 'String error';
        mockMain.mockRejectedValue(error);

        const result = await mainHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in Ropewiki scraper:', error);
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki scraper failed',
                error: 'String error',
            }),
        });
    });

    it('handles null error in catch block', async () => {
        mockMain.mockRejectedValue(null);

        const result = await mainHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in Ropewiki scraper:', null);
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki scraper failed',
                error: 'null',
            }),
        });
    });

    it('handles undefined error in catch block', async () => {
        mockMain.mockRejectedValue(undefined);

        const result = await mainHandler();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in Ropewiki scraper:', undefined);
        expect(result).toEqual({
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki scraper failed',
                error: 'undefined',
            }),
        });
    });

    it('calls main with lambda hook functions', async () => {
        mockMain.mockResolvedValue(100);

        await mainHandler();

        expect(mockMain).toHaveBeenCalledTimes(1);
        const callArgs = mockMain.mock.calls[0];
        expect(callArgs).toHaveLength(2);
        // Verify the functions are the lambda hook functions (we can't easily verify the exact functions
        // without importing them, but we can verify they are functions)
        expect(typeof callArgs[0]).toBe('function');
        expect(typeof callArgs[1]).toBe('function');
    });
});
