ALTER TABLE "Blog" RENAME TO "BlogArticle";

ALTER INDEX "Blog_active_createdAt_idx" RENAME TO "BlogArticle_active_createdAt_idx";

ALTER TABLE "BlogArticle" RENAME CONSTRAINT "Blog_pkey" TO "BlogArticle_pkey";
