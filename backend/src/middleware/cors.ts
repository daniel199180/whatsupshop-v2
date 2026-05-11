import { cors } from 'hono/cors';

/**
 * CORS Middleware — Configurable per environment.
 * In production, restrict to the frontend domain only.
 * Falls back to permissive mode for local development.
 */
const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:4321', 'http://localhost:3000'];

export const corsMiddleware = cors({
  origin: (origin) => {
    // Allow requests with no origin (e.g. server-to-server, curl)
    if (!origin) return '*';
    if (ALLOWED_ORIGINS.includes(origin)) return origin;
    return ALLOWED_ORIGINS[0]!; // Deny by defaulting to first allowed origin
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400, // 24 hours preflight cache
  credentials: true,
});
