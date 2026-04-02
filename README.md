# ERP Enterprise Secure (Next.js/React + Node + Prisma)

ERP fullstack moderno, modular y auditable para inventario, POS, facturación, contabilidad e impuestos.

## 1) Estructura del proyecto

```txt
/workspace/ERP
├── prisma/
│   ├── schema.prisma      # Modelo de datos empresarial (multiempresa + auditoría)
│   └── seed.ts            # Seed inicial (admin, roles, settings, productos base)
├── server/
│   ├── lib/audit.ts       # Auditoría inmutable con hash encadenado
│   └── middleware/auth.ts # JWT auth + contexto de empresa
├── src/
│   └── App.tsx            # Frontend SPA (dashboard + POS + auditoría)
├── server.ts              # API REST del ERP + Vite middleware
└── README.md
```

## 2) Módulos cubiertos

- Inventario: productos, categorías, stock, soft delete, movimientos.
- POS/Ventas: registro rápido, decremento de stock, anulación con motivo.
- Facturación: emisión automática por secuencia, estado emitida/pagada/anulada.
- Contabilidad: pólizas automáticas mínimas por venta.
- Impuestos: subtotal/impuesto/total por operación.
- Reportes: dashboard y cuadre diario.
- Usuarios y RBAC: ADMIN/CAJERO/CONTADOR/SUPERVISOR.
- Auditoría avanzada: logs con trazabilidad por registro, filtros y exportación.

## 3) Auditoría empresarial implementada

### Eventos registrados automáticamente

- Login / logout.
- CREATE / UPDATE / DELETE (soft delete) de productos.
- CREATE de ventas y facturas.
- VOID de ventas/facturas (sin borrado físico).
- Creación de usuarios.
- Cambios de permisos/rol (`PERMISSION_CHANGE`).

### Detalle por log

- `userId`
- `createdAt`
- `ipAddress`
- `module`
- `action`
- `recordId`
- `oldValues` (JSON)
- `newValues` (JSON)
- `hash` + `prevHash` (inmutabilidad por cadena criptográfica)

### Trazabilidad

- Endpoint timeline: `GET /api/audit-logs/timeline/:module/:recordId`
- Permite historial completo por entidad (producto, factura, venta, usuario, etc.)

### Integridad

- Soft delete en entidades críticas (productos/categorías/usuarios preparados).
- Ventas y facturas no se eliminan: solo `VOIDED` con motivo, usuario y timestamp.

### Seguridad

- Auditoría completa visible solo para ADMIN.
- Logs no editables desde API/UI (solo inserción).
- Hash encadenado para detectar manipulación histórica.

## 4) Endpoints clave (ejemplo funcional solicitado)

### Login con auditoría

- `POST /api/auth/login`
- `POST /api/auth/logout`

### CRUD con auditoría

- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id` (soft delete)

### Venta con auditoría

- `POST /api/sales`:
  - genera `saleNo`
  - genera `invoiceNo`
  - descuenta inventario
  - crea movimientos de inventario
  - crea asiento contable
  - registra auditoría

### Anulación con auditoría

- `POST /api/sales/:id/void`:
  - marca venta/factura como anulada
  - exige motivo
  - restaura stock
  - audita actor + motivo

## 5) Extra solicitado

- Exportar auditoría a Excel (compatible vía CSV):
  - `GET /api/audit-logs/export`
- Filtros avanzados en logs:
  - `GET /api/audit-logs?action=&module=&userId=&from=&to=&recordId=`
- Alertas de actividad sospechosa:
  - `GET /api/audit-logs/suspicious`

## 6) Configuración local (XAMPP / MariaDB)

1. Crear DB en MariaDB (phpMyAdmin/XAMPP):
   - nombre sugerido: `erp_secure`
2. Configurar `.env`:

```bash
DATABASE_URL="mysql://root:@localhost:3306/erp_secure"
JWT_SECRET="cambia-este-secreto-en-produccion"
```

3. Instalar dependencias y generar Prisma client:

```bash
npm install
npx prisma generate
```

4. Crear esquema y cargar seed:

```bash
npx prisma db push
npx prisma db seed
```

5. Levantar ERP:

```bash
npm run dev
```

## 7) Deploy en Vercel

1. Subir repo a GitHub.
2. Crear proyecto en Vercel e importar repo.
3. Variables de entorno en Vercel:
   - `DATABASE_URL` (usar MySQL administrado, ej. PlanetScale/Railway/Aiven)
   - `JWT_SECRET`
4. Build command:

```bash
npm run build
```

5. Start command (si aplica runtime server):

```bash
npm run dev
```

> Recomendado producción: separar frontend Next.js y API en servicio Node dedicado, o migrar rutas a API Routes/Route Handlers de Next.js.

## 8) Seed inicial

- Usuario admin: `admin@admin.com / 123456`
- Roles: ADMIN, CAJERO, CONTADOR, SUPERVISOR
- Configuración base: empresa, moneda, impuesto
- Datos base: categoría electrónica, producto demo, cliente general

## 9) Escalabilidad

- Diseño multiempresa (`companyId` en entidades de negocio).
- Índices para consultas de alta frecuencia.
- Arquitectura modular por dominio en API.
- Listo para separar en microservicios por módulo cuando crezca la carga.
