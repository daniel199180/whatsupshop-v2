-- Add sku column to products.
-- Uses PREPARE/EXECUTE to check for column existence first so this migration
-- is idempotent: safe to run against databases created with init.sql (no sku),
-- databases where db:push was already used (sku exists), and fresh installs
-- where init.sql already includes sku.

--> statement-breakpoint
SET @_col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'products'
    AND COLUMN_NAME  = 'sku'
);

--> statement-breakpoint
SET @_sql = IF(
  @_col_exists = 0,
  'ALTER TABLE `products` ADD COLUMN `sku` VARCHAR(100) NULL AFTER `slug`',
  'SELECT 1 -- sku already exists, skipping'
);

--> statement-breakpoint
PREPARE _sku_stmt FROM @_sql;

--> statement-breakpoint
EXECUTE _sku_stmt;

--> statement-breakpoint
DEALLOCATE PREPARE _sku_stmt;
