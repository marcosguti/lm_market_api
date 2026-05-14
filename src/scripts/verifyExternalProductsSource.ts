import '../loadEnv.js';
import { buildExternalProductsRequest } from '../services/syncExternalProducts.js';

const page = Number(process.env.VERIFY_PAGE ?? '1');
const pageSizeVerify = 100;

async function main(): Promise<void> {
  const { headers, url } = buildExternalProductsRequest(page, pageSizeVerify);
  // eslint-disable-next-line no-console -- CLI output
  console.log('URL:', url);
  const authHeader = Object.keys(headers).find((k) => k.toLowerCase() !== 'accept');
  // eslint-disable-next-line no-console -- CLI output
  console.log('Auth header name:', authHeader ?? '(none)');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  const res = await fetch(url, { headers, signal: controller.signal });
  clearTimeout(timeoutId);
  // eslint-disable-next-line no-console -- CLI output
  console.log('HTTP status:', res.status, res.statusText);
  const body = (await res.json()) as {
    currentPage?: number;
    results?: unknown[];
    totalElements?: number;
    totalPages?: number;
  };
  // eslint-disable-next-line no-console -- CLI output
  console.log(
    'totalElements:',
    body.totalElements,
    'totalPages:',
    body.totalPages,
    'currentPage:',
    body.currentPage,
    'results.length:',
    Array.isArray(body.results) ? body.results.length : 0,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
