-- WhatsUpShop 2.0 — Initial Schema Migration
-- Run this against your MariaDB/MySQL database to create all tables.

CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(100) NOT NULL,
  `title` VARCHAR(300) NOT NULL,
  `description` TEXT NOT NULL,
  `normal_price` FLOAT NOT NULL,
  `discount_price` FLOAT DEFAULT 0,
  `image_url` VARCHAR(500) NOT NULL,
  `image_fallback` VARCHAR(500) DEFAULT NULL,
  `thumbnail` VARCHAR(500) DEFAULT NULL,
  `options` JSON DEFAULT NULL,
  `more_images` JSON DEFAULT NULL,
  `category_id` INT DEFAULT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_slug_unique` (`slug`),
  KEY `products_category_id_idx` (`category_id`),
  KEY `products_is_active_idx` (`is_active`),
  CONSTRAINT `products_category_fk` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `store_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `store_config_key_unique` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default store configuration
INSERT IGNORE INTO `store_config` (`key`, `value`) VALUES
  ('store_name', 'Mi Tienda'),
  ('whatsapp_number', '1234567890'),
  ('currency', 'USD'),
  ('currency_symbol', '$');
