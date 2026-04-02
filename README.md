# ERP Fullstack (Vite + Vercel Functions + Prisma)

Reconstruido para funcionar correctamente en **Vercel**:
- Frontend SPA con **React + Vite**
- Backend serverless en carpeta **`/api`** (Vercel Functions)
- **Prisma + MySQL/MariaDB**
- Auditoría encadenada (`hash` + `prevHash`)

## Por qué antes quedaba cargando infinito

El frontend esperaba un backend Express monolítico que en Vercel no estaba disponible de la misma manera. Ahora la app usa rutas serverless nativas `/api/*` dentro del mismo despliegue.

## Rutas API incluidas

- `GET /api/setup/status`
- `POST /api/setup/init`
- `POST /api/auth/login`
- `GET|POST /api/products`
- `POST /api/sales`
- `GET /api/audit-logs` (solo ADMIN)

## Variables de entorno

```bash
DATABASE_URL="mysql://user:pass@host:3306/erp"
JWT_SECRET="cambia-esto"
VITE_API_BASE_URL="/api"
```

## Desarrollo local

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

## Deploy en Vercel

1. Importar repositorio.
2. Configurar `DATABASE_URL`, `JWT_SECRET`, `VITE_API_BASE_URL`.
3. Build command: `npm run build`.
4. Deploy.

## Seed admin

- `admin@admin.com`
- `123456`
