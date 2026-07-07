import type { Express } from 'express';

import adminBannerRoutes from './adminBanners.js';
import adminDealRoutes from './adminDeals.js';
import adminOrderRoutes from './adminOrders.js';
import adminProductRoutes from './adminProducts.js';
import adminUserRoutes from './adminUsers.js';
import authRoutes from './auth.js';
import bannerRoutes from './banners.js';
import brandRoutes from './brands.js';
import dealRoutes from './deals.js';
import deliveryOrderRoutes from './deliveryOrders.js';
import departmentRoutes from './departments.js';
import notificationRoutes from './notifications.js';
import orderRoutes from './orders.js';
import paymentRoutes from './payments.js';
import productRoutes from './products.js';
import storeRoutes from './stores.js';

export default function setRoutes(app: Express): void {
  app.use('/api/admin/banners', adminBannerRoutes);
  app.use('/api/admin/deals', adminDealRoutes);
  app.use('/api/banners', bannerRoutes);
  app.use('/api/deals', dealRoutes);
  app.use('/api/admin/orders', adminOrderRoutes);
  app.use('/api/admin/products', adminProductRoutes);
  app.use('/api/admin/users', adminUserRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/delivery/orders', deliveryOrderRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/stores', storeRoutes);
  app.use('/api/brands', brandRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/products', productRoutes);
}
