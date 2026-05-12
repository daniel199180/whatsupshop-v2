import { mysqlTable, int, varchar, text, float, boolean, json, timestamp } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

export const categories = mysqlTable('categories', {
  id:   int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).unique().notNull(),
});

export const products = mysqlTable('products', {
  id:            int('id').primaryKey().autoincrement(),
  slug:          varchar('slug', { length: 100 }).unique().notNull(),
  sku:           varchar('sku', { length: 100 }),
  title:         varchar('title', { length: 300 }).notNull(),
  description:   text('description').notNull(),
  normalPrice:   float('normal_price').notNull(),
  discountPrice: float('discount_price').default(0),
  imageUrl:      varchar('image_url', { length: 500 }).notNull(),
  imageFallback: varchar('image_fallback', { length: 500 }),
  thumbnail:     varchar('thumbnail', { length: 500 }),
  options:       json('options'),           // Array de opciones { name: string, price: number }
  moreImages:    json('more_images'),       // Array de URLs de imágenes
  categoryId:    int('category_id'),
  isActive:      boolean('is_active').default(true),
  createdAt:     timestamp('created_at').defaultNow(),
  updatedAt:     timestamp('updated_at').onUpdateNow(),
});

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const orders = mysqlTable('orders', {
  id:            int('id').primaryKey().autoincrement(),
  customerName:  varchar('customer_name', { length: 200 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 50 }).notNull(),
  items:         json('items'),
  message:       text('message').notNull(),
  createdAt:     timestamp('created_at').defaultNow(),
});

export const storeConfig = mysqlTable('store_config', {
  id:    int('id').primaryKey().autoincrement(),
  key:   varchar('key', { length: 100 }).unique().notNull(),
  value: text('value').notNull(),
});
