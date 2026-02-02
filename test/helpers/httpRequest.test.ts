import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { httpRequest } from '../../src/helpers/httpRequest';

type MockFetch = ReturnType<typeof jest.fn<typeof fetch>>;

describe('httpRequest', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.DEV_ENVIRONMENT;
    delete process.env.PROXY_URL;
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    const mockFetch = globalThis.fetch as MockFetch | undefined;
    if (mockFetch && typeof mockFetch.mockClear === 'function') {
      mockFetch.mockClear();
    }
    // @ts-expect-error clear test double
    globalThis.fetch = undefined;
  });

  it('throws when proxy should be used but PROXY_URL is not set (Lambda + dev)', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
    process.env.DEV_ENVIRONMENT = 'dev';
    delete process.env.PROXY_URL;
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;

    const err = await httpRequest('https://example.com/').catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('PROXY_URL not defined');
    expect((err as Error).message).toContain('dev');
  });

  it('throws when proxy should be used but PROXY_URL is not set (Lambda + production)', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
    process.env.DEV_ENVIRONMENT = 'production';
    delete process.env.PROXY_URL;
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;

    const err = await httpRequest('https://example.com/').catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('PROXY_URL not defined');
    expect((err as Error).message).toContain('production');
  });

  it('sends request with default headers when fetch succeeds', async () => {
    const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
    } as Response);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await httpRequest('https://example.com/');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://example.com/');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('WebScraper');
    expect(headers['Accept']).toBe('application/json, text/html, application/xml, */*');
    expect(headers['Accept-Language']).toBe('en-US,en;q=0.9');
  });

  it('merges custom headers with defaults', async () => {
    const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await httpRequest('https://example.com/', {
      headers: { 'X-Custom': 'value' },
    });

    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('WebScraper');
    expect(headers['X-Custom']).toBe('value');
  });

  it('throws when response is not OK', async () => {
    const mockErrorBody = 'Forbidden';
    const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      url: 'https://example.com/',
      headers: { get: () => null },
      clone: () => ({ text: () => Promise.resolve(mockErrorBody) }),
    } as Response);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const err = await httpRequest('https://example.com/').catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toContain('httpRequest non-OK: status=403');
    expect(msg).toContain('statusText=Forbidden');
    expect(msg).toContain('responseBody=Forbidden');
  });

  it('throws when fetch fails', async () => {
    const networkError = new Error('network failure');
    const mockFetch = jest.fn<typeof fetch>().mockRejectedValue(networkError);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const err = await httpRequest('https://example.com/').catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toContain('httpRequest failed:');
    expect(msg).toContain('requestUrl=https://example.com/');
    expect(msg).toContain('network failure');
  });

  it('does not use proxy when not in Lambda', async () => {
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.DEV_ENVIRONMENT;
    delete process.env.PROXY_URL;
    const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await httpRequest('https://example.com/');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(init).not.toHaveProperty('dispatcher');
  });

  it('does not use proxy when in Lambda but DEV_ENVIRONMENT is local', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
    process.env.DEV_ENVIRONMENT = 'local';
    process.env.PROXY_URL = 'http://proxy.example.com:8080';
    const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await httpRequest('https://example.com/');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(init).not.toHaveProperty('dispatcher');
  });

});
