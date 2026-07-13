import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpsRequest = vi.hoisted(() => vi.fn());
const isMegasoftConfigured = vi.hoisted(() => vi.fn(() => true));
const megasoftConfig = vi.hoisted(() => ({
  baseUrl: 'https://megasoft.test',
  debugLogs: false,
  password: 'pass',
  simulatePlatformDown: false,
  tlsInsecure: true,
  user: 'user',
}));

vi.mock('node:https', () => ({
  default: {
    request: (...args: unknown[]) => httpsRequest(...args),
  },
}));

vi.mock('../../../config/megasoft.js', () => ({
  isMegasoftConfigured: () => isMegasoftConfigured(),
  megasoftConfig,
}));

import { megasoftPost } from '../megasoftClient.js';
import { MegasoftPlatformError } from '../types.js';

function mockHttpsResponse(statusCode: number, body: string): void {
  httpsRequest.mockImplementation((_options, callback) => {
    const res = new EventEmitter() as EventEmitter & { statusCode: number };
    res.statusCode = statusCode;
    const req = new EventEmitter() as EventEmitter & {
      end: ReturnType<typeof vi.fn>;
      write: ReturnType<typeof vi.fn>;
    };
    req.write = vi.fn();
    req.end = vi.fn(() => {
      callback(res);
      res.emit('data', Buffer.from(body));
      res.emit('end');
    });
    return req;
  });
}

describe('megasoftClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMegasoftConfigured.mockReturnValue(true);
    megasoftConfig.simulatePlatformDown = false;
  });

  it('returns raw XML on successful upstream response', async () => {
    mockHttpsResponse(200, '<response><status>A</status></response>');

    const result = await megasoftPost('p2c', '<xml/>');

    expect(result.status).toBe(200);
    expect(result.rawXml).toContain('<status>A</status>');
  });

  it('throws MegasoftPlatformError on upstream 500', async () => {
    mockHttpsResponse(500, 'server error');

    await expect(megasoftPost('p2c', '<xml/>')).rejects.toBeInstanceOf(MegasoftPlatformError);
  });

  it('throws MegasoftPlatformError when simulatePlatformDown is enabled', async () => {
    megasoftConfig.simulatePlatformDown = true;

    await expect(megasoftPost('p2c', '<xml/>')).rejects.toBeInstanceOf(MegasoftPlatformError);
  });
});
