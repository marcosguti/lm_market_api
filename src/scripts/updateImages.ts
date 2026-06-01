/* eslint-disable no-console */
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import '../loadEnv.js';
import { uploadBuffer } from '../libs/filesInDigitalOcean/index.js';
import prisma from '../prisma.js';
import { findProductByCode, updateProductById } from '../queries/product.js';

const IMAGE_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.webp']);
const DEFAULT_IMAGES_DIR = 'product_images';

interface Summary {
  errors: number;
  skippedHasImage: number;
  skippedNotProduct: number;
  skippedUnsupported: number;
  totalFiles: number;
  updated: number;
}

export async function runUpdateImages(imagesDirArg?: string): Promise<Summary> {
  assertDigitalOceanEnv();
  const imagesDir = await resolveImagesDir(imagesDirArg);
  const files = await listImageFiles(imagesDir);

  const summary: Summary = {
    errors: 0,
    skippedHasImage: 0,
    skippedNotProduct: 0,
    skippedUnsupported: 0,
    totalFiles: files.length,
    updated: 0,
  };

  console.log(`Reading ${files.length} image(s) from ${imagesDir}`);

  for (const filePath of files) {
    try {
      await processImageFile(filePath, summary);
    } catch (err) {
      summary.errors += 1;
      console.error(`[error] ${path.basename(filePath)}:`, err);
    }
  }

  return summary;
}

function assertDigitalOceanEnv(): void {
  const required = [
    'DIGITAL_OCEAN_BUCKET',
    'DIGITAL_OCEAN_SPACES_KEY',
    'DIGITAL_OCEAN_SPACES_SECRET',
  ] as const;
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

function extensionWithoutDot(ext: string): string {
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

async function listImageFiles(imagesDir: string): Promise<string[]> {
  const entries = await readdir(imagesDir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(imagesDir, entry);
    const entryStat = await stat(fullPath);
    if (!entryStat.isFile()) continue;
    const ext = path.extname(entry).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

async function main(): Promise<void> {
  const imagesDirArg = process.argv[2];
  try {
    const summary = await runUpdateImages(imagesDirArg);
    console.log('--- summary ---');
    console.log('total files:', summary.totalFiles);
    console.log('updated:', summary.updated);
    console.log('skipped (product not found):', summary.skippedNotProduct);
    console.log('skipped (already has image):', summary.skippedHasImage);
    console.log('skipped (unsupported):', summary.skippedUnsupported);
    console.log('errors:', summary.errors);
    if (summary.errors > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

function mimeForExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      throw new Error(`Unsupported extension: ${ext}`);
  }
}

async function processImageFile(filePath: string, summary: Summary): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) {
    summary.skippedUnsupported += 1;
    return;
  }

  const code = path.basename(filePath, ext);
  const product = await findProductByCode(code);
  if (!product) {
    console.log(`[skip] no product for code "${code}" (${path.basename(filePath)})`);
    summary.skippedNotProduct += 1;
    return;
  }

  if (product.imageUrl?.trim()) {
    console.log(`[skip] product ${code} already has imageUrl`);
    summary.skippedHasImage += 1;
    return;
  }

  const buffer = await readFile(filePath);
  const imageUrl = await uploadBuffer({
    buffer,
    contentType: mimeForExtension(ext),
    extension: extensionWithoutDot(ext),
    fileName: product.code,
  });

  await updateProductById(product.id, { imageUrl });
  console.log(`[ok] ${product.code} -> ${imageUrl}`);
  summary.updated += 1;
}

async function resolveImagesDir(arg?: string): Promise<string> {
  const dirName = arg?.trim() || DEFAULT_IMAGES_DIR;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const imagesDir = path.resolve(root, dirName);
  const dirStat = await stat(imagesDir).catch(() => null);
  if (!dirStat?.isDirectory()) {
    throw new Error(
      `Images directory not found: ${imagesDir}. Create it with: mkdir -p ${dirName}`,
    );
  }
  return imagesDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
