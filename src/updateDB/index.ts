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

const PLACEHOLDER = '—';

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
          numberIdType: 'V',
          password: hashedPassword,
          type: 'superAdmin',
        },
      });
    },
    version: 1,
  },
  {
    name: 'Backfill Brand and Department from Product',
    up: async (tx: TransactionClient) => {
      await tx.$executeRaw`
        INSERT INTO "Brand" ("id", "name", "createdAt", "updatedAt")
        SELECT gen_random_uuid()::text, src.brand_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM (
          SELECT DISTINCT CASE
            WHEN TRIM("brand") = '' THEN ${PLACEHOLDER}
            ELSE TRIM("brand")
          END AS brand_name
          FROM "Product"
        ) AS src
        WHERE NOT EXISTS (
          SELECT 1 FROM "Brand" b WHERE b."name" = src.brand_name
        )
      `;

      await tx.$executeRaw`
        INSERT INTO "Department" ("id", "name", "createdAt", "updatedAt")
        SELECT gen_random_uuid()::text, src.department_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM (
          SELECT DISTINCT CASE
            WHEN TRIM("department") = '' THEN ${PLACEHOLDER}
            ELSE TRIM("department")
          END AS department_name
          FROM "Product"
        ) AS src
        WHERE NOT EXISTS (
          SELECT 1 FROM "Department" d WHERE d."name" = src.department_name
        )
      `;

      await tx.$executeRaw`
        UPDATE "Product" p
        SET "brandId" = b."id"
        FROM "Brand" b
        WHERE b."name" = CASE
          WHEN TRIM(p."brand") = '' THEN ${PLACEHOLDER}
          ELSE TRIM(p."brand")
        END
      `;

      await tx.$executeRaw`
        UPDATE "Product" p
        SET "departmentId" = d."id"
        FROM "Department" d
        WHERE d."name" = CASE
          WHEN TRIM(p."department") = '' THEN ${PLACEHOLDER}
          ELSE TRIM(p."department")
        END
      `;

      const missingBrand = await tx.product.count({ where: { brandId: null } });
      const missingDepartment = await tx.product.count({ where: { departmentId: null } });

      if (missingBrand > 0 || missingDepartment > 0) {
        throw new Error(
          `Brand/Department backfill incomplete: ${missingBrand} products without brandId, ${missingDepartment} without departmentId`,
        );
      }

      const brandCount = await tx.brand.count();
      const departmentCount = await tx.department.count();
      console.log(
        `Backfill complete: ${brandCount} brands, ${departmentCount} departments, all products linked`,
      );
    },
    version: 2,
  },
  {
    name: 'Populate Stores',
    up: async (tx: TransactionClient) => {
      const stores = [
        { externalBranchCode: '1', name: 'Las Americas' },
        { externalBranchCode: '2', name: 'Altochama' },
        { externalBranchCode: '3', name: 'Tovar' },
      ];
      for (const s of stores) {
        await tx.store.upsert({
          create: s,
          update: {},
          where: { externalBranchCode: s.externalBranchCode },
        });
      }
      console.log('Populated stores');
    },
    version: 3,
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
