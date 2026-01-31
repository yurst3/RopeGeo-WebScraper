/**
 * Fetch ropewiki.com with headers that avoid 403 (User-Agent and Accept).
 * Logs request/response details on non-OK so we can see who returned the error (e.g. ropewiki vs proxy/DNS).
 */
const ROPEWIKI_FETCH_OPTIONS: RequestInit = {
  headers: {
    'User-Agent':
      'RopewikiScraper/1.0 (https://github.com/your-org/WebScraper; +contact)',
    Accept: 'application/json, text/html, */*',
    'Accept-Language': 'en-US,en;q=0.9',
  },
};

const fetchRopewiki = async (url: string | URL, init?: RequestInit): Promise<Response> => {
  const requestUrl = typeof url === 'string' ? url : url.toString();
  const response = await fetch(url, {
    ...ROPEWIKI_FETCH_OPTIONS,
    ...init,
    headers: {
      ...ROPEWIKI_FETCH_OPTIONS.headers,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const finalUrl = response.url;
    const server = response.headers.get('server') ?? response.headers.get('x-powered-by') ?? '(none)';
    console.error(
      `fetchRopewiki non-OK: status=${response.status} statusText=${response.statusText} ` +
        `requestUrl=${requestUrl} finalUrl=${finalUrl} server=${server}`,
    );
  }
  return response;
};

export default fetchRopewiki;
