-- Migration: add customer_name and customer_phone to orders table
ALTER TABLE `orders`
  ADD COLUMN `customer_name`  VARCHAR(200) NOT NULL DEFAULT '' AFTER `id`,
  ADD COLUMN `customer_phone` VARCHAR(50)  NOT NULL DEFAULT '' AFTER `customer_name`;

-- Add items JSON column for structured webhook payload
ALTER TABLE `orders`
  ADD COLUMN `items` JSON DEFAULT NULL AFTER `customer_phone`;
