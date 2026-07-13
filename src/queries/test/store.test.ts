import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  store: {
    findMany: vi.fn(),
  },
}));

vi.mock('../../prisma.js', () => ({ default: prismaMock }));

import { findStores } from '../store.js';

describe('store queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findStores returns ordered store list', async () => {
    prismaMock.store.findMany.mockResolvedValue([{ id: 's1', name: 'Main' }]);
    const result = await findStores();
    expect(result).toHaveLength(1);
    expect(prismaMock.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } }),
    );
  });
});
