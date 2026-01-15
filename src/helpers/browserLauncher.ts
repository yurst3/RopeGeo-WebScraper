import puppeteer, { type Browser } from 'puppeteer';

// Detect if running in Lambda environment
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.LAMBDA_TASK_ROOT;
// Detect if running in GitHub Actions
const isGitHubActions = !!process.env.GITHUB_ACTIONS;

/**
 * Launches a Puppeteer browser with appropriate configuration based on the environment.
 * Handles Lambda and GitHub Actions environments automatically.
 * 
 * @returns A Promise that resolves to a launched Browser instance
 */
export const launchBrowser = async (): Promise<Browser> => {
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
        args: ['--disable-audio-output'],
        headless: false
    };
    
    if (isLambda) {
        const chromium = await import('@sparticuz/chromium');
        launchOptions.args = chromium.default.args;
        launchOptions.executablePath = await chromium.default.executablePath();
    } else if (isGitHubActions) {
        // GitHub Actions requires --no-sandbox flag
        launchOptions.args = ['--no-sandbox'];
    }
    
    return await puppeteer.launch(launchOptions);
};
