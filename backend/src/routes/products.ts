import { Hono } from 'hono';
import { db } from '../lib/db';
import { products } from '../lib/schema';
import { eq, and, like, sql } from 'drizzle-orm';

export const productsRoute = new Hono();

// GET /products — List all active products (with optional search and category filter)
productsRoute.get('/', async (c) => {
  try {
    const categoryId = c.req.query('category');
    const search = c.req.query('q');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 20));
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions = [eq(products.isActive, true)];

    if (categoryId) {
      conditions.push(eq(products.categoryId, Number(categoryId)));
    }
    if (search) {
      conditions.push(like(products.title, `%${search}%`));
    }

    const whereClause = conditions.length === 1 ? conditions[0]! : and(...conditions);

    const allProducts = await db.query.products.findMany({
      where: whereClause,
      with: { category: true },
      limit,
      offset,
      orderBy: (products, { desc }) => [desc(products.createdAt)],
    });

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(products)
      .where(whereClause);

    const total = countResult[0]?.count ?? 0;

    return c.json({
      data: allProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Products list error:', error);
    return c.json({ error: 'Failed to fetch products' }, 500);
  }
});

// GET /products/:slug — Get a single product by slug
productsRoute.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  try {
    const product = await db.query.products.findFirst({
      where: and(eq(products.slug, slug), eq(products.isActive, true)),
      with: { category: true },
    });

    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json(product);
  } catch (error) {
    console.error('Product detail error:', error);
    return c.json({ error: 'Failed to fetch product' }, 500);
  }
});

export { productsRoute as products };
