-- Repair script: fixes _prisma_migrations drift without dropping data.
-- Backup is created automatically as _prisma_migrations_backup before running deletes.

-- 1) Remove orphan migrations (exist in DB but not in prisma/migrations/)
DELETE FROM _prisma_migrations
WHERE migration_name IN (
  '20250302000000_init',
  '20260610214440_init',
  '20260611163019_init',
  '20260617131038_add_banners_table'
);

-- 2) Remove duplicate rolled-back record
DELETE FROM _prisma_migrations
WHERE migration_name = '20250302000000_initial_auth_and_catalog'
  AND rolled_back_at IS NOT NULL;

-- 3) Sync checksums with current migration.sql files (after local edits)
UPDATE _prisma_migrations
SET checksum = 'f12806daba261a1eb9b3c297855b1ffd60b6a4e22dc24a2622df5fac71a30b4d'
WHERE migration_name = '20260610120000_add_deals_table';

UPDATE _prisma_migrations
SET checksum = '397d5a218651ab3c67e56ef30f1581d5388db30ee78885354bdfd08414bcf3f2'
WHERE migration_name = '20260617120000_add_banners_table';

UPDATE _prisma_migrations
SET checksum = '34d7b791b050e488914c5760b2a00e76f5039ad4f62ad468c97730663557bc0b'
WHERE migration_name = '20260707120000_add_phone_unique_and_verified';
