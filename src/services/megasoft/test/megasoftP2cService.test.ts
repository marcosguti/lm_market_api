import { describe, expect, it } from 'vitest';

import { isMegasoftP2cApproved } from '../megasoftP2cService.js';

describe('isMegasoftP2cApproved', () => {
  it('returns true when code is 00', () => {
    expect(
      isMegasoftP2cApproved({
        authId: null,
        code: '00',
        control: null,
        description: null,
        rawXml: '',
        reference: null,
        seqNum: null,
        status: 'A',
        voucher: '',
      }),
    ).toBe(true);
  });

  it('returns false for other codes', () => {
    expect(
      isMegasoftP2cApproved({
        authId: null,
        code: '01',
        control: null,
        description: null,
        rawXml: '',
        reference: null,
        seqNum: null,
        status: 'R',
        voucher: '',
      }),
    ).toBe(false);
    expect(isMegasoftP2cApproved({ code: undefined, rawXml: '' } as never)).toBe(false);
  });
});
