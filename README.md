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
├── backend/          # API REST (Bun + Hono)
│   ├── src/
│   │   ├── routes/   # products, categories, orders, admin, config, uploads
│   │   ├── middleware/  # auth JWT, CORS, rate limiting
│   │   └── lib/      # db, schema, validators, image processing
│   └── drizzle/      # Migraciones SQL
├── frontend/         # Catálogo + admin (Astro SSR)
│   └── src/
│       ├── pages/    # index, product/[slug], admin/*, gracias
│       └── components/  # Header, Cart, CategoryFilter, ...
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
  -e MYSQL_DATABASE=mydatabase \
  -p 3306:3306 \
  mysql:8.0

# Aplicar esquema completo
mysql -h 127.0.0.1 -u root -proot mydatabase < backend/drizzle/init.sql
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

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción | Requerida |
|---|---|---|
| `DB_HOST` | Host de MySQL | Sí |
| `DB_PORT` | Puerto de MySQL | No (default: 3306) |
| `DB_USER` | Usuario de MySQL | Sí |
| `DB_PASSWORD` | Contraseña de MySQL | Sí |
| `DB_NAME` | Nombre de la base de datos | Sí |
| `JWT_SECRET` | Secreto para tokens JWT | Sí |
| `ADMIN_USERNAME` | Usuario del panel admin | No (default: admin) |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt de la contraseña admin | Sí |
| `PORT` | Puerto del servidor | No (default: 3000) |
| `PUBLIC_URL` | URL pública del backend (para URLs de imágenes) | Sí |
| `CORS_ORIGIN` | Origen(es) permitidos, separados por coma | Sí |

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

## Despliegue con Docker Compose

```bash
# Copiar y completar variables de entorno
cp backend/.env.example backend/.env

# Construir y levantar todos los servicios
docker compose up -d --build
```

Servicios:
- `frontend` → puerto 4321
- `backend` → puerto 3000
- `db` → MySQL (puerto 3307 en el host)

---

## Despliegue en EasyPanel

1. Conectar el repositorio en EasyPanel
2. Crear tres servicios desde el `docker-compose.yml`: `frontend`, `backend`, `db`
3. Configurar las variables de entorno en el panel de cada servicio (ver tabla anterior)
4. EasyPanel construye las imágenes automáticamente en cada push

---

## Panel de administración

Acceder en `/admin`. Las credenciales se configuran con `ADMIN_USERNAME` y `ADMIN_PASSWORD_HASH` en las variables de entorno.

Desde el panel se pueden gestionar:
- Productos (crear, editar, eliminar, subir imágenes)
- Categorías
- Configuración de la tienda (nombre, número de WhatsApp, moneda)
- Pedidos recibidos
