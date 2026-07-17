import type { BlogArticle, Prisma } from '@prisma/client';

import prisma from '../prisma.js';

export interface BlogArticleInput {
  active: boolean;
  content: string;
  title: string;
}

export interface BlogArticleUpdate {
  active?: boolean;
  content?: string;
  title?: string;
}

export interface PaginatedBlogArticles {
  data: BlogArticle[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function createBlogArticle(data: BlogArticleInput): Promise<BlogArticle> {
  return prisma.blogArticle.create({ data });
}

export async function deleteBlogArticle(id: string): Promise<void> {
  await prisma.blogArticle.delete({ where: { id } });
}

export async function getActiveBlogArticleById(id: string): Promise<BlogArticle | null> {
  return prisma.blogArticle.findFirst({
    where: { active: true, id },
  });
}

export async function getActiveBlogArticlesPaginated(
  page: number,
  pageSize: number,
): Promise<PaginatedBlogArticles> {
  const skip = (page - 1) * pageSize;
  const where: Prisma.BlogArticleWhereInput = { active: true };

  const [data, total] = await Promise.all([
    prisma.blogArticle.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      where,
    }),
    prisma.blogArticle.count({ where }),
  ]);

  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAllBlogArticles(): Promise<BlogArticle[]> {
  return prisma.blogArticle.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getBlogArticleById(id: string): Promise<BlogArticle | null> {
  return prisma.blogArticle.findUnique({ where: { id } });
}

export async function updateBlogArticle(id: string, data: BlogArticleUpdate): Promise<BlogArticle> {
  return prisma.blogArticle.update({ data, where: { id } });
}
