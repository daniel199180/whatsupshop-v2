import { Hono } from 'hono';
import { db } from '../lib/db';
import { storeConfig } from '../lib/schema';

export const configRoute = new Hono();

configRoute.get('/', async (c) => {
  try {
    const allConfig = await db.select().from(storeConfig);
    // Convert array to object for easier consumption
    const configObj = allConfig.reduce((acc: any, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    return c.json(configObj);
  } catch (error) {
    return c.json({ error: 'Failed to fetch config' }, 500);
  }
});

export { configRoute as config };
