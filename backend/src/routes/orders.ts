import { Hono } from 'hono';
import { db } from '../lib/db';
import { orders, storeConfig } from '../lib/schema';
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

    const sanitizedMessage = parsed.data.message.replace(/<[^>]*>/g, '').trim();
    if (!sanitizedMessage) {
      return c.json({ error: 'Order message cannot be empty after sanitization' }, 400);
    }

    const sanitizedName  = parsed.data.customerName.replace(/<[^>]*>/g, '').trim();
    const sanitizedPhone = parsed.data.customerPhone.replace(/<[^>]*>/g, '').trim();
    const items          = parsed.data.items ?? null;

    const result = await db.insert(orders).values({
      customerName:  sanitizedName,
      customerPhone: sanitizedPhone,
      items,
      message:       sanitizedMessage,
    });

    const orderId    = result[0].insertId;
    const createdAt  = new Date().toISOString();
    const total      = items ? items.reduce((s, i) => s + i.price * i.qty, 0) : 0;

    // Fire webhook async — don't block the order response
    fireWebhook({ orderId, customerName: sanitizedName, customerPhone: sanitizedPhone, items, total, message: sanitizedMessage, createdAt })
      .catch(err => console.error('[webhook]', err));

    return c.json({ success: true, id: orderId }, 201);
  } catch (error) {
    console.error('Order error:', error);
    return c.json({ error: 'Failed to record order' }, 500);
  }
});

async function fireWebhook(payload: {
  orderId:       number;
  customerName:  string;
  customerPhone: string;
  items:         any;
  total:         number;
  message:       string;
  createdAt:     string;
}) {
  const config = await db.select().from(storeConfig);
  const cfg    = Object.fromEntries(config.map(r => [r.key, r.value]));

  if (cfg.webhook_enabled !== 'true' || !cfg.webhook_url?.trim()) return;

  await fetch(cfg.webhook_url.trim(), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      orderId:       payload.orderId,
      customerName:  payload.customerName,
      customerPhone: payload.customerPhone,
      items:         payload.items ?? [],
      total:         payload.total,
      createdAt:     payload.createdAt,
      message:       payload.message,
    }),
    signal: AbortSignal.timeout(8000),
  });
}

export { ordersRoute as orders };
