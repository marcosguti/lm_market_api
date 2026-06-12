/* eslint-disable no-console */
import path from 'path';
import { fileURLToPath } from 'url';

import '../loadEnv.js';
import { buildPublicObjectUrl, listImageObjectKeys } from '../libs/filesInDigitalOcean/index.js';
import prisma from '../prisma.js';
import { findProductByCode, updateProductById } from '../queries/product.js';

const IMAGE_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.webp']);

interface Summary {
  errors: number;
  skippedNotProduct: number;
  skippedUnsupported: number;
  totalImages: number;
  updated: number;
}

export async function runSyncDigitalOceanImagesWithProducts(): Promise<Summary> {
  assertDigitalOceanEnv();

  const keys = await listImageObjectKeys();
  const summary: Summary = {
    errors: 0,
    skippedNotProduct: 0,
    skippedUnsupported: 0,
    totalImages: 0,
    updated: 0,
  };

  console.log(`Found ${keys.length} object(s) under images/ in DigitalOcean`);

  for (const key of keys) {
    const ext = path.extname(key).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      summary.skippedUnsupported += 1;
      continue;
    }

    summary.totalImages += 1;
    const code = path.basename(key, ext);

    try {
      const product = await findProductByCode(code);
      if (!product) {
        console.log(`[skip] no product for code "${code}" (${key})`);
        summary.skippedNotProduct += 1;
        continue;
      }

      const imageUrl = buildPublicObjectUrl(key);
      await updateProductById(product.id, { imageUrl });
      console.log(`[ok] ${product.code} -> ${imageUrl}`);
      summary.updated += 1;
    } catch (err) {
      summary.errors += 1;
      console.error(`[error] ${key}:`, err);
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
  const missing = required.filter((envKey) => !process.env[envKey]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

async function main(): Promise<void> {
  try {
    const summary = await runSyncDigitalOceanImagesWithProducts();
    console.log('--- summary ---');
    console.log('total images:', summary.totalImages);
    console.log('updated:', summary.updated);
    console.log('skipped (product not found):', summary.skippedNotProduct);
    console.log('skipped (unsupported extension):', summary.skippedUnsupported);
    console.log('errors:', summary.errors);
    if (summary.errors > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
