# api-rappi

Simulador de Rappi para el proyecto Mr Sushi. API REST autenticada que recibe notificaciones del backend serverless y permite gestionar pedidos.

## Auth

Endpoints protegidos con JWT (excepto `/auth/login` y `/health`).

- Admin por defecto: `admin` / `admin123` (configurable vía env vars)
- Login: `POST /auth/login` → devuelve `token`
- Enviar token en header: `Authorization: Bearer <token>`
- Endpoint `/orders/{externalRef}/status` usa API key via `x-api-key`

## Ejecutar local

```bash
uv run uvicorn app.main:app --reload
```

## Docker

```bash
docker compose up --build -d
```

Aprovisiona PostgreSQL + API en `http://localhost:8000`.

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/login` | - | Login admin, devuelve JWT |
| POST | `/orders` | JWT | Crear pedido simulado |
| GET | `/orders` | JWT | Listar pedidos |
| GET | `/orders/{externalRef}` | JWT | Ver detalle |
| GET | `/orders/{externalRef}/history` | JWT | Trazabilidad de estados |
| POST | `/orders/{externalRef}/status` | API key | Recibir actualización de Mr Sushi |
| POST | `/orders/{externalRef}/deliver` | JWT | Simular entrega (notifica webhook) |
| GET | `/health` | - | Health check |

## Env vars

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `MRSUSHI_API_URL` | URL del backend Mr Sushi |
| `RAPPI_WEBHOOK_SECRET` | API key compartida con Mr Sushi |
| `RAPPI_JWT_SECRET` | Secreto para firmar JWT |
| `RAPPI_ADMIN_USER` | Usuario admin (default: admin) |
| `RAPPI_ADMIN_PASSWORD` | Password admin (default: admin123) |
