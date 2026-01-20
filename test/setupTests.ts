import { jest } from '@jest/globals';

// Suppress console output during tests (but keep methods available for selective mocking in tests)
// Tests can still spy on console methods if needed: jest.spyOn(console, 'error').mockImplementation(...)
const originalConsole = global.console;

global.console = {
    ...originalConsole,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};

