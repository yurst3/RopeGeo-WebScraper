/**
 * Wrapper for HTTP requests: sets headers, throws on non-OK or failed request with
 * detailed messages, and optionally routes through a proxy in Lambda dev/prod.
 */

import { ProxyAgent, fetch as undiciFetch } from 'undici';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'WebScraper/1.0 (compatible; +https://github.com)',
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
  const proxyUrl = process.env.PROXY_URL ?? process.env.HTTP_PROXY ?? process.env.HTTPS_PROXY;
  if (!proxyUrl) throw new Error(`PROXY_URL not defined in ${process.env.DEV_ENVIRONMENT} environment`);
  return new ProxyAgent(proxyUrl);
};

export type HttpRequestInit = RequestInit & { dispatcher?: ProxyAgent };

/**
 * Send an HTTP request with default headers and optional proxy (Lambda + dev/prod only).
 * Throws an Error with detailed message on non-OK response or failed request.
 */
export async function httpRequest(url: string | URL, init?: HttpRequestInit): Promise<Response> {
  const requestUrl = typeof url === 'string' ? url : url.toString();
  const dispatcher = shouldUseProxy() ? getProxyDispatcher() : undefined;

  const mergedInit: RequestInit = {
    ...init,
    headers: {
      ...DEFAULT_HEADERS,
      ...init?.headers,
    },
    ...(dispatcher ? { dispatcher } : {}),
  };

  let response: Response;
  try {
    if (dispatcher) {
      response = (await undiciFetch(url, mergedInit as Parameters<typeof undiciFetch>[1])) as Response;
    } else {
      response = await fetch(url, mergedInit);
    }
  } catch (error) {
    const message = `httpRequest failed: requestUrl=${requestUrl} error=${error}`;
    throw new Error(message);
  }

  if (!response.ok) {
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
    const message =
      `httpRequest non-OK: status=${response.status} statusText=${response.statusText} ` +
      `requestUrl=${requestUrl} finalUrl=${finalUrl} server=${server} responseBody=${bodyPreview}`;
    throw new Error(message);
  }

  return response;
}

export default httpRequest;
