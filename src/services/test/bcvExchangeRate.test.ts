import { describe, expect, it, vi } from 'vitest';

vi.mock('../../prisma.js', () => ({
  default: {
    exchangeRate: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    },
  },
}));

import {
  extractBcvUsdRateFromHtml,
  extractBdvUsdRateFromJson,
  extractDolarApiUsdRateFromJson,
  getUsdVesRate,
  parseBcvDecimal,
} from '../bcvExchangeRate.js';

describe('parseBcvDecimal', () => {
  it('parses Venezuelan decimal with comma separator', () => {
    expect(parseBcvDecimal('725,76200000')).toBe(725.762);
  });

  it('strips thousand separators before comma', () => {
    expect(parseBcvDecimal('1.234,56')).toBe(1234.56);
  });

  it('rejects non-positive or invalid values', () => {
    expect(() => parseBcvDecimal('0,5')).toThrow();
    expect(() => parseBcvDecimal('abc')).toThrow();
  });
});

describe('extractBcvUsdRateFromHtml', () => {
  it('extracts rate from #dolar strong', () => {
    const html = `
      <div id="dolar" class="col-sm-12">
        <div class="field-content">
          <div class="row recuadrotsmc">
            <div class="col-sm-6 col-xs-6 centrado"><span>USD</span></div>
            <div class="col-sm-6 col-xs-6 centrado textp"><strong>725,76200000</strong></div>
          </div>
        </div>
      </div>
    `;
    expect(extractBcvUsdRateFromHtml(html)).toBe(725.762);
  });

  it('extracts rate when strong has class attributes (live BCV markup)', () => {
    const html = `
      <div id="dolar" class="col-sm-12 col-xs-12 ">
        <div class="field-content">
          <div class="row recuadrotsmc">
            <div class="col-sm-6 col-xs-6">
              <span> USD</span>
            </div>
            <div class="col-sm-6 col-xs-6 centrado textp">
              <strong class="strong-tb">725,74700000</strong>
            </div>
          </div>
        </div>
      </div>
    `;
    expect(extractBcvUsdRateFromHtml(html)).toBe(725.747);
  });

  it('throws when #dolar strong is missing', () => {
    expect(() => extractBcvUsdRateFromHtml('<div id="euro"><strong>1,2</strong></div>')).toThrow(
      /not found/,
    );
  });
});

describe('extractBdvUsdRateFromJson', () => {
  it('reads mesacambio.bcv.dolares', () => {
    expect(
      extractBdvUsdRateFromJson({
        idi: '3,54813902',
        menudeo: { compra: { dolares: '725,7470', euros: '830,6319' } },
        mesacambio: {
          bcv: { dolares: '725,7470', euros: '830,6320' },
          bdv: { dolares: '725,7470', euros: '830,6320' },
        },
        petro: { compra: '1.446,25000000 Bs', venta: '1.446,25000000 Bs' },
      }),
    ).toBe(725.747);
  });

  it('throws when path is missing', () => {
    expect(() => extractBdvUsdRateFromJson({ mesacambio: {} })).toThrow(/not found/);
  });
});

describe('extractDolarApiUsdRateFromJson', () => {
  it('reads promedio', () => {
    expect(
      extractDolarApiUsdRateFromJson({
        compra: null,
        fechaActualizacion: '2026-07-15T00:00:00-04:00',
        fuente: 'oficial',
        moneda: 'USD',
        nombre: 'Dólar',
        promedio: 725.747,
        venta: null,
      }),
    ).toBe(725.747);
  });

  it('rejects missing or invalid promedio', () => {
    expect(() => extractDolarApiUsdRateFromJson({ promedio: null })).toThrow(/invalid/);
    expect(() => extractDolarApiUsdRateFromJson({})).toThrow(/invalid/);
  });
});

describe('getUsdVesRate fallback', () => {
  it('falls back to USD_PRICE env when no DB row', async () => {
    vi.stubEnv('USD_PRICE', '700');
    await expect(getUsdVesRate()).resolves.toBe(700);
    vi.unstubAllEnvs();
  });
});
