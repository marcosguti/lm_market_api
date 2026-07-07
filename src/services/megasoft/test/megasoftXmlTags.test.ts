import { describe, expect, it } from 'vitest';

import {
  buildP2cProcessXml,
  buildP2cQueryStatusXml,
  buildPreRegisterXml,
  parseMegasoftResponseXml,
  redactMegasoftXml,
} from '../megasoftXmlTags.js';

describe('buildPreRegisterXml', () => {
  it('includes affiliation code', () => {
    const xml = buildPreRegisterXml('AFF123');
    expect(xml).toContain('<cod_afiliacion>AFF123</cod_afiliacion>');
  });
});

describe('buildP2cQueryStatusXml', () => {
  it('includes control and transaction type', () => {
    const xml = buildP2cQueryStatusXml('AFF', '999');
    expect(xml).toContain('<control>999</control>');
    expect(xml).toContain('<tipotrx>P2C</tipotrx>');
  });
});

describe('buildP2cProcessXml', () => {
  const base = {
    affiliationCode: 'AFF',
    amount: 10.5,
    clientBankCode: '0105',
    clientPhone: '04141234567',
    control: '123',
    invoice: 'INV1',
    merchantBankCode: '0138',
    merchantPhone: '04121234567',
    nationalId: 'V12345678',
    reference: 'REF1',
  };

  it('uses cert hardcoded field order when enabled', () => {
    const xml = buildP2cProcessXml(base, true);
    expect(xml.indexOf('<cod_afiliacion>')).toBeLessThan(xml.indexOf('<amount>'));
    expect(xml).not.toContain('<cid>');
  });

  it('includes national id and reference in production mode', () => {
    const xml = buildP2cProcessXml(base, false);
    expect(xml).toContain('<cid>V12345678</cid>');
    expect(xml).toContain('<referencia>REF1</referencia>');
    expect(xml).toContain('<amount>10.50</amount>');
  });
});

describe('parseMegasoftResponseXml', () => {
  it('parses approved response fields', () => {
    const rawXml =
      '<response><codigo>00</codigo><estado>A</estado><authid>ABC</authid><control>123</control></response>';
    const result = parseMegasoftResponseXml(rawXml, 'fallback');
    expect(result.code).toBe('00');
    expect(result.status).toBe('A');
    expect(result.authId).toBe('ABC');
    expect(result.control).toBe('123');
  });
});

describe('redactMegasoftXml', () => {
  it('redacts sensitive tags', () => {
    const xml =
      '<request><cid>V123</cid><telefonoCliente>0414</telefonoCliente><telefonoComercio>0412</telefonoComercio></request>';
    const redacted = redactMegasoftXml(xml);
    expect(redacted).toContain('<cid>***</cid>');
    expect(redacted).toContain('<telefonoCliente>***</telefonoCliente>');
    expect(redacted).not.toContain('V123');
  });
});
