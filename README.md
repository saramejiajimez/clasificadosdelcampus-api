# 35 · Clasificados del Campus — API (Next.js + Firebase Admin + Vercel Blob)

Backend REST construido con **Next.js (App Router, Route Handlers en runtime `nodejs`)**, **TypeScript estricto**, **Firebase Admin SDK (Auth + Firestore)**, **Vercel Blob** y **Zod**.

## 1.Variables de Entorno (Solo en Vercel)

Configure las siguientes variables de entorno exclusivamente en el panel de Vercel (nunca en el repositorio ni en la app móvil):

| Variable                | Descripción                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `FIREBASE_PROJECT_ID`   | ID del proyecto de Firebase                                 |
| `FIREBASE_CLIENT_EMAIL` | Correo de la cuenta de servicio de Firebase Admin           |
| `FIREBASE_PRIVATE_KEY`  | Clave privada de la cuenta de servicio (con `\n` literales) |
| `FIREBASE_WEB_API_KEY`  | Clave de API Web de Firebase (para mediar Auth REST API)    |
| `BLOB_READ_WRITE_TOKEN` | Token de lectura/escritura del store público de Vercel Blob |

## 2. Endpoints Implementados

### Salud

- `GET /api/health` — Estado del servicio.

### Autenticación (`9.1`)

- `POST /api/auth/registro` — Registro con correo y contraseña (`≥ 8` caracteres).
- `POST /api/auth/login` — Inicio de sesión.
- `POST /api/auth/refresh` — Renovación de ID token mediante `refreshToken`.
- `GET /api/auth/yo` — Datos del usuario autenticado a partir del Bearer token.

### Anuncios y Administración (`9.4`)

- `GET /api/anuncios?categoria=&cursor=` — Feed paginado (20 por página, `estado == 'activo'`, exige sesión).
- `POST /api/anuncios` — Crea un anuncio (valida máximo 5 anuncios activos por usuario → `409`, fotos en `usuarios/<uid>/` → `403`, teléfono colombiano `3XXXXXXXXX` y título 5–80 caracteres).
- `PATCH /api/anuncios/:id` — Marca anuncio como `"vendido"` (solo el dueño).
- `DELETE /api/anuncios/:id` — Elimina el anuncio y sus fotos en Vercel Blob (solo el dueño).
- `POST /api/anuncios/:id/reportar` — Crea reporte único en `anuncios/{id}/reportes/{uid}` e incrementa contador en transacción (`409` si ya reportó).
- `PATCH /api/admin/anuncios/:id` — Oculta un anuncio (`{ estado: "oculto" }`), requiere custom claim `rol = "admin"` (`403` si no).

### Sincronización de Favoritos (`9.3`)

- `GET /api/favorito?since=<ISO>` — Devuelve hasta 500 cambios (incluyendo borrados lógicos `deleted_at`) y `servidor_ahora`.
- `PUT /api/favorito/:id` — Crea o actualiza un favorito de forma idempotente.
- `DELETE /api/favorito/:id` — Borrado lógico (`deleted_at`).

### Imágenes con Vercel Blob (`9.5`)

- `POST /api/imagenes` — Sube imagen (`image/jpeg`, `image/png`, `image/webp` → `415` si otro; máx. 4 MB → `413`) bajo `usuarios/<uid>/<uuid>.<ext>`.
- `DELETE /api/imagenes?url=` — Elimina imagen propia (`403` si no pertenece a `usuarios/<uid>/`).

## 3. Comandos

```bash
npm run check   # tsc --noEmit + eslint + prettier + vitest --coverage
npm run build   # Compilación de producción de Next.js
npm test        # Ejecución de pruebas con Vitest
```
