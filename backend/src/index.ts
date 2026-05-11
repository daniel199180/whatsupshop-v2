import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { corsMiddleware } from './middleware/cors';
import { rateLimit } from './middleware/ratelimit';
import { products } from './routes/products';
import { categories } from './routes/categories';
import { admin } from './routes/admin';
import { orders } from './routes/orders';
import { uploads } from './routes/uploads';
import { config } from './routes/config';

const app = new Hono();

// ─── Global Middlewares ───────────────────────────────────────────────
app.use('*', logger());
app.use('*', corsMiddleware);
app.use('*', rateLimit(100, 60 * 1000, 'api')); // 100 req/min per IP (global)

// ─── Static Files (serve uploaded images) ─────────────────────────────
app.use('/uploads/*', serveStatic({ root: './public' }));

// ─── Health Check ─────────────────────────────────────────────────────
app.get('/', (c) =>
  c.json({
    name: 'WhatsUpShop API',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  })
);

app.get('/health', (c) =>
  c.json({ status: 'ok', uptime: process.uptime() })
);

// ─── API Routes ───────────────────────────────────────────────────────
app.route('/products', products);
app.route('/categories', categories);
app.route('/orders', orders);
app.route('/uploads', uploads);
app.route('/config', config);
app.route('/admin', admin);

// ─── 404 Fallback ─────────────────────────────────────────────────────
app.notFound((c) =>
  c.json({ error: 'Route not found', path: c.req.path }, 404)
);

// ─── Global Error Handler ─────────────────────────────────────────────
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ─── Start Server ─────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 3000;

console.log(`🚀 WhatsUpShop API v2.0 running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
