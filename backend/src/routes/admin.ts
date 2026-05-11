import { Hono } from 'hono';
import { sign } from 'jsonwebtoken';
import { compare } from 'bcryptjs';
import { db } from '../lib/db';
import { storeConfig, products, categories, orders } from '../lib/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/ratelimit';
import {
  loginSchema,
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  upsertConfigSchema,
} from '../lib/validators';

export const admin = new Hono();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// ─── Login (Public, with strict rate limit) ───────────────────────────
admin.post(
  '/login',
  rateLimit(5, 15 * 60 * 1000, 'login'), // 5 attempts per 15 min per IP
  async (c) => {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Username and password are required' }, 400);
    }

    const { username, password } = parsed.data;
    const envUsername = process.env.ADMIN_USERNAME || 'admin';
    const envPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!envPasswordHash) {
      console.error('ADMIN_PASSWORD_HASH is not set in environment variables');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    if (username !== envUsername) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    try {
      const isPasswordValid = await compare(password, envPasswordHash);

      if (!isPasswordValid) {
        return c.json({ error: 'Invalid credentials' }, 401);
      }

      const token = sign({ username, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, {
        expiresIn: '8h',
      });

      return c.json({ token, expiresIn: '8h' });
    } catch (error) {
      console.error('Login error:', error);
      return c.json({ error: 'Authentication failed' }, 500);
    }
  }
);

// ─── All routes below require JWT ─────────────────────────────────────
admin.use('*', authMiddleware);

// ─── Dashboard Stats ──────────────────────────────────────────────────
admin.get('/stats', async (c) => {
  try {
    const [allProducts, allCategories, allOrders] = await Promise.all([
      db.select().from(products),
      db.select().from(categories),
      db.select().from(orders),
    ]);

    return c.json({
      totalProducts: allProducts.length,
      activeProducts: allProducts.filter((p) => p.isActive).length,
      totalCategories: allCategories.length,
      totalOrders: allOrders.length,
    });
  } catch (error) {
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// ─── Products CRUD ────────────────────────────────────────────────────
admin.get('/products', async (c) => {
  try {
    const allProducts = await db.query.products.findMany({
      with: { category: true },
      orderBy: (products, { desc }) => [desc(products.createdAt)],
    });
    return c.json(allProducts);
  } catch (error) {
    return c.json({ error: 'Failed to fetch products' }, 500);
  }
});

admin.get('/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid product ID' }, 400);

  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: { category: true },
    });
    if (!product) return c.json({ error: 'Product not found' }, 404);
    return c.json(product);
  } catch (error) {
    return c.json({ error: 'Failed to fetch product' }, 500);
  }
});

admin.post('/products', async (c) => {
  const body = await c.req.json();
  const parsed = createProductSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const result = await db.insert(products).values(parsed.data);
    return c.json({ id: result[0].insertId, success: true }, 201);
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return c.json({ error: 'A product with this slug already exists' }, 409);
    }
    console.error(error);
    return c.json({ error: 'Failed to create product' }, 500);
  }
});

admin.put('/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid product ID' }, 400);

  const body = await c.req.json();
  const parsed = updateProductSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const existing = await db.query.products.findFirst({ where: eq(products.id, id) });
    if (!existing) return c.json({ error: 'Product not found' }, 404);

    await db.update(products).set(parsed.data).where(eq(products.id, id));
    return c.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return c.json({ error: 'A product with this slug already exists' }, 409);
    }
    return c.json({ error: 'Failed to update product' }, 500);
  }
});

admin.delete('/products/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid product ID' }, 400);

  try {
    const existing = await db.query.products.findFirst({ where: eq(products.id, id) });
    if (!existing) return c.json({ error: 'Product not found' }, 404);

    await db.delete(products).where(eq(products.id, id));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to delete product' }, 500);
  }
});

// ─── Categories CRUD ──────────────────────────────────────────────────
admin.get('/categories', async (c) => {
  try {
    const allCategories = await db.query.categories.findMany({
      with: { products: true },
    });
    // Return categories with product count
    return c.json(
      allCategories.map((cat) => ({
        ...cat,
        productCount: cat.products.length,
        products: undefined, // don't send full product objects
      }))
    );
  } catch (error) {
    return c.json({ error: 'Failed to fetch categories' }, 500);
  }
});

admin.post('/categories', async (c) => {
  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const result = await db.insert(categories).values({ name: parsed.data.name });
    return c.json({ id: result[0].insertId, success: true }, 201);
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return c.json({ error: 'A category with this name already exists' }, 409);
    }
    return c.json({ error: 'Failed to create category' }, 500);
  }
});

admin.put('/categories/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid category ID' }, 400);

  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const existing = await db.query.categories.findFirst({ where: eq(categories.id, id) });
    if (!existing) return c.json({ error: 'Category not found' }, 404);

    await db.update(categories).set({ name: parsed.data.name }).where(eq(categories.id, id));
    return c.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return c.json({ error: 'A category with this name already exists' }, 409);
    }
    return c.json({ error: 'Failed to update category' }, 500);
  }
});

admin.delete('/categories/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid category ID' }, 400);

  try {
    const existing = await db.query.categories.findFirst({ where: eq(categories.id, id) });
    if (!existing) return c.json({ error: 'Category not found' }, 404);

    await db.delete(categories).where(eq(categories.id, id));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to delete category' }, 500);
  }
});

// ─── Orders (Read only from admin) ────────────────────────────────────
admin.get('/orders', async (c) => {
  try {
    const allOrders = await db.select().from(orders);
    return c.json(allOrders);
  } catch (error) {
    return c.json({ error: 'Failed to fetch orders' }, 500);
  }
});

admin.delete('/orders/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid order ID' }, 400);

  try {
    await db.delete(orders).where(eq(orders.id, id));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to delete order' }, 500);
  }
});

// ─── Store Config CRUD ────────────────────────────────────────────────
admin.get('/config', async (c) => {
  try {
    const config = await db.select().from(storeConfig);
    return c.json(config);
  } catch (error) {
    return c.json({ error: 'Failed to fetch config' }, 500);
  }
});

admin.post('/config', async (c) => {
  const body = await c.req.json();
  const parsed = upsertConfigSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    await db
      .insert(storeConfig)
      .values({ key: parsed.data.key, value: parsed.data.value })
      .onDuplicateKeyUpdate({ set: { value: parsed.data.value } });
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update config' }, 500);
  }
});

admin.delete('/config/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid config ID' }, 400);

  try {
    await db.delete(storeConfig).where(eq(storeConfig.id, id));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to delete config' }, 500);
  }
});
