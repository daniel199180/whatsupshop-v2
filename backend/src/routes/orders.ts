import { Hono } from 'hono';
import { db } from '../lib/db';
import { orders } from '../lib/schema';
import { createOrderSchema } from '../lib/validators';

export const ordersRoute = new Hono();

// POST /orders — Record a new order (public)
ordersRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid order data', details: parsed.error.flatten() }, 400);
    }

    // Sanitize the message — strip HTML tags to prevent stored XSS
    const sanitizedMessage = parsed.data.message
      .replace(/<[^>]*>/g, '')
      .trim();

    if (!sanitizedMessage) {
      return c.json({ error: 'Order message cannot be empty after sanitization' }, 400);
    }

    const result = await db.insert(orders).values({
      message: sanitizedMessage,
    });

    return c.json({ success: true, id: result[0].insertId }, 201);
  } catch (error) {
    console.error('Order error:', error);
    return c.json({ error: 'Failed to record order' }, 500);
  }
});

export { ordersRoute as orders };
