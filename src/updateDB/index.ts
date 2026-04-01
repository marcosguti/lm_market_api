/* eslint-disable no-console */
import type { PrismaClient } from '@prisma/client';

import { fileURLToPath } from 'url';

import { createHash } from '../libs/passwordHashing.js';
import prisma from '../prisma.js';

interface MigrationFunction {
  name: string;
  up: (tx: TransactionClient) => Promise<void>;
  version: number;
}

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$extends' | '$on' | '$transaction' | '$use'
>;

const migrations: MigrationFunction[] = [
  {
    name: 'Create super admin',
    up: async (tx: TransactionClient) => {
      const existing = await tx.user.findFirst({
        where: { type: 'superAdmin' },
      });
      if (existing) return;
      const hashedPassword = await createHash(process.env.SUPER_ADMIN_PASSWORD as string);
      await tx.user.create({
        data: {
          createdAt: new Date(),
          email: process.env.SUPER_ADMIN_EMAIL as string,
          firstName: 'Super',
          lastName: 'Admin',
          numberId: 'super-admin',
          password: hashedPassword,
          type: 'superAdmin',
        },
      });
    },
    version: 1,
  },
];

const runMigrations = async () => {
  try {
    const versionRecord = await prisma.dateBaseVersion.findFirst({
      orderBy: { currentVersion: 'desc' },
    });

    const currentVersion = versionRecord?.currentVersion ?? 0;
    const pendingMigrations = migrations.filter((m) => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
      console.log('Database updated. No pending migrations.');
      return;
    }

    for (const migration of pendingMigrations) {
      console.log(`Executing migration ${migration.version}: ${migration.name}`);

      try {
        await prisma.$transaction(async (tx: TransactionClient) => {
          await migration.up(tx);
          await tx.dateBaseVersion.create({
            data: {
              currentVersion: migration.version,
              updatedAt: new Date(),
            },
          });
        });

        console.log(`Migration ${migration.version} completed successfully`);
      } catch (error) {
        console.error(`Error in migration ${migration.version}:`, error);
        throw error;
      }
    }

    console.log('All migrations have been completed successfully');
  } catch (error) {
    console.error('Error during migrations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

export { runMigrations };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed');
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      throw error;
    });
}
