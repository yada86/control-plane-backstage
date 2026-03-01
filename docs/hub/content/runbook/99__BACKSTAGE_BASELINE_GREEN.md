# Backstage Baseline (GREEN)

- Status: GREEN
- Canonical start/stop:
  - Start backend: `yarn workspace backend start`
  - Start frontend (optional): `yarn workspace app start`
  - Avoid `yarn start` when `concurrently` is unavailable
  - If `EADDRINUSE`: kill listeners on ports `7007` and `3000`
- Verified endpoints:
  - `/healthcheck` returns `200`
  - Catalog contains `hub-docs`
  - Docs route works