import { vi } from 'vitest';

vi.mock('../../../realtime/socket.js', () => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
  emitDeliveryOrderCancelled: vi.fn(),
  emitKitchenNewPaid: vi.fn(),
  emitKitchenOrderUpdated: vi.fn(),
  emitOrderCancelled: vi.fn(),
  emitOrderUpdated: vi.fn(),
  emitUserNotification: vi.fn(),
  getSocket: vi.fn(),
}));

vi.mock('../../../prisma.js', () => ({
  default: {
    exchangeRate: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    order: {
      findUnique: vi.fn().mockResolvedValue({ id: 'o1', totalAmount: 100 }),
    },
    pushDevice: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      upsert: vi.fn().mockResolvedValue({ id: 'pd1' }),
    },
    token: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock('../../../services/bcvExchangeRate.js', () => ({
  getUsdVesRate: vi.fn().mockResolvedValue(600),
  getUsdVesRateInfo: vi.fn().mockResolvedValue({
    fetchedAt: new Date('2026-07-15T12:00:00.000Z'),
    rate: 600,
    source: 'fallback',
  }),
  syncBcvExchangeRate: vi.fn(),
}));

vi.mock('../../../libs/passwordHashing.js', () => ({
  comparePassword: vi.fn().mockResolvedValue(true),
  createHash: vi.fn().mockResolvedValue('new-hash'),
}));

vi.mock('../../../libs/filesInDigitalOcean/index.js', () => ({
  deleteFile: vi.fn().mockResolvedValue({}),
  uploadBannerImage: vi.fn().mockResolvedValue('https://cdn.example/banner.jpg'),
  uploadBlogArticleContentImage: vi.fn().mockResolvedValue('https://cdn.example/blog.jpg'),
  uploadDealImage: vi.fn().mockResolvedValue('https://cdn.example/deal.jpg'),
  uploadDeliveryProof: vi.fn().mockResolvedValue('https://cdn.example/delivery.jpg'),
  uploadFile: vi.fn().mockResolvedValue('https://cdn.example/file.jpg'),
  uploadPaymentScreenshot: vi.fn().mockResolvedValue('https://cdn.example/screenshot.jpg'),
}));

vi.mock('../../../services/orderDeliveryTrackingService.js', () => ({
  endDeliveryTrackingAndNotify: vi.fn().mockResolvedValue(undefined),
}));
