import type { Application } from 'express';
/**
 * DEV ONLY:
 * Force /api/* from the browser (localhost:3000) to forward to backend (7007).
 *
 * Default target is the VERIFIED WSL IP (stable bypass). You can override by env:
 *   BACKSTAGE_DEV_API_TARGET=http://localhost:7007
 */
export default function setupProxy(app: Application): void;
