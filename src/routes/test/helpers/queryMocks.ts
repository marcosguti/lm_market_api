import { vi } from 'vitest';

import { authMocks } from './authHelpers.js';

const userQueryMocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByNumberId: vi.fn(),
  findUserByPhone: vi.fn(),
  listUsersPaginated: vi.fn(),
  updateUser: vi.fn(),
  updateUserPassword: vi.fn(),
}));

const productQueryMocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  deactivateProductById: vi.fn(),
  findAdminProductsPaginated: vi.fn(),
  findProductByCode: vi.fn(),
  findProductById: vi.fn(),
  findProductsPaginated: vi.fn(),
  updateProductById: vi.fn(),
  upsertProductStores: vi.fn(),
}));

const bannerServiceMocks = vi.hoisted(() => ({
  createBanner: vi.fn(),
  deleteBanner: vi.fn(),
  getActiveBanners: vi.fn(),
  getAllBanners: vi.fn(),
  getBannerById: vi.fn(),
  updateBanner: vi.fn(),
}));

const dealServiceMocks = vi.hoisted(() => ({
  createDeal: vi.fn(),
  deleteDeal: vi.fn(),
  getActiveDeals: vi.fn(),
  getAllDeals: vi.fn(),
  getDealById: vi.fn(),
  updateDeal: vi.fn(),
}));

const blogArticleServiceMocks = vi.hoisted(() => ({
  createBlogArticle: vi.fn(),
  deleteBlogArticle: vi.fn(),
  getActiveBlogArticleById: vi.fn(),
  getActiveBlogArticlesPaginated: vi.fn(),
  getAllBlogArticles: vi.fn(),
  getBlogArticleById: vi.fn(),
  updateBlogArticle: vi.fn(),
}));

const catalogQueryMocks = vi.hoisted(() => ({
  findAllBrandsForCatalog: vi.fn(),
  findAllDepartmentsForCatalog: vi.fn(),
  findOrCreateBrand: vi.fn(),
  findOrCreateDepartment: vi.fn(),
  findStores: vi.fn(),
}));

vi.mock('../../../queries/user.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../queries/user.js')>();
  return {
    ...actual,
    createUser: userQueryMocks.createUser,
    deleteUserById: userQueryMocks.deleteUserById,
    findUserByEmail: userQueryMocks.findUserByEmail,
    findUserById: authMocks.findUserById,
    findUserByNumberId: userQueryMocks.findUserByNumberId,
    findUserByPhone: userQueryMocks.findUserByPhone,
    listUsersPaginated: userQueryMocks.listUsersPaginated,
    updateUser: userQueryMocks.updateUser,
    updateUserPassword: userQueryMocks.updateUserPassword,
  };
});

vi.mock('../../../queries/product.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../queries/product.js')>();
  return {
    ...actual,
    createProduct: productQueryMocks.createProduct,
    deactivateProductById: productQueryMocks.deactivateProductById,
    findAdminProductsPaginated: productQueryMocks.findAdminProductsPaginated,
    findProductByCode: productQueryMocks.findProductByCode,
    findProductById: productQueryMocks.findProductById,
    findProductsPaginated: productQueryMocks.findProductsPaginated,
    updateProductById: productQueryMocks.updateProductById,
    upsertProductStores: productQueryMocks.upsertProductStores,
  };
});

vi.mock('../../../services/bannerService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/bannerService.js')>();
  return {
    ...actual,
    createBanner: bannerServiceMocks.createBanner,
    deleteBanner: bannerServiceMocks.deleteBanner,
    getActiveBanners: bannerServiceMocks.getActiveBanners,
    getAllBanners: bannerServiceMocks.getAllBanners,
    getBannerById: bannerServiceMocks.getBannerById,
    updateBanner: bannerServiceMocks.updateBanner,
  };
});

vi.mock('../../../services/blogArticleService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/blogArticleService.js')>();
  return {
    ...actual,
    createBlogArticle: blogArticleServiceMocks.createBlogArticle,
    deleteBlogArticle: blogArticleServiceMocks.deleteBlogArticle,
    getActiveBlogArticleById: blogArticleServiceMocks.getActiveBlogArticleById,
    getActiveBlogArticlesPaginated: blogArticleServiceMocks.getActiveBlogArticlesPaginated,
    getAllBlogArticles: blogArticleServiceMocks.getAllBlogArticles,
    getBlogArticleById: blogArticleServiceMocks.getBlogArticleById,
    updateBlogArticle: blogArticleServiceMocks.updateBlogArticle,
  };
});

vi.mock('../../../services/dealService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/dealService.js')>();
  return {
    ...actual,
    createDeal: dealServiceMocks.createDeal,
    deleteDeal: dealServiceMocks.deleteDeal,
    getActiveDeals: dealServiceMocks.getActiveDeals,
    getAllDeals: dealServiceMocks.getAllDeals,
    getDealById: dealServiceMocks.getDealById,
    updateDeal: dealServiceMocks.updateDeal,
  };
});

vi.mock('../../../queries/brandDepartment.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../queries/brandDepartment.js')>();
  return {
    ...actual,
    findAllBrandsForCatalog: catalogQueryMocks.findAllBrandsForCatalog,
    findAllDepartmentsForCatalog: catalogQueryMocks.findAllDepartmentsForCatalog,
    findOrCreateBrand: catalogQueryMocks.findOrCreateBrand,
    findOrCreateDepartment: catalogQueryMocks.findOrCreateDepartment,
  };
});

vi.mock('../../../queries/store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../queries/store.js')>();
  return {
    ...actual,
    findStores: catalogQueryMocks.findStores,
  };
});

export function resetQueryMocks(): void {
  userQueryMocks.listUsersPaginated.mockResolvedValue({ data: [], total: 0 });
  userQueryMocks.deleteUserById.mockResolvedValue(undefined);
  userQueryMocks.findUserByEmail.mockResolvedValue(null);
  userQueryMocks.findUserByNumberId.mockResolvedValue(null);
  userQueryMocks.findUserByPhone.mockResolvedValue(null);
  userQueryMocks.createUser.mockResolvedValue({
    id: 'new-u',
    type: 'client',
    email: 'new@test.com',
    firstName: 'New',
    lastName: 'User',
    numberId: '123',
    numberIdType: 'V',
    password: 'hash',
    address: null,
    phone: null,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  userQueryMocks.updateUser.mockResolvedValue({
    id: 'u1',
    type: 'client',
    email: 'client@test.com',
    firstName: 'Updated',
    lastName: 'User',
    numberId: 'V12345678',
    numberIdType: 'V',
    password: 'hash',
    address: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  userQueryMocks.updateUserPassword.mockResolvedValue(undefined);
  productQueryMocks.findProductByCode.mockResolvedValue(null);
  productQueryMocks.findProductById.mockResolvedValue(null);
  productQueryMocks.createProduct.mockResolvedValue({
    id: 'p1',
    code: 'X',
    name: 'Product',
    active: true,
    brand: 'B',
    brandId: 'b1',
    department: 'D',
    departmentId: 'd1',
    description: null,
    imageUrl: null,
    productStores: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  productQueryMocks.updateProductById.mockResolvedValue({
    id: 'p1',
    code: 'X',
    name: 'Updated',
    active: true,
    brand: 'B',
    brandId: 'b1',
    department: 'D',
    departmentId: 'd1',
    description: null,
    imageUrl: null,
    productStores: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  productQueryMocks.deactivateProductById.mockResolvedValue({
    id: 'p1',
    code: 'X',
    name: 'Product',
    active: false,
    brand: 'B',
    brandId: 'b1',
    department: 'D',
    departmentId: 'd1',
    description: null,
    imageUrl: null,
    productStores: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  bannerServiceMocks.getBannerById.mockResolvedValue({ id: 'b1', active: true, imageUrl: 'x' });
  bannerServiceMocks.getActiveBanners.mockResolvedValue([]);
  bannerServiceMocks.getAllBanners.mockResolvedValue([]);
  bannerServiceMocks.createBanner.mockResolvedValue({ id: 'b1', active: true, imageUrl: 'x' });
  bannerServiceMocks.updateBanner.mockResolvedValue({ id: 'b1', active: true, imageUrl: 'x' });
  bannerServiceMocks.deleteBanner.mockResolvedValue(undefined);
  dealServiceMocks.getDealById.mockResolvedValue({
    id: 'd1',
    imageUrl: 'x',
    startDate: new Date(),
    endDate: new Date(),
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  dealServiceMocks.getActiveDeals.mockResolvedValue([]);
  dealServiceMocks.getAllDeals.mockResolvedValue([]);
  dealServiceMocks.createDeal.mockResolvedValue({ id: 'd1' });
  dealServiceMocks.updateDeal.mockResolvedValue({ id: 'd1' });
  dealServiceMocks.deleteDeal.mockResolvedValue(undefined);
  blogArticleServiceMocks.getBlogArticleById.mockResolvedValue({
    id: 'blog-1',
    title: 'Post',
    content: '<p>Hola</p>',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  blogArticleServiceMocks.getActiveBlogArticleById.mockResolvedValue({
    id: 'blog-1',
    title: 'Post',
    content: '<p>Hola</p>',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  blogArticleServiceMocks.getAllBlogArticles.mockResolvedValue([]);
  blogArticleServiceMocks.getActiveBlogArticlesPaginated.mockResolvedValue({
    data: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  blogArticleServiceMocks.createBlogArticle.mockResolvedValue({
    id: 'blog-1',
    title: 'Post',
    content: '<p>Hola</p>',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  blogArticleServiceMocks.updateBlogArticle.mockResolvedValue({
    id: 'blog-1',
    title: 'Post',
    content: '<p>Hola</p>',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  blogArticleServiceMocks.deleteBlogArticle.mockResolvedValue(undefined);
  productQueryMocks.findAdminProductsPaginated.mockResolvedValue({
    data: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  productQueryMocks.findProductsPaginated.mockResolvedValue({
    data: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  productQueryMocks.upsertProductStores.mockResolvedValue(undefined);
  catalogQueryMocks.findAllBrandsForCatalog.mockResolvedValue([]);
  catalogQueryMocks.findAllDepartmentsForCatalog.mockResolvedValue([]);
  catalogQueryMocks.findOrCreateBrand.mockResolvedValue({ id: 'b-new', name: 'NewBrand' });
  catalogQueryMocks.findOrCreateDepartment.mockResolvedValue({ id: 'd-new', name: 'Dept' });
  catalogQueryMocks.findStores.mockResolvedValue([]);
}

export function getUserQueryMocks() {
  return userQueryMocks;
}

export function getProductQueryMocks() {
  return productQueryMocks;
}

export function getBannerServiceMocks() {
  return bannerServiceMocks;
}

export function getDealServiceMocks() {
  return dealServiceMocks;
}

export function getBlogArticleServiceMocks() {
  return blogArticleServiceMocks;
}

export { bannerServiceMocks, blogArticleServiceMocks, catalogQueryMocks, dealServiceMocks };
