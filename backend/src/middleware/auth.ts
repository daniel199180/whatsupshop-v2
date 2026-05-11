import type { Context, Next } from 'hono';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const authMiddleware = async (c: Context, next: Next) => {
  // Skip auth for login route
  if (c.req.path.endsWith('/login') && c.req.method === 'POST') {
    return next();
  }

  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized — missing or malformed token' }, 401);
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return c.json({ error: 'Unauthorized — token is empty' }, 401);
  }

  try {
    const decoded = verify(token, JWT_SECRET);
    c.set('jwtPayload', decoded);
    await next();
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') {
      return c.json({ error: 'Token expired — please login again' }, 401);
    }
    return c.json({ error: 'Invalid token' }, 401);
  }
};
