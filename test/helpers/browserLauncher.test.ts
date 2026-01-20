import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { launchBrowser } from '../../src/helpers/browserLauncher';
import puppeteer from 'puppeteer';

// Mock puppeteer
const mockBrowser = {
    close: jest.fn(),
    newPage: jest.fn(),
} as unknown as Awaited<ReturnType<typeof puppeteer.launch>>;

jest.mock('puppeteer', () => ({
    __esModule: true,
    default: {
        launch: jest.fn<() => Promise<typeof mockBrowser>>(),
    },
}));

// Mock @sparticuz/chromium
const mockChromium = {
    default: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: jest.fn<() => Promise<string>>(),
    },
};

jest.mock('@sparticuz/chromium', () => mockChromium);

describe('launchBrowser', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        const mockLaunch = puppeteer.launch as jest.MockedFunction<typeof puppeteer.launch>;
        mockLaunch.mockResolvedValue(mockBrowser);
        mockChromium.default.executablePath.mockResolvedValue('/path/to/chromium');
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('launches browser with default options in local environment', async () => {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME;
        delete process.env.LAMBDA_TASK_ROOT;
        delete process.env.GITHUB_ACTIONS;

        const browser = await launchBrowser();
        const mockLaunch = puppeteer.launch as jest.MockedFunction<typeof puppeteer.launch>;

        expect(mockLaunch).toHaveBeenCalledTimes(1);
        expect(mockLaunch).toHaveBeenCalledWith({});
        expect(browser).toBe(mockBrowser);
    });

    it('launches browser with Lambda configuration when AWS_LAMBDA_FUNCTION_NAME is set', async () => {
        process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
        delete process.env.LAMBDA_TASK_ROOT;
        delete process.env.GITHUB_ACTIONS;

        // Reset modules to get fresh instance with updated environment
        jest.resetModules();
        
        // Re-mock puppeteer after reset
        jest.doMock('puppeteer', () => ({
            __esModule: true,
            default: {
                launch: jest.fn<() => Promise<typeof mockBrowser>>().mockResolvedValue(mockBrowser),
            },
        }));
        
        // Re-mock @sparticuz/chromium after reset - use unstable_mockModule for dynamic imports
        const mockExecutablePath = jest.fn<() => Promise<string>>().mockResolvedValue('/path/to/chromium');
        jest.unstable_mockModule('@sparticuz/chromium', () => ({
            default: {
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: mockExecutablePath,
            },
        }));
        
        // Re-import browserLauncher to get fresh module with updated environment
        const { launchBrowser: launchBrowserReloaded } = require('../../src/helpers/browserLauncher');
        const browser = await launchBrowserReloaded();
        
        const puppeteerReloaded = require('puppeteer');
        const mockLaunch = puppeteerReloaded.default.launch as jest.MockedFunction<typeof puppeteerReloaded.default.launch>;
        
        expect(mockExecutablePath).toHaveBeenCalledTimes(1);
        expect(mockLaunch).toHaveBeenCalledTimes(1);
        expect(mockLaunch).toHaveBeenCalledWith({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: '/path/to/chromium',
        });
        expect(browser).toBe(mockBrowser);
    });

    it('launches browser with Lambda configuration when LAMBDA_TASK_ROOT is set', async () => {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME;
        process.env.LAMBDA_TASK_ROOT = '/var/task';
        delete process.env.GITHUB_ACTIONS;

        jest.resetModules();
        
        // Re-mock puppeteer after reset
        jest.doMock('puppeteer', () => ({
            __esModule: true,
            default: {
                launch: jest.fn<() => Promise<typeof mockBrowser>>().mockResolvedValue(mockBrowser),
            },
        }));
        
        // Re-mock @sparticuz/chromium after reset - use unstable_mockModule for dynamic imports
        const mockExecutablePath = jest.fn<() => Promise<string>>().mockResolvedValue('/path/to/chromium');
        jest.unstable_mockModule('@sparticuz/chromium', () => ({
            default: {
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: mockExecutablePath,
            },
        }));
        
        const { launchBrowser: launchBrowserReloaded } = require('../../src/helpers/browserLauncher');
        const browser = await launchBrowserReloaded();
        
        const puppeteerReloaded = require('puppeteer');
        const mockLaunch = puppeteerReloaded.default.launch as jest.MockedFunction<typeof puppeteerReloaded.default.launch>;
        
        expect(mockExecutablePath).toHaveBeenCalledTimes(1);
        expect(mockLaunch).toHaveBeenCalledTimes(1);
        expect(mockLaunch).toHaveBeenCalledWith({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: '/path/to/chromium',
        });
        expect(browser).toBe(mockBrowser);
    });

    it('launches browser with GitHub Actions configuration when GITHUB_ACTIONS is set', async () => {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME;
        delete process.env.LAMBDA_TASK_ROOT;
        process.env.GITHUB_ACTIONS = 'true';

        jest.resetModules();
        
        // Re-mock puppeteer after reset
        jest.doMock('puppeteer', () => ({
            __esModule: true,
            default: {
                launch: jest.fn<() => Promise<typeof mockBrowser>>().mockResolvedValue(mockBrowser),
            },
        }));
        
        const { launchBrowser: launchBrowserReloaded } = require('../../src/helpers/browserLauncher');
        const browser = await launchBrowserReloaded();
        
        const puppeteerReloaded = require('puppeteer');
        const mockLaunch = puppeteerReloaded.default.launch as jest.MockedFunction<typeof puppeteerReloaded.default.launch>;
        
        expect(mockLaunch).toHaveBeenCalledTimes(1);
        expect(mockLaunch).toHaveBeenCalledWith({
            args: ['--no-sandbox'],
        });
        expect(browser).toBe(mockBrowser);
    });

    it('prioritizes Lambda configuration over GitHub Actions when both are set', async () => {
        process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
        process.env.GITHUB_ACTIONS = 'true';

        jest.resetModules();
        
        // Re-mock puppeteer after reset
        jest.doMock('puppeteer', () => ({
            __esModule: true,
            default: {
                launch: jest.fn<() => Promise<typeof mockBrowser>>().mockResolvedValue(mockBrowser),
            },
        }));
        
        // Re-mock @sparticuz/chromium after reset - use unstable_mockModule for dynamic imports
        const mockExecutablePath = jest.fn<() => Promise<string>>().mockResolvedValue('/path/to/chromium');
        jest.unstable_mockModule('@sparticuz/chromium', () => ({
            default: {
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: mockExecutablePath,
            },
        }));
        
        const { launchBrowser: launchBrowserReloaded } = require('../../src/helpers/browserLauncher');
        const browser = await launchBrowserReloaded();
        
        const puppeteerReloaded = require('puppeteer');
        const mockLaunch = puppeteerReloaded.default.launch as jest.MockedFunction<typeof puppeteerReloaded.default.launch>;
        
        expect(mockExecutablePath).toHaveBeenCalledTimes(1);
        expect(mockLaunch).toHaveBeenCalledTimes(1);
        expect(mockLaunch).toHaveBeenCalledWith({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: '/path/to/chromium',
        });
        expect(browser).toBe(mockBrowser);
    });

    it('propagates errors from puppeteer.launch', async () => {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME;
        delete process.env.LAMBDA_TASK_ROOT;
        delete process.env.GITHUB_ACTIONS;

        const error = new Error('Failed to launch browser');
        const mockLaunch = puppeteer.launch as jest.MockedFunction<typeof puppeteer.launch>;
        mockLaunch.mockRejectedValue(error);

        await expect(launchBrowser()).rejects.toThrow('Failed to launch browser');
    });

    it('propagates errors from chromium.executablePath in Lambda environment', async () => {
        process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';

        const error = new Error('Failed to get executable path');

        jest.resetModules();
        
        // Re-mock puppeteer after reset
        jest.doMock('puppeteer', () => ({
            __esModule: true,
            default: {
                launch: jest.fn<() => Promise<typeof mockBrowser>>().mockResolvedValue(mockBrowser),
            },
        }));
        
        // Re-mock @sparticuz/chromium after reset with error - use unstable_mockModule for dynamic imports
        const mockExecutablePath = jest.fn<() => Promise<string>>().mockRejectedValue(error);
        jest.unstable_mockModule('@sparticuz/chromium', () => ({
            default: {
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: mockExecutablePath,
            },
        }));
        
        const { launchBrowser: launchBrowserReloaded } = require('../../src/helpers/browserLauncher');

        await expect(launchBrowserReloaded()).rejects.toThrow('Failed to get executable path');
    });
});
