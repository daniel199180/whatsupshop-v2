import { Hono } from 'hono';
import { db } from '../lib/db';
import { categories } from '../lib/schema';

export const categoriesRoute = new Hono();

categoriesRoute.get('/', async (c) => {
  try {
    const allCategories = await db.select().from(categories);
    return c.json(allCategories);
  } catch (error) {
    return c.json({ error: 'Failed to fetch categories' }, 500);
  }
});

export { categoriesRoute as categories };
