import { describe, expect, it } from 'vitest';

import { applyImageUrlsToOrderLines, type OrderLine } from '../orderService.js';

function line(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    code: '001',
    description: null,
    lineTotal: 10,
    name: 'Product',
    quantity: 1,
    unitPrice: 10,
    ...overrides,
  };
}

describe('applyImageUrlsToOrderLines', () => {
  it('keeps existing imageUrl on lines', () => {
    const lines = [line({ code: 'A', imageUrl: 'https://example.com/a.jpg' })];
    const result = applyImageUrlsToOrderLines(
      lines,
      new Map([['A', 'https://example.com/other.jpg']]),
    );
    expect(result[0].imageUrl).toBe('https://example.com/a.jpg');
  });

  it('fills missing imageUrl from lookup map', () => {
    const lines = [line({ code: 'B' }), line({ code: 'C', imageUrl: 'https://c.jpg' })];
    const result = applyImageUrlsToOrderLines(
      lines,
      new Map([
        ['B', 'https://example.com/b.jpg'],
        ['C', 'https://ignored.jpg'],
      ]),
    );
    expect(result[0].imageUrl).toBe('https://example.com/b.jpg');
    expect(result[1].imageUrl).toBe('https://c.jpg');
  });

  it('leaves line unchanged when code is not in map', () => {
    const lines = [line({ code: 'X' })];
    const result = applyImageUrlsToOrderLines(lines, new Map());
    expect(result[0].imageUrl).toBeUndefined();
  });
});
