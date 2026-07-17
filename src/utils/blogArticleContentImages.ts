import { v4 as uuidv4 } from 'uuid';

import type { FileFromMulter } from '../types/index.js';

import { deleteFile, uploadBlogArticleContentImage } from '../libs/filesInDigitalOcean/index.js';

export const BLOG_ARTICLE_CONTENT_IMAGE_PREFIX = 'blog-article-content-image';

export async function deleteAllContentImages(html: string): Promise<void> {
  const srcs = extractImageSrcs(html);
  await Promise.all(srcs.map((src) => deleteFile(src)));
}

export async function deleteRemovedContentImages(oldHtml: string, newHtml: string): Promise<void> {
  const oldSrcs = extractImageSrcs(oldHtml);
  for (const oldSrc of oldSrcs) {
    if (!newHtml.includes(oldSrc)) {
      await deleteFile(oldSrc);
    }
  }
}

export function extractImageSrcs(html: string): string[] {
  return [...html.matchAll(/<img[^>]*src="([^"]*)"/g)].map((match) => match[1]);
}

export async function uploadAndReplaceContentImages(
  html: string,
  files: FileFromMulter[],
): Promise<string> {
  let newHtml = html;
  const contentImages = files.filter((file) =>
    file.originalname.includes(BLOG_ARTICLE_CONTENT_IMAGE_PREFIX),
  );

  for (const file of contentImages) {
    const ext = file.originalname.split('.').pop() ?? file.mimetype.split('/')[1] ?? 'jpg';
    const imageUrl = await uploadBlogArticleContentImage(file.buffer, file.mimetype, ext, uuidv4());
    newHtml = newHtml.replaceAll(file.originalname, imageUrl);
  }

  return newHtml;
}
