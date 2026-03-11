import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { fetch as undiciFetch } from 'undici';
import { httpRequest } from '../../src/helpers/httpRequest';

jest.mock('undici', () => ({
  ...jest.requireActual<typeof import('undici')>('undici'),
  fetch: jest.fn(),
}));

const mockFetch = jest.mocked(undiciFetch);

describe('httpRequest', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.DEV_ENVIRONMENT;
    delete process.env.PROXY_URL;
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    mockFetch.mockClear();
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
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
    } as Response);

    await httpRequest('https://example.com/');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://example.com/');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/json, text/html, application/xml, */*');
    expect(headers['Accept-Language']).toBe('en-US,en;q=0.9');
  });

  it('throws when response is not OK', async () => {
    const mockErrorBody = 'Forbidden';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      url: 'https://example.com/',
      headers: { get: () => null },
      clone: () => ({ text: () => Promise.resolve(mockErrorBody) }),
    } as Response);

    const err = await httpRequest('https://example.com/').catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toContain('httpRequest non-OK: status=403');
    expect(msg).toContain('statusText=Forbidden');
    expect(msg).toContain('responseBody=Forbidden');
  });

  it('throws when fetch fails', async () => {
    const networkError = new Error('network failure');
    mockFetch.mockRejectedValue(networkError);

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
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response);

    await httpRequest('https://example.com/');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(init).not.toHaveProperty('dispatcher');
  });

  it('does not use proxy when in Lambda but DEV_ENVIRONMENT is local', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
    process.env.DEV_ENVIRONMENT = 'local';
    process.env.PROXY_URL = 'http://proxy.example.com:8080';
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response);

    await httpRequest('https://example.com/');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(init).not.toHaveProperty('dispatcher');
  });

  it('retries on 500 and succeeds on second attempt', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        url: 'https://example.com/',
        headers: { get: () => null },
        clone: () => ({ text: () => Promise.resolve('error') }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

    const response = await httpRequest('https://example.com/');

    expect(response.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on fetch throw and succeeds on second attempt', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

    const response = await httpRequest('https://example.com/');

    expect(response.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries on 500', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      url: 'https://example.com/',
      headers: { get: () => null },
      clone: () => ({ text: () => Promise.resolve('error') }),
    } as Response);

    const err = await httpRequest('https://example.com/', 2).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('httpRequest non-OK: status=500');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting retries on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('network failure'));

    const err = await httpRequest('https://example.com/', 2).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('httpRequest failed:');
    expect((err as Error).message).toContain('network failure');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('retries on 403 and succeeds on second attempt', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        url: 'https://example.com/',
        headers: { get: () => null },
        clone: () => ({ text: () => Promise.resolve('Forbidden') }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

    const response = await httpRequest('https://example.com/');

    expect(response.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on other error status (e.g. 404)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      url: 'https://example.com/',
      headers: { get: () => null },
      clone: () => ({ text: () => Promise.resolve('Not Found') }),
    } as Response);

    const err = await httpRequest('https://example.com/').catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('status=404');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 502 (Bad Gateway)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      url: 'https://example.com/',
      headers: { get: () => null },
      clone: () => ({ text: () => Promise.resolve('Bad Gateway') }),
    } as Response);

    const err = await httpRequest('https://example.com/', 2).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('status=502');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  describe('abortSignal', () => {
    it('throws immediately without calling fetch when abortSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const err = await httpRequest('https://example.com/', 2, controller.signal).catch((e) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('httpRequest aborted:');
      expect((err as Error).message).toContain('requestUrl=https://example.com/');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws with abort reason when abortSignal is already aborted with reason', async () => {
      const controller = new AbortController();
      const reason = new Error('Cancelled by caller');
      controller.abort(reason);

      const err = await httpRequest('https://example.com/', 2, controller.signal).catch((e) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('httpRequest aborted:');
      expect((err as Error).message).toContain('Cancelled by caller');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not retry when abortSignal aborts after first attempt fails', async () => {
      const controller = new AbortController();
      mockFetch.mockImplementation(() => {
        if (!controller.signal.aborted) {
          queueMicrotask(() => controller.abort());
        }
        return Promise.reject(new Error('network failure'));
      });

      const err = await httpRequest('https://example.com/', 2, controller.signal).catch((e) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('httpRequest failed:');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('passes combined signal to fetch when abortSignal is provided', async () => {
      const controller = new AbortController();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await httpRequest('https://example.com/', 5, controller.signal);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const init = mockFetch.mock.calls[0]![1] as RequestInit;
      expect(init.signal).toBeDefined();
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
