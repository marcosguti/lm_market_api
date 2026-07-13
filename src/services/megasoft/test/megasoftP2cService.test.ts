import { beforeEach, describe, expect, it, vi } from 'vitest';

const megasoftPost = vi.hoisted(() => vi.fn());

vi.mock('../../../config/megasoft.js', () => ({
  megasoftCertP2cPayload: {},
  megasoftConfig: {
    affiliationCode: 'AFF',
    certHardcoded: false,
    merchantBankCode: '0105',
    merchantCid: '',
    merchantPhone: '04141234567',
  },
}));

vi.mock('../megasoftClient.js', () => ({
  megasoftPost: (...args: unknown[]) => megasoftPost(...args),
}));

import {
  isMegasoftP2cApproved,
  megasoftQueryP2cStatus,
  verifyP2cPayment,
} from '../megasoftP2cService.js';
import { MegasoftPaymentRejectedError } from '../types.js';

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

describe('verifyP2cPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns approved process result', async () => {
    megasoftPost.mockResolvedValueOnce({ rawXml: '12345', status: 200 }).mockResolvedValueOnce({
      rawXml: '<response><codigo>00</codigo><estado>A</estado><control>12345</control></response>',
      status: 200,
    });

    const result = await verifyP2cPayment({
      amount: 100,
      clientBankCode: '0105',
      clientPhone: '04141234567',
      invoice: 'INV1',
      nationalId: 'V12345678',
      reference: 'REF1',
    });

    expect(result.code).toBe('00');
    expect(megasoftPost).toHaveBeenCalledTimes(2);
  });

  it('falls back to query status when process is not approved', async () => {
    megasoftPost
      .mockResolvedValueOnce({ rawXml: '999', status: 200 })
      .mockResolvedValueOnce({
        rawXml: '<response><codigo>01</codigo><estado>R</estado></response>',
        status: 200,
      })
      .mockResolvedValueOnce({
        rawXml: '<response><codigo>00</codigo><estado>A</estado><control>999</control></response>',
        status: 200,
      });

    const result = await verifyP2cPayment({
      amount: 50,
      clientBankCode: '0105',
      clientPhone: '04141234567',
      invoice: 'INV2',
      nationalId: 'V12345678',
      reference: 'REF2',
    });

    expect(result.code).toBe('00');
    expect(megasoftPost).toHaveBeenCalledTimes(3);
  });

  it('throws MegasoftPaymentRejectedError when process and query fail', async () => {
    megasoftPost
      .mockResolvedValueOnce({ rawXml: '888', status: 200 })
      .mockResolvedValueOnce({
        rawXml: '<response><codigo>01</codigo><descripcion>Rechazado</descripcion></response>',
        status: 200,
      })
      .mockResolvedValueOnce({
        rawXml: '<response><codigo>01</codigo><descripcion>Rechazado</descripcion></response>',
        status: 200,
      });

    await expect(
      verifyP2cPayment({
        amount: 50,
        clientBankCode: '0105',
        clientPhone: '04141234567',
        invoice: 'INV3',
        nationalId: 'V12345678',
        reference: 'REF3',
      }),
    ).rejects.toBeInstanceOf(MegasoftPaymentRejectedError);
  });
});

describe('megasoftQueryP2cStatus', () => {
  it('parses query status response', async () => {
    megasoftPost.mockResolvedValue({
      rawXml: '<response><codigo>00</codigo><estado>A</estado><control>777</control></response>',
      status: 200,
    });

    const result = await megasoftQueryP2cStatus('777');
    expect(result.code).toBe('00');
    expect(megasoftPost).toHaveBeenCalledWith('v2-querystatus', expect.any(String));
  });
});
