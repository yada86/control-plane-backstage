import type { Application } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * DEV ONLY:
 * Force /api/* from the browser (localhost:3000) to forward to backend (7007).
 *
 * Default target is the VERIFIED WSL IP (stable bypass). You can override by env:
 *   BACKSTAGE_DEV_API_TARGET=http://localhost:7007
 */
export default function setupProxy(app: Application) {
  const target =
    process.env.BACKSTAGE_DEV_API_TARGET?.trim() ||
    process.env.BACKEND_BASE_URL?.trim() ||
    'http://127.0.0.1:7007';

  console.log(`[DEV_PROXY] /api -> ${target}`);

  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: false,
      ws: true,
      logLevel: 'warn',
    }),
  );
}