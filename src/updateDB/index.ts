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
  {
    name: 'Add phoneVerified and unique phone index',
    up: async (tx: TransactionClient) => {
      const deduped = await tx.$executeRaw`
        UPDATE "User" u
        SET phone = NULL
        WHERE u.phone IS NOT NULL
          AND u.id NOT IN (
            SELECT DISTINCT ON (phone) id
            FROM "User"
            WHERE phone IS NOT NULL
            ORDER BY phone, "createdAt" ASC
          )
      `;
      console.log(`Cleared duplicate phone values on ${deduped} user(s)`);

      await tx.$executeRaw`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false
      `;

      await tx.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone")
      `;

      console.log('phoneVerified column and unique phone index ensured');
    },
    version: 4,
  },
  {
    name: 'Hygiene delivery orders after status rename',
    up: async (tx: TransactionClient) => {
      const reverted = await tx.order.updateMany({
        data: { status: 'readyForDelivery' },
        where: { deliveryUserId: null, status: 'delivering' },
      });
      console.log(
        `Reverted ${reverted.count} delivering order(s) without driver to readyForDelivery`,
      );

      const cleared = await tx.order.updateMany({
        data: { deliveryUserId: null },
        where: {
          deliveryUserId: { not: null },
          status: {
            in: [
              'pending',
              'paymentPendingConfirmation',
              'paymentConfirmed',
              'preparing',
              'readyForDelivery',
              'cancelled',
            ],
          },
        },
      });
      console.log(`Cleared deliveryUserId on ${cleared.count} non-delivery order(s)`);
    },
    version: 5,
  },
  {
    name: 'Add Order.cancellationReason',
    up: async (tx: TransactionClient) => {
      await tx.$executeRaw`
        ALTER TABLE "Order"
        ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT
      `;
      console.log('Order.cancellationReason column ensured');
    },
    version: 6,
  },
  {
    name: 'Add Store.active',
    up: async (tx: TransactionClient) => {
      await tx.$executeRaw`
        ALTER TABLE "Store"
        ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true
      `;
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "Store_active_idx" ON "Store"("active")
      `;
      console.log('Store.active column and index ensured');
    },
    version: 7,
  },
  {
    name: 'Add Order delivery coordinates and OrderDeliveryTracking',
    up: async (tx: TransactionClient) => {
      await tx.$executeRaw`
        ALTER TABLE "Order"
        ADD COLUMN IF NOT EXISTS "deliveryLatitude" DECIMAL(10,7)
      `;
      await tx.$executeRaw`
        ALTER TABLE "Order"
        ADD COLUMN IF NOT EXISTS "deliveryLongitude" DECIMAL(10,7)
      `;
      await tx.$executeRaw`
        CREATE TABLE IF NOT EXISTS "OrderDeliveryTracking" (
          "orderId" TEXT NOT NULL,
          "latitude" DECIMAL(10,7) NOT NULL,
          "longitude" DECIMAL(10,7) NOT NULL,
          "accuracyMeters" DOUBLE PRECISION,
          "headingDegrees" DOUBLE PRECISION,
          "speedMps" DOUBLE PRECISION,
          "deviceRecordedAt" TIMESTAMP(3),
          "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "trackingSessionId" TEXT,
          "deviceId" TEXT,
          "routeGeometry" JSONB,
          "distanceMeters" DOUBLE PRECISION,
          "etaSeconds" INTEGER,
          "routeCalculatedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "OrderDeliveryTracking_pkey" PRIMARY KEY ("orderId")
        )
      `;
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "OrderDeliveryTracking_serverReceivedAt_idx"
        ON "OrderDeliveryTracking"("serverReceivedAt")
      `;
      await tx.$executeRaw`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'OrderDeliveryTracking_orderId_fkey'
          ) THEN
            ALTER TABLE "OrderDeliveryTracking"
              ADD CONSTRAINT "OrderDeliveryTracking_orderId_fkey"
              FOREIGN KEY ("orderId") REFERENCES "Order"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `;
      await tx.$executeRaw`
        DELETE FROM "OrderDeliveryTracking" t
        USING "Order" o
        WHERE t."orderId" = o."id" AND o."status" <> 'delivering'
      `;
      console.log('Order delivery coordinates and OrderDeliveryTracking ensured');
    },
    version: 8,
  },
  {
    name: 'Add Store latitude/longitude and backfill branch coordinates',
    up: async (tx: TransactionClient) => {
      await tx.$executeRaw`
        ALTER TABLE "Store"
        ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7)
      `;
      await tx.$executeRaw`
        ALTER TABLE "Store"
        ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7)
      `;
      await tx.$executeRaw`
        UPDATE "Store"
        SET "latitude" = 8.598136, "longitude" = -71.150426
        WHERE "externalBranchCode" = '1'
      `;
      await tx.$executeRaw`
        UPDATE "Store"
        SET "latitude" = 8.556639, "longitude" = -71.198714
        WHERE "externalBranchCode" = '2'
      `;
      await tx.$executeRaw`
        UPDATE "Store"
        SET "latitude" = 8.327331, "longitude" = -71.757007
        WHERE "externalBranchCode" = '3'
      `;
      console.log('Store latitude/longitude ensured and backfilled');
    },
    version: 9,
  },
  {
    name: 'Add User address coords/city and Store.city',
    up: async (tx: TransactionClient) => {
      await tx.$executeRaw`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "addressCity" VARCHAR(32)
      `;
      await tx.$executeRaw`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "addressLatitude" DECIMAL(10,7)
      `;
      await tx.$executeRaw`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "addressLongitude" DECIMAL(10,7)
      `;
      await tx.$executeRaw`
        ALTER TABLE "Store"
        ADD COLUMN IF NOT EXISTS "city" VARCHAR(32)
      `;
      await tx.$executeRaw`
        UPDATE "Store" SET "city" = 'merida'
        WHERE "externalBranchCode" IN ('1', '2')
      `;
      await tx.$executeRaw`
        UPDATE "Store" SET "city" = 'tovar'
        WHERE "externalBranchCode" = '3'
      `;
      console.log('User address coords/city and Store.city ensured');
    },
    version: 10,
  },
  {
    name: 'Add PaymentMethodConfig and Payment.note',
    up: async (tx: TransactionClient) => {
      await tx.$executeRaw`
        ALTER TABLE "Payment"
        ADD COLUMN IF NOT EXISTS "note" VARCHAR(100)
      `;
      await tx.$executeRaw`
        CREATE TABLE IF NOT EXISTS "PaymentMethodConfig" (
          "method" "PaymentMethod" NOT NULL,
          "active" BOOLEAN NOT NULL DEFAULT true,
          "information" TEXT,
          "placeholder" VARCHAR(200),
          "noteEnabled" BOOLEAN NOT NULL DEFAULT false,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("method")
        )
      `;
      await tx.$executeRaw`
        INSERT INTO "PaymentMethodConfig" ("method", "active", "information", "placeholder", "noteEnabled", "updatedAt")
        VALUES
          ('cash'::"PaymentMethod", true, NULL, 'Toma una foto legible del billete', true, CURRENT_TIMESTAMP),
          ('zelle'::"PaymentMethod", true, NULL, NULL, true, CURRENT_TIMESTAMP),
          ('mobilePayment'::"PaymentMethod", true, NULL, NULL, false, CURRENT_TIMESTAMP),
          ('binance'::"PaymentMethod", true, NULL, NULL, true, CURRENT_TIMESTAMP)
        ON CONFLICT ("method") DO NOTHING
      `;
      console.log('PaymentMethodConfig and Payment.note ensured');
    },
    version: 11,
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
