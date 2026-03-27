# AutoMarket Backend - Parte 2

Backend en NestJS con autenticacion JWT, usuarios y CRUD de autos, listo para conectar con Supabase Postgres y desplegar en Railway.

## Stack

- NestJS
- TypeORM
- PostgreSQL (Supabase)
- JWT + Passport
- class-validator

## Variables de entorno

Copia `.env.example` como `.env` y completa valores:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/automarket
JWT_SECRET=replace_with_secure_secret
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:5500
```

## Scripts

```bash
npm run start:dev   # desarrollo
npm run typecheck   # validacion TypeScript
npm run build       # build de produccion
npm run start       # correr build en dist
```

## SQL para Supabase

Ejecutar en SQL Editor de Supabase en este orden:

1. `sql/01_schema.sql`
2. `sql/02_seed.sql`

Credenciales seed:

- seller@automarket.dev / 123456
- buyer@automarket.dev / 123456

## Endpoints

### Health

- `GET /health`

### Auth

- `POST /auth/register`
  - body:
    ```json
    {
      "email": "nuevo@correo.com",
      "password": "123456",
      "fullName": "Nombre Usuario",
      "role": "buyer"
    }
    ```
- `POST /auth/login`
  - body:
    ```json
    {
      "email": "seller@automarket.dev",
      "password": "123456"
    }
    ```
  - respuesta: `accessToken` + `user`

### Cars

- `GET /cars`
  - filtros opcionales query:
    - `brand`, `model`, `yearMin`, `yearMax`, `priceMin`, `priceMax`, `kilometersMax`, `province`
- `GET /cars/:id`
- `POST /cars` (requiere JWT + rol seller)
- `PATCH /cars/:id` (requiere JWT + rol seller y ser dueno de la publicacion)
- `DELETE /cars/:id` (requiere JWT + rol seller y ser dueno de la publicacion)

## Como funciona JWT en esta implementacion

1. Usuario hace login o register.
2. Backend firma un token JWT con:
   - `sub` (id del usuario)
   - `email`
   - `role`
3. Frontend guarda ese token (temporalmente en memoria o storage segun estrategia).
4. En endpoints protegidos, frontend envia header:
   - `Authorization: Bearer <token>`
5. `JwtAuthGuard` valida firma y expiracion.
6. `RolesGuard` valida permisos segun rol (por ejemplo `seller` para publicar).

## Railway

El archivo `railway.json` ya define build y start:

- build: `npm run build`
- start: `npm run start`

En Railway debes configurar variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `PORT` (Railway suele inyectarlo automaticamente)

## Estado de esta parte

- Incluido: auth JWT, users, cars CRUD, filtros, health, SQL schema/seed.
- Pendiente para siguiente parte:
  - upload de imagenes a Supabase Storage (max 2MB)
  - preguntas publicas por publicacion
  - notificaciones en tiempo real
  - integracion Gemini Vision real
