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

### Variables que configura el usuario

| Variable | Dónde | Descripción |
|---|---|---|
| `APP_DOMAIN` | EasyPanel / .env | Dominio del frontend, ej. `mitienda.com` |
| `API_DOMAIN` | EasyPanel / .env | Dominio del backend, ej. `api.mitienda.com` |
| `ADMIN_PASSWORD` | EasyPanel / .env | Contraseña del panel de administración |
| `COMPOSE_PROJECT_NAME` | EasyPanel / .env | Aísla recursos por cliente |
| `ADMIN_USERNAME` | EasyPanel / .env | Login del admin (default: `admin`) |
| `DB_NAME` | EasyPanel / .env | Nombre de BD (default: `whatsupshop`) |
| `BACKUP_RETENTION_DAYS` | EasyPanel / .env | Días de backups (default: 7) |
| `AUTO_BACKUP_BEFORE_MIGRATE` | EasyPanel / .env | Backup antes de migrar (default: true) |

### Variables auto-generadas (no configurar manualmente)

El servicio `setup` escribe estas variables en `/app/secrets/runtime.env` la primera vez que se despliega. No se sobreescriben en redespliegues.

| Variable | Generación |
|---|---|
| `JWT_SECRET` | `openssl rand -hex 32` |
| `DB_PASSWORD` | `openssl rand -hex 24` |
| `DB_ROOT_PASSWORD` | `openssl rand -hex 24` |
| `ADMIN_PASSWORD_HASH` | `bcrypt(ADMIN_PASSWORD, cost=12)` |
| `PUBLIC_URL` | `https://API_DOMAIN` |
| `PUBLIC_API_URL` | `https://API_DOMAIN` |
| `CORS_ORIGIN` | `https://APP_DOMAIN` |

---

## Instalación rápida en EasyPanel

### Variables mínimas por cliente

| Variable | Ejemplo | Descripción |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | `whatsupshop_cliente_acme` | Aísla volúmenes por cliente |
| `APP_DOMAIN` | `mitienda.com` | Dominio del frontend |
| `API_DOMAIN` | `api.mitienda.com` | Dominio del backend |
| `ADMIN_PASSWORD` | `MiPasswordSegura123` | Contraseña del panel admin |

El sistema **auto-genera** en el primer deploy:
- `JWT_SECRET` — secreto aleatorio hex 32 bytes
- `DB_PASSWORD` — contraseña de BD aleatoria
- `DB_ROOT_PASSWORD` — contraseña root de BD aleatoria
- `ADMIN_PASSWORD_HASH` — bcrypt(ADMIN_PASSWORD, cost=12)
- `PUBLIC_URL`, `PUBLIC_API_URL`, `CORS_ORIGIN` — derivadas de los dominios

### Pasos

1. Crear un nuevo **proyecto** en EasyPanel.
2. En ese proyecto, ir a **App → Docker Compose** y conectar este repositorio.
3. Configurar las 4 variables requeridas en la sección de entorno de EasyPanel.
4. Asignar **dominio al frontend** (puerto 4321) y **subdominio al backend** (puerto 3000).
5. Hacer **Deploy** — un solo clic despliega todo.
6. Verificar que el backend responde en `https://api.tudominio.com/health`.

EasyPanel ejecuta los servicios en orden automáticamente:

```
setup → db → migrate → backend → frontend
```

El servicio `setup` genera todos los secretos en el volumen `app_secrets` y **no los sobreescribe en redespliegues**. El servicio `migrate` hace backup automático antes de aplicar migraciones. Si algo falla, el backend no arranca.

### Seguridad del volumen app_secrets

> **No borrar `app_secrets`** — contiene JWT_SECRET, DB_PASSWORD y ADMIN_PASSWORD_HASH.
>
> Si se borra `app_secrets`, el setup generará nuevos secretos. Como DB_PASSWORD cambia, MySQL no podrá autenticarse y **la base de datos quedará inaccesible** hasta que se restaure manualmente.
>
> Si necesitas rotar secretos, borra `app_secrets` **y** `mysql_data` al mismo tiempo y reconfigura desde cero.

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
# Copiar y completar las 4 variables requeridas
cp .env.production.example .env

# Construir y levantar (setup genera secretos en primer arranque)
docker compose up -d --build

# Ver logs del generador de secretos
docker compose logs setup

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

Para cada cliente nuevo, solo hay que configurar 4 variables únicas:

| Variable | Por qué cambiarla |
|---|---|
| `COMPOSE_PROJECT_NAME` | Aísla todos los volúmenes Docker por cliente |
| `APP_DOMAIN` | Dominio del frontend del cliente |
| `API_DOMAIN` | Dominio del backend del cliente |
| `ADMIN_PASSWORD` | Contraseña del panel admin del cliente |

El resto (JWT_SECRET, DB_PASSWORD, DB_ROOT_PASSWORD, etc.) se genera automáticamente de forma independiente para cada cliente.

Con `COMPOSE_PROJECT_NAME` diferente, cada cliente tiene sus propios volúmenes y nunca se mezclan datos:
- `whatsupshop_cliente_acme_mysql_data`
- `whatsupshop_cliente_acme_app_secrets`
- `whatsupshop_cliente_beta_mysql_data`
- `whatsupshop_cliente_beta_app_secrets`

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
> **No borrar `app_secrets`** — contiene JWT_SECRET, DB_PASSWORD y ADMIN_PASSWORD_HASH. Si se borra, el setup genera nuevos secretos y MySQL queda inaccesible porque la contraseña no coincide con la almacenada en `mysql_data`. Solo borrar si también se borra `mysql_data`.
>
> **No usar `init.sql` para actualizar** — solo sirve para la primera instalación (volumen vacío).
>
> **No usar `db:push` en producción** — no genera historial, no permite rollback.
>
> **No recrear la base de datos** — usar migraciones aditivas.
