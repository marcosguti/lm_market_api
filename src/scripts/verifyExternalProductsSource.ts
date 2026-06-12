import '../loadEnv.js';
import {
  buildExternalProductsRequest,
  extractProductRows,
} from '../services/syncExternalProducts.js';

const page = Number(process.env.VERIFY_PAGE ?? '1');
const branch = Number(process.env.VERIFY_BRANCH ?? '1');
const pageSizeVerify = Number(process.env.VERIFY_PAGE_SIZE ?? '100');

async function main(): Promise<void> {
  const { headers, url } = buildExternalProductsRequest(page, branch, pageSizeVerify);
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
  const body = (await res.json()) as Record<string, unknown>;
  const rows = extractProductRows(body);
  // eslint-disable-next-line no-console -- CLI output
  console.log(
    'totalElements:',
    body.totalElements,
    'totalPages:',
    body.totalPages,
    'pageNumber:',
    body.pageNumber ?? body.currentPage,
    'data.length:',
    Array.isArray(body.data) ? body.data.length : 0,
    'results.length:',
    Array.isArray(body.results) ? body.results.length : 0,
    'parsedRows:',
    rows.length,
  );
  if (rows[0]) {
    // eslint-disable-next-line no-console -- CLI output
    console.log('sample row:', rows[0]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
