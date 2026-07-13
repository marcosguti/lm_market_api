import { vi } from 'vitest';

vi.mock('../../../realtime/socket.js', () => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
  emitDeliveryOrderCancelled: vi.fn(),
  emitKitchenNewPaid: vi.fn(),
  emitOrderCancelled: vi.fn(),
  emitOrderUpdated: vi.fn(),
  emitUserNotification: vi.fn(),
  getSocket: vi.fn(),
}));

vi.mock('../../../prisma.js', () => ({
  default: {
    order: {
      findUnique: vi.fn().mockResolvedValue({ id: 'o1', totalAmount: 100 }),
    },
    token: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock('../../../libs/passwordHashing.js', () => ({
  comparePassword: vi.fn().mockResolvedValue(true),
  createHash: vi.fn().mockResolvedValue('new-hash'),
}));

vi.mock('../../../libs/filesInDigitalOcean/index.js', () => ({
  uploadBannerImage: vi.fn().mockResolvedValue('https://cdn.example/banner.jpg'),
  uploadDealImage: vi.fn().mockResolvedValue('https://cdn.example/deal.jpg'),
  uploadFile: vi.fn().mockResolvedValue('https://cdn.example/file.jpg'),
  uploadPaymentScreenshot: vi.fn().mockResolvedValue('https://cdn.example/screenshot.jpg'),
}));
