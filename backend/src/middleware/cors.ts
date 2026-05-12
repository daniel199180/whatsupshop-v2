import { cors } from 'hono/cors';

const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:4321', 'http://localhost:3000'];

// When CORS_ORIGIN is set we're in production: reject originless requests
// (curl/scripts). In dev, allow them so local tooling keeps working.
const IS_PRODUCTION = !!process.env.CORS_ORIGIN;

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return IS_PRODUCTION ? null : '*';
    if (ALLOWED_ORIGINS.includes(origin)) return origin;
    return null; // explicit reject for unknown origins
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400, // 24 hours preflight cache
  credentials: true,
});
