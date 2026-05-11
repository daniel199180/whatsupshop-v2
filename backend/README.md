# WhatsUpShop 2.0 — Backend API

REST API built with **Hono.js** running on **Bun**, backed by **MariaDB/MySQL** via **Drizzle ORM**.

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env with your database credentials and admin password hash

# 3. Generate admin password hash
bunx bcrypt-cli hash "your_secure_password" 12
# Paste the output into ADMIN_PASSWORD_HASH in .env

# 4. Run the initial SQL migration against your database
mysql -u root -p mydatabase < drizzle/0000_initial_schema.sql

# 5. Start the dev server (auto-reload)
bun run dev
```

## API Endpoints

### Public Routes
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API info & health |
| `GET` | `/health` | Uptime check |
| `GET` | `/products` | List products (supports `?q=`, `?category=`, `?page=`, `?limit=`) |
| `GET` | `/products/:slug` | Get product by slug |
| `GET` | `/categories` | List all categories |
| `GET` | `/config` | Store configuration (name, whatsapp, etc.) |
| `POST` | `/orders` | Record an order |

### Admin Routes (Require JWT)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/login` | Get JWT token (rate limited: 5/15min) |
| `GET` | `/admin/stats` | Dashboard statistics |
| `GET/POST/PUT/DELETE` | `/admin/products[/:id]` | Full CRUD |
| `GET/POST/PUT/DELETE` | `/admin/categories[/:id]` | Full CRUD |
| `GET/DELETE` | `/admin/orders[/:id]` | View & delete |
| `GET/POST/DELETE` | `/admin/config[/:id]` | Manage store settings |
| `POST/DELETE` | `/uploads[/:name]` | Image upload & cleanup |

## Scripts
| Command | Description |
|---------|-------------|
| `bun run dev` | Development server with hot reload |
| `bun run start` | Production server |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:push` | Push schema to database |
| `bun run db:studio` | Open Drizzle Studio (DB GUI) |
| `bun run typecheck` | TypeScript type checking |

## Docker

```bash
# From the project root
docker compose up -d
```

The database migration runs automatically on first start via `docker-entrypoint-initdb.d`.
