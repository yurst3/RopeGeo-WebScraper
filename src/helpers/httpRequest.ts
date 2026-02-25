/**
 * Wrapper for HTTP requests: sets headers, throws on non-OK or failed request with
 * detailed messages, and optionally routes through a proxy in Lambda dev/prod.
 */

import { ProxyAgent, fetch as undiciFetch } from 'undici';

const DEFAULT_HEADERS: Record<string, string> = {
    Accept: 'application/json, text/html, application/xml, */*',
    'Accept-Language': 'en-US,en;q=0.9',
};

const isLambda = (): boolean => typeof process.env.AWS_LAMBDA_FUNCTION_NAME === 'string' && process.env.AWS_LAMBDA_FUNCTION_NAME.length > 0;

const shouldUseProxy = (): boolean => {
    if (!isLambda()) return false;
    const env = process.env.DEV_ENVIRONMENT;
    return env === 'dev' || env === 'production';
}

const getProxyDispatcher = (): ProxyAgent => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const proxyUrl = process.env.PROXY_URL ?? process.env.HTTP_PROXY ?? process.env.HTTPS_PROXY;
    if (!proxyUrl) throw new Error(`PROXY_URL not defined in ${process.env.DEV_ENVIRONMENT} environment`);
    return new ProxyAgent(proxyUrl);
};

const buildNonOkMessage = async (
    response: Response,
    requestUrl: string,
): Promise<string> => {
    const finalUrl = response.url;
    const server =
        response.headers.get('server') ?? response.headers.get('x-powered-by') ?? '(none)';
    let bodyText = '';
    try {
        bodyText = await response.clone().text();
    } catch {
        bodyText = '(failed to read body)';
    }
    const bodyPreview = bodyText.length > 2000 ? `${bodyText.slice(0, 2000)}...` : bodyText;
    return (
        `httpRequest non-OK: status=${response.status} statusText=${response.statusText} ` +
        `requestUrl=${requestUrl} finalUrl=${finalUrl} server=${server} responseBody=${bodyPreview}`
    );
};

/** Request timeout in ms when using proxy (avoids Lambda hanging until 900s timeout). */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Send an HTTP request with default headers and optional proxy (Lambda + dev/prod only).
 * Throws an Error with detailed message on non-OK response or failed request.
 * Retries on fetch errors or 5XX (except 502) / 403 responses up to retryCount times (default 5).
 * When using the proxy, each attempt is limited to REQUEST_TIMEOUT_MS so the Lambda does not hang.
 */
export async function httpRequest(url: string | URL, retryCount = 5): Promise<Response> {
    const requestUrl = typeof url === 'string' ? url : url.toString();
    const dispatcher = shouldUseProxy() ? getProxyDispatcher() : undefined;

    let lastError: Error | null = null;
    const maxAttempts = retryCount + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const requestOptions = {
            headers: DEFAULT_HEADERS,
            ...(dispatcher ? { dispatcher } : {}),
            ...(dispatcher ? { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) } : {}),
        };

        let response: Response;
        try {
            response = (await undiciFetch(requestUrl, requestOptions as Parameters<typeof undiciFetch>[1])) as Response;
        } catch (error) {
            lastError = new Error(`httpRequest failed: requestUrl=${requestUrl} error=${error}`);
            if (attempt < maxAttempts - 1) {
                console.warn(
                    `httpRequest retry ${attempt + 1}/${retryCount}: fetch failed - ${error}`,
                );
                continue;
            }
            throw lastError;
        }

        if (!response.ok) {
            const message = await buildNonOkMessage(response, requestUrl);
            lastError = new Error(message);
            const isRetryableStatus = (response.status >= 500 && response.status !== 502) || response.status === 403;
            if (isRetryableStatus && attempt < maxAttempts - 1) {
                console.warn(
                    `httpRequest retry ${attempt + 1}/${retryCount}: status ${response.status} ${response.statusText}`,
                );
                continue;
            }
            throw lastError;
        }

        return response;
    }

    throw lastError ?? new Error(`httpRequest failed: requestUrl=${requestUrl}`);
}

export default httpRequest;
