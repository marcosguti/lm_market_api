/* eslint-disable no-console */
import { writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import '../loadEnv.js';
import prisma from '../prisma.js';

const DEFAULT_OUTPUT_FILE = 'products-without-image.txt';

export async function exportProductsWithoutImage(outputPath?: string): Promise<{
  codes: string[];
  outputFile: string;
}> {
  const products = await prisma.product.findMany({
    orderBy: { code: 'asc' },
    select: { code: true, imageUrl: true },
    where: {
      OR: [{ imageUrl: null }, { imageUrl: '' }],
    },
  });

  const codes = products.filter((p) => !p.imageUrl?.trim()).map((p) => p.code);
  const outputFile = resolveOutputPath(outputPath);
  await writeFile(outputFile, `${codes.join('\n')}\n`, 'utf8');

  return { codes, outputFile };
}

async function main(): Promise<void> {
  const outputArg = process.argv[2];
  try {
    const { codes, outputFile } = await exportProductsWithoutImage(outputArg);
    console.log(`Wrote ${codes.length} product code(s) to ${outputFile}`);
  } finally {
    await prisma.$disconnect();
  }
}

function resolveOutputPath(arg?: string): string {
  const fileName = arg?.trim() || DEFAULT_OUTPUT_FILE;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  return path.isAbsolute(fileName) ? fileName : path.resolve(root, fileName);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
