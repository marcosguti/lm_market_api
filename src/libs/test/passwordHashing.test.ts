import { describe, expect, it } from 'vitest';

import { comparePassword, createHash } from '../passwordHashing.js';

describe('passwordHashing', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await createHash('secret123');
    expect(hash).not.toBe('secret123');
    expect(await comparePassword('secret123', hash)).toBe(true);
    expect(await comparePassword('wrong', hash)).toBe(false);
  });
});
