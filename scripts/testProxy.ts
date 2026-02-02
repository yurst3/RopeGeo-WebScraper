/**
 * Test script for proxy server functionality.
 * Sets env so httpRequest uses the proxy, then calls getRegions and logs results.
 *
 * Run: npm run test:proxy
 */

import type { RopewikiRegion } from '../src/ropewiki/types/region';
import getRegions from '../src/ropewiki/http/getRegions';

async function main(): Promise<void> {
  process.env.AWS_LAMBDA_FUNCTION_NAME =
    process.env.AWS_LAMBDA_FUNCTION_NAME ?? 'test-proxy';
  process.env.DEV_ENVIRONMENT = process.env.DEV_ENVIRONMENT ?? 'dev';

  if (!process.env.PROXY_URL) throw new Error('Must set PROXY_URL env variable');

  console.log('Proxy config:', {
    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
    DEV_ENVIRONMENT: process.env.DEV_ENVIRONMENT,
    PROXY_URL: process.env.PROXY_URL,
  });
  console.log('Calling getRegions() via proxy...\n');

  const regions = await getRegions();

  console.log('Regions count:', regions.length);
  console.log(
    'Regions:',
    JSON.stringify(
      regions.map((r: RopewikiRegion) => ({
        name: r.name,
        parentRegion: r.parentRegion,
        pageCount: r.pageCount,
      })),
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
