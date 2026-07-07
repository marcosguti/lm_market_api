import { describe, expect, it } from 'vitest';

import {
  buildXmlRequest,
  buildXmlRequestOrdered,
  escapeXml,
  formatVoucherFromXml,
  getXmlLineas,
  getXmlTag,
  normalizeVoucherText,
} from '../xml.js';

describe('escapeXml', () => {
  it('escapes special XML characters', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
  });
});

describe('buildXmlRequest', () => {
  it('wraps escaped fields in request root', () => {
    const xml = buildXmlRequest({ foo: 'bar&baz' });
    expect(xml).toBe('<request><foo>bar&amp;baz</foo></request>');
  });
});

describe('buildXmlRequestOrdered', () => {
  it('preserves field order', () => {
    const xml = buildXmlRequestOrdered([
      ['first', '1'],
      ['second', '2'],
    ]);
    expect(xml).toBe('<request><first>1</first><second>2</second></request>');
  });
});

describe('getXmlTag', () => {
  it('reads plain tags', () => {
    expect(getXmlTag('<codigo>00</codigo>', 'codigo')).toBe('00');
  });

  it('reads CDATA tags', () => {
    const xml = '<voucher><![CDATA[line one]]></voucher>';
    expect(getXmlTag(xml, 'voucher')).toBe('line one');
  });

  it('returns null for missing tags', () => {
    expect(getXmlTag('<request></request>', 'missing')).toBeNull();
  });
});

describe('getXmlLineas', () => {
  it('extracts linea elements and replaces underscores', () => {
    const xml = '<voucher><linea>foo_bar</linea><linea>  </linea><linea>baz</linea></voucher>';
    expect(getXmlLineas(xml)).toEqual(['foo bar', 'baz']);
  });
});

describe('normalizeVoucherText', () => {
  it('normalizes line endings and trims lines', () => {
    expect(normalizeVoucherText('  linea1\r\nlinea2  \n')).toBe('linea1\nlinea2');
  });
});

describe('formatVoucherFromXml', () => {
  it('formats voucher from linea blocks', () => {
    const xml = '<response><voucher><linea>Pago_OK</linea></voucher></response>';
    expect(formatVoucherFromXml(xml)).toBe('Pago OK');
  });

  it('returns empty string when voucher is missing', () => {
    expect(formatVoucherFromXml('<response></response>')).toBe('');
  });
});
