# Plan de Modernización: WhatsUpShop 2.0 🚀

## Contexto y Objetivo

El proyecto actual es una tienda de catálogo con checkout por WhatsApp, construida en PHP monolítico con MySQL. El objetivo es reescribirlo en una arquitectura moderna de dos capas (Frontend / Backend separados) priorizando: **velocidad**, **seguridad** y **mantenibilidad**.

---

## Stack Tecnológico Propuesto

### 🔵 Frontend — Astro + Tailwind CSS + Alpine.js

| Herramienta | ¿Por qué? |
|---|---|
| **Astro** | Genera HTML estático en el servidor → carga instantánea. Cero JS por defecto al navegador. |
| **Tailwind CSS** | Diseño moderno, responsivo y consistente sin archivos CSS pesados. |
| **Alpine.js** | Maneja la interactividad del carrito (agregar, quitar, total) sin React ni Vue. Ultra ligero (15kb). |

### 🟠 Backend — Hono.js sobre Bun

**Propuesta de Backend: Hono.js corriendo en Bun**

> [!IMPORTANT]
> Esta es la elección técnica más importante del plan. Aquí está la justificación:

| Criterio | PHP actual | Hono.js + Bun |
|---|---|---|
| **Velocidad** | ~5,000 req/s | ~150,000+ req/s |
| **TypeScript** | ❌ | ✅ Tipado estático, menos bugs |
| **Seguridad** | Manual, propenso a errores | Middleware automático (JWT, rate limit, CORS) |
| **Imágenes** | `GD Library` (lento) | `Sharp` (libvips, C++, ultrarrápido) |
| **Ecosistema** | Maduro pero lento de escalar | Moderno y creciente |

**¿Qué es Bun?** Es un runtime de JavaScript/TypeScript ultrarrápido (alternativa a Node.js), escrito en Zig. Ejecuta código TypeScript de forma nativa sin transpilación.

**¿Qué es Hono?** Es un framework web minimalista y extremadamente rápido, similar a Express pero hasta 10x más veloz. Fue diseñado para correr en entornos de alto rendimiento (Bun, Deno, Cloudflare Workers).

### 🟢 Base de Datos — MariaDB / MySQL + Drizzle ORM

**Recomendación:** Para despliegue en masa en **Easypanel**, MariaDB es la opción ideal por ser más ligera que MySQL estándar y estar perfectamente integrada en el ecosistema de Easypanel.

- **Drizzle ORM:** Provee consultas tipadas (TypeScript) → imposible hacer inyección SQL.
- **Migraciones:** Controladas en archivos `.sql` ultra livianos.
- **Rendimiento:** Conexiones persistentes y rápidas con el driver de Bun.

---

## Arquitectura del Proyecto

```
catalogo-whatsapp/
├── backend/                 # API REST con Hono.js + Bun
│   ├── src/
│   │   ├── index.ts         # Punto de entrada del servidor
│   │   ├── routes/
│   │   │   ├── products.ts  # GET /products, GET /products/:id
│   │   │   ├── categories.ts# GET /categories
│   │   │   ├── orders.ts    # POST /orders (registro del pedido)
│   │   │   ├── uploads.ts   # POST /upload (imagen con compresión)
│   │   │   └── admin.ts     # CRUD protegido con JWT
│   │   ├── middleware/
│   │   │   ├── auth.ts      # Verificación de JWT
│   │   │   ├── ratelimit.ts # Rate limiting por IP
│   │   │   └── cors.ts      # Configuración CORS
│   │   └── lib/
│   │       ├── db.ts        # Cliente Drizzle + conexión MySQL
│   │       ├── schema.ts    # Esquema de tablas (Drizzle)
│   │       └── image.ts     # Procesamiento de imágenes con Sharp
│   ├── drizzle/
│   │   └── migrations/      # Migraciones SQL versionadas
│   └── .env                 # Variables de entorno (NUNCA en Git)
│
└── frontend/                # Tienda pública con Astro
    ├── src/
    │   ├── pages/
    │   │   ├── index.astro      # Catálogo principal
    │   │   └── product/
    │   │       └── [slug].astro # Página de producto individual
    │   ├── components/
    │   │   ├── ProductCard.astro
    │   │   ├── ProductGrid.astro
    │   │   ├── Cart.astro       # UI del carrito (Alpine.js)
    │   │   └── Header.astro
    │   └── layouts/
    │       └── BaseLayout.astro
    └── astro.config.mjs
```

---

## Plan de Seguridad Detallado 🔒

> [!CAUTION]
> Todos los puntos siguientes son obligatorios, no opcionales.

### 1. Variables de Entorno (`.env`)
**Cero credenciales en el código.** Todo va en `.env` y el archivo se agrega al `.gitignore`:
```
DATABASE_URL="mysql://user:password@localhost/dbname"
JWT_SECRET="clave-super-secreta-de-64-caracteres-aleatorios"
ADMIN_USERNAME="mi_usuario_admin"
ADMIN_PASSWORD_HASH="$2b$12$..." # hash bcrypt, nunca la contraseña en texto plano
```

### 2. Autenticación — JWT (JSON Web Tokens)
- El admin hace login → el backend verifica la contraseña con **bcrypt** (10 rounds mínimo)
- Si es correcta → genera un **JWT firmado** con fecha de expiración (ej: 8 horas)
- Cada petición al panel admin incluye el JWT en el header `Authorization: Bearer <token>`
- El middleware `auth.ts` verifica la firma del token antes de permitir cualquier operación

### 3. Rate Limiting
- Máximo **5 intentos de login fallidos por IP** en 15 minutos → bloqueo temporal
- Máximo **100 peticiones por minuto por IP** a la API pública
- Protege contra ataques de fuerza bruta y DDoS básicos

### 4. Protección de Rutas Admin
- Todas las rutas `/admin/*` requieren JWT válido
- Las rutas públicas (`/products`, `/categories`) son de solo lectura
- **CORS** configurado explícitamente: solo acepta peticiones del dominio del frontend

### 5. Validación de Entradas
- Toda entrada del usuario se valida con **Zod** (librería de validación TypeScript)
- Previene inyección SQL (Drizzle ORM parameteriza todas las queries automáticamente)
- Previene XSS: los datos se sanitizan antes de guardarse

### 6. Uploads Seguros
- Solo se aceptan archivos `image/jpeg`, `image/png`, `image/webp`
- Se valida el **magic bytes** del archivo (no solo la extensión)
- El nombre del archivo se regenera aleatoriamente (no se usa el nombre original)
- Tamaño máximo configurable (ej: 10MB antes de compresión)

---

## Compresión de Imágenes con Sharp 📸

**Sharp** es la librería de procesamiento de imágenes más rápida para Node.js/Bun (usa la biblioteca nativa `libvips` en C++). Es hasta 10x más rápida que ImageMagick.

**Flujo al subir una imagen:**
1. El admin sube la imagen (jpeg/png/webp, hasta 10MB).
2. Sharp la procesa en memoria (ultra rápido).
3. **Optimización Extrema:**
   - Redimensiona a 1080px (ideal para móviles).
   - Convierte a **WebP** con calidad 75% (balance perfecto peso/calidad).
   - Genera un **Thumbnail** pequeño para carga instantánea.
4. **Limpieza:** Se borran las imágenes antiguas para mantener el VPS limpio.

**Resultado:** Una foto de 4MB se convierte en un WebP de ~60KB. (98% de ahorro).

---

## Esquema de Base de Datos Mejorado (Drizzle ORM)

```typescript
// backend/src/lib/schema.ts
import { mysqlTable, int, varchar, text, float, boolean, json, timestamp } from 'drizzle-orm/mysql-core';

export const products = mysqlTable('products', {
  id:            int('id').primaryKey().autoincrement(),
  slug:          varchar('slug', { length: 100 }).unique().notNull(), // URL amigable
  title:         varchar('title', { length: 300 }).notNull(),
  description:   text('description').notNull(),
  normalPrice:   float('normal_price').notNull(),
  discountPrice: float('discount_price').default(0),
  imageUrl:      varchar('image_url', { length: 500 }).notNull(),    // WebP principal
  imageFallback: varchar('image_fallback', { length: 500 }),          // JPG fallback
  thumbnail:     varchar('thumbnail', { length: 500 }),               // 400x400px
  options:       json('options'),           // Variantes del producto
  moreImages:    json('more_images'),       // Imágenes adicionales
  categoryId:    int('category_id'),
  isActive:      boolean('is_active').default(true), // Ocultar sin borrar
  createdAt:     timestamp('created_at').defaultNow(),
  updatedAt:     timestamp('updated_at').onUpdateNow(),
});

export const categories = mysqlTable('categories', {
  id:   int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).unique().notNull(),
});

export const orders = mysqlTable('orders', {
  id:        int('id').primaryKey().autoincrement(),
  message:   text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const storeConfig = mysqlTable('store_config', {
  id:    int('id').primaryKey().autoincrement(),
  key:   varchar('key', { length: 100 }).unique().notNull(),
  value: text('value').notNull(),
});
```

---

## Plan de Ejecución por Fases

### Fase 1 — Backend API (Semana 1)
- [ ] Inicializar proyecto Bun + Hono en carpeta `backend/`
- [ ] Configurar Drizzle ORM + generar migración desde el esquema existente
- [ ] Crear endpoints públicos: `GET /products`, `GET /products/:slug`, `GET /categories`, `GET /config`
- [ ] Crear sistema de autenticación JWT (login, verify token middleware)
- [ ] Crear endpoints protegidos de Admin (CRUD productos, categorías, config)
- [ ] Implementar pipeline de compresión de imágenes con Sharp
- [ ] Configurar Rate Limiting y CORS

### Fase 2 — Frontend Astro (Semana 2)
- [ ] Inicializar proyecto Astro en carpeta `frontend/`
- [ ] Configurar Tailwind CSS
- [ ] Crear layout base y sistema de diseño (colores, tipografía)
- [ ] Construir página principal: `index.astro` (grilla de productos, filtro por categorías)
- [ ] Construir página de producto: `product/[slug].astro`
- [ ] Implementar carrito de compras con Alpine.js (estado en localStorage)
- [ ] Implementar flujo de checkout → generación del mensaje de WhatsApp

### Fase 3 — Panel de Administración (Semana 3)
- [ ] Crear panel admin como SPA dentro de Astro (protegido por JWT en el cliente)
- [ ] Pantalla de login con llamada al endpoint `/auth/login`
- [ ] CRUD de productos con formulario y preview de imagen
- [ ] CRUD de categorías
- [ ] Vista de pedidos recibidos
## 📦 Peso y Consumo (Optimizado para Venta en Masa)

Para que el proyecto sea vendible y escalable en VPS pequeños, hemos optimizado el peso total:

| Componente | Tecnología | Peso Imagen | RAM (IDLE) |
|---|---|---|---|
| **Frontend** | Nginx Alpine | ~20 MB | ~5 MB |
| **Backend** | Bun + Hono | ~90 MB | ~40 MB |
| **Base de Datos** | MariaDB Alpine | ~180 MB | ~80 MB |
| **TOTAL** | **Full Stack** | **~290 MB** | **~125 MB** |

> [!TIP]
> **Easypanel Ready:** El proyecto está diseñado para desplegarse con un clic en Easypanel, ocupando menos de **150MB de RAM**, permitiendo meter decenas de catálogos en un solo VPS de $5.

## 🐳 Estrategia Docker (Easypanel)

```dockerfile
# Dockerfile Multi-stage para Backend
FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .

FROM oven/bun:alpine
WORKDIR /app
COPY --from=builder /app .
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

---
**Plan actualizado y cerrado para ejecución.** 🚀
