# api-rappi

Simulador de Rappi para proyecto de Cloud Computing.

## ejecutar

```bash
docker compose up --build -d
```

Aprovisiona PostgreSQL + API en el puerto `8000`.

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

## Env vars

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `MRSUSHI_API_URL` | URL del backend Mr Sushi |
| `RAPPI_WEBHOOK_SECRET` | API key compartida con Mr Sushi |
| `RAPPI_JWT_SECRET` | Secreto para firmar JWT |
| `RAPPI_ADMIN_USER` | Usuario admin (default: admin) |
| `RAPPI_ADMIN_PASSWORD` | Password admin (default: admin123) |
