# WhatsUpShop v2

Catálogo de productos con carrito y checkout por WhatsApp. Backend API REST con Bun + Hono, frontend SSR con Astro, base de datos MySQL y despliegue en contenedores Docker.

---

## Características

- Catálogo de productos con categorías, filtros y paginación infinita
- Carrito persistente en localStorage con selección de opciones (talla, color, etc.)
- Checkout que genera un mensaje formateado y abre WhatsApp directamente
- Panel de administración con login JWT para gestionar productos, categorías y configuración de la tienda
- Subida y procesamiento de imágenes automático: WebP + JPG fallback + thumbnail (via Sharp)
- Webhooks de pedidos con nombre, teléfono e ítems en JSON
- Rate limiting por IP en todas las rutas

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | [Bun](https://bun.sh) + [Hono](https://hono.dev) |
| Base de datos | MySQL 8.0 + [Drizzle ORM](https://orm.drizzle.team) |
| Frontend | [Astro](https://astro.build) SSR + Tailwind CSS + Alpine.js |
| Imágenes | [Sharp](https://sharp.pixelplumbing.com) |
| Contenedores | Docker + Docker Compose |
| Despliegue | [EasyPanel](https://easypanel.io) |

---

## Estructura del proyecto

```
.
├── backend/
│   ├── src/
│   │   ├── routes/       # products, categories, orders, admin, config, uploads
│   │   ├── middleware/   # auth JWT, CORS, rate limiting
│   │   └── lib/          # db, schema, validators, image processing
│   ├── drizzle/          # Migraciones Drizzle (MySQL)
│   │   ├── meta/         # Snapshots de estado del schema
│   │   └── init.sql      # Solo para volúmenes MySQL vacíos (primera instalación)
│   ├── scripts/
│   │   └── migrate.sh    # Script de migración con backup automático
│   ├── Dockerfile
│   └── Dockerfile.migrate
├── frontend/             # Catálogo + admin (Astro SSR)
│   └── src/
│       ├── pages/        # index, product/[slug], admin/*, gracias
│       └── components/   # Header, Cart, CategoryFilter, ...
└── docker-compose.yml
```

---

## Puesta en marcha local

### Requisitos

- [Bun](https://bun.sh) >= 1.0
- [Node.js](https://nodejs.org) >= 22
- MySQL 8.0 (o Docker)

### 1. Base de datos

```bash
docker run -d \
  --name whatsupshop-db \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=whatsupshop \
  -p 3306:3306 \
  mysql:8.0

# Aplicar esquema completo + sku
mysql -h 127.0.0.1 -u root -proot whatsupshop < backend/drizzle/init.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # completar los valores
bun install
bun run dev            # http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # completar PUBLIC_API_URL
npm install
npm run dev            # http://localhost:4321
```

---

## Comandos de base de datos

| Comando | Uso | Cuándo usarlo |
|---|---|---|
| `bun run db:generate` | Genera migración desde cambios en schema.ts | Tras modificar schema.ts |
| `bun run db:migrate` | Aplica migraciones pendientes | Producción / staging |
| `bun run db:push` | Sincroniza schema directamente | **Solo desarrollo local** |
| `bun run db:studio` | Abre Drizzle Studio (GUI) | Inspección local |

> **Importante:** `db:push` sincroniza el schema sin crear archivos de migración. En producción siempre usa `db:generate` + `db:migrate` para tener historial y poder hacer rollback.

---

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción | Requerida |
|---|---|---|
| `DB_HOST` | Host de MySQL | Sí |
| `DB_PORT` | Puerto de MySQL | No (default: 3306) |
| `DB_USER` | Usuario de MySQL | Sí |
| `DB_PASSWORD` | Contraseña de MySQL | Sí |
| `DB_NAME` | Nombre de la base de datos | Sí |
| `DB_ROOT_PASSWORD` | Contraseña root MySQL (docker-compose) | Sí |
| `JWT_SECRET` | Secreto para tokens JWT | Sí |
| `ADMIN_USERNAME` | Usuario del panel admin | No (default: admin) |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt de la contraseña admin | Sí |
| `PORT` | Puerto del servidor | No (default: 3000) |
| `PUBLIC_URL` | URL pública del backend (para URLs de imágenes) | Sí |
| `CORS_ORIGIN` | Origen(es) permitidos, separados por coma | Sí |
| `AUTO_BACKUP_BEFORE_MIGRATE` | Hacer backup antes de migrar | No (default: true) |
| `BACKUP_RETENTION_DAYS` | Días a conservar backups | No (default: 7) |

Generar valores para producción:

```bash
# JWT_SECRET
openssl rand -hex 32

# ADMIN_PASSWORD_HASH
cd backend && bun run hash-password 'tu_contraseña'
```

### Frontend (`frontend/.env`)

| Variable | Descripción | Requerida |
|---|---|---|
| `PUBLIC_API_URL` | URL pública del backend | Sí |

---

## Despliegue en EasyPanel

### Primer despliegue de un cliente nuevo

1. Crear un nuevo **proyecto** en EasyPanel.
2. En ese proyecto, ir a **App → Docker Compose** y pegar / conectar este repositorio.
3. Configurar las **variables de entorno** en EasyPanel (ver `.env.production.example`). Los valores mínimos obligatorios son:
   ```
   DB_ROOT_PASSWORD   DB_USER   DB_PASSWORD   DB_NAME
   JWT_SECRET         ADMIN_PASSWORD_HASH
   PUBLIC_URL         PUBLIC_API_URL   CORS_ORIGIN
   COMPOSE_PROJECT_NAME=whatsupshop_cliente_nombre
   ```
4. Asignar **dominio al frontend** (puerto 4321) y **subdominio al backend** (puerto 3000) desde la sección Domains de cada servicio.
5. Hacer **Deploy**.
6. Verificar que el backend responde en `https://api.tudominio.com/health`.

EasyPanel construirá las imágenes y ejecutará los servicios en orden:
`db` → `migrate` → `backend` → `frontend`

El servicio `migrate` hace un backup automático y aplica las migraciones pendientes. Si algo falla, el backend **no arranca**.

---

## Actualizaciones sin perder datos

Cada vez que se añade o modifica funcionalidad en el catálogo:

```bash
# 1. Modificar backend/src/lib/schema.ts con los cambios de schema

# 2. Generar la migración Drizzle
cd backend
bun run db:generate

# 3. Revisar el SQL generado en backend/drizzle/
#    Verificar que no haya DROP TABLE ni DROP COLUMN no deseados

# 4. Hacer commit de la migración junto con el código
git add backend/drizzle/ backend/src/
git commit -m "feat: descripción del cambio"

# 5. Push al repositorio
git push origin main

# 6. En EasyPanel: pulsar Redeploy
```

Al redesplegar, EasyPanel:
1. Construye las nuevas imágenes.
2. Levanta el servicio `migrate` → hace backup → aplica nuevas migraciones.
3. El backend arranca **solo si** `migrate` terminó con éxito.

Los datos de clientes (productos, pedidos, categorías, configuración, imágenes) **no se tocan**.

---

## Despliegue con Docker Compose (local / staging)

```bash
# Copiar y completar variables
cp .env.production.example .env

# Construir y levantar
docker compose up -d --build

# Ver logs del servicio de migraciones
docker compose logs -f migrate

# Ver logs del backend
docker compose logs -f backend
```

Servicios:
- `frontend` → puerto 4321
- `backend` → puerto 3000
- `db` → MySQL (puerto comentado en producción, exponer solo en desarrollo)
- `migrate` → contenedor one-shot; termina cuando las migraciones se aplican

---

## Multi-cliente: replicar para un nuevo cliente

Para cada cliente nuevo, copiar `.env.production.example` y cambiar **todos** los valores marcados como "PER-CLIENT":

| Variable | Por qué cambiarla |
|---|---|
| `COMPOSE_PROJECT_NAME` | Aísla volúmenes Docker (mysql_data, uploads_data, db_backups) |
| `DB_NAME` | Base de datos propia por cliente |
| `DB_USER` / `DB_PASSWORD` | Credenciales propias |
| `DB_ROOT_PASSWORD` | Contraseña root propia |
| `JWT_SECRET` | Secreto independiente por seguridad |
| `ADMIN_PASSWORD_HASH` | Contraseña del panel admin |
| `PUBLIC_URL` / `PUBLIC_API_URL` | Dominio propio del cliente |
| `CORS_ORIGIN` | Dominio del frontend del cliente |

Con `COMPOSE_PROJECT_NAME` diferente, cada cliente tiene sus propios volúmenes y nunca se mezclan datos:
- `whatsupshop_cliente_acme_mysql_data`
- `whatsupshop_cliente_beta_mysql_data`

---

## Reglas de migración segura

Estas reglas protegen los datos de cada cliente:

| Operación | Estado | Notas |
|---|---|---|
| `CREATE TABLE` | Permitido | Siempre usar `IF NOT EXISTS` |
| `ADD COLUMN` | Permitido | Con `DEFAULT` o `NULL` para no romper filas existentes |
| `ADD INDEX` | Permitido | No modifica datos |
| `RENAME COLUMN` | Requiere cuidado | Crear columna nueva + copiar datos + eliminar la vieja |
| `DROP COLUMN` | Requiere backup + revisión manual | Verificar que nadie la usa antes |
| `CHANGE` / `MODIFY` tipo de columna | Requiere revisión manual | Verificar compatibilidad de datos |
| `DROP TABLE` | Prohibido sin backup explícito | Solo con migración manual documentada |

---

## Panel de administración

Acceder en `/admin`. Las credenciales se configuran con `ADMIN_USERNAME` y `ADMIN_PASSWORD_HASH`.

Desde el panel se pueden gestionar:
- Productos (crear, editar, eliminar, subir imágenes)
- Categorías
- Configuración de la tienda (nombre, número de WhatsApp, moneda)
- Pedidos recibidos

---

## Advertencias críticas — No perder datos

> **No borrar `mysql_data`** — contiene toda la base de datos del cliente.
>
> **No borrar `uploads_data`** — contiene las imágenes subidas de productos.
>
> **No borrar `db_backups`** — contiene los backups pre-migración para rollback.
>
> **No usar `init.sql` para actualizar** — solo sirve para la primera instalación (volumen vacío).
>
> **No usar `db:push` en producción** — no genera historial, no permite rollback.
>
> **No recrear la base de datos** — usar migraciones aditivas.
