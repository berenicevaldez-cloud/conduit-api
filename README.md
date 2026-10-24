# Conduit API — Node.js + TypeScript

Implementación del backend de RealWorld Conduit, con autenticación y administración de artículos.

## Plan

Construir un corte vertical de autenticación y artículos siguiendo la especificación de RealWorld: validar las solicitudes, aplicar reglas de negocio, persistir los datos y devolver las respuestas y códigos HTTP esperados. Separar validaciones, lógica y acceso a datos, y verificar el comportamiento mediante pruebas propias y la colección oficial. Para ejecutar la colección completa sin modificarla, se incluyen también perfiles, seguimiento de usuarios, favoritos, feed, etiquetas y comentarios.

## Requisitos

- Node.js 22.20.0 o superior.
- npm.
- Hurl instalado y disponible en el PATH para ejecutar la colección oficial.

No se necesita instalar un servidor de base de datos. La aplicación utiliza SQLite.

## Instalación y configuración

Desde la carpeta del proyecto:

```powershell
npm ci
```

Crear el archivo de configuración:

```powershell
Copy-Item .env.example .env
```

Generar una clave secreta:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copiar el resultado en `JWT_SECRET` dentro de `.env`:

```dotenv
PORT=8000
DATABASE_PATH=data/conduit.sqlite
JWT_SECRET=colocar_aqui_la_clave_generada
```

La clave debe tener al menos 32 caracteres. El archivo `.env` es privado y está excluido de Git.

## Ejecutar la API

Modo desarrollo:

```powershell
npm run dev
```

Verificar el servidor:

```text
GET http://localhost:8000/health
```

Respuesta esperada:

```json
{
  "status": "ok"
}
```

Para compilar y ejecutar el código compilado:

```powershell
npm run build
npm start
```

Ejecutar un solo servidor a la vez en el puerto configurado.

Algunas versiones de Node.js muestran una advertencia indicando que SQLite es experimental. La advertencia no impide ejecutar la aplicación.

## Base de datos

La aplicación crea automáticamente el archivo:

```text
data/conduit.sqlite
```

Los datos permanecen después de reiniciar el servidor.

Las tablas son:

- `users`: usuarios y hashes de contraseñas.
- `articles`: artículos y sus autores.
- `follows`: relaciones de seguimiento entre usuarios.
- `favorites`: artículos favoritos de cada usuario.
- `comments`: comentarios de los artículos.

Se eligió SQLite por su persistencia y facilidad de ejecución, sin requerir un servidor adicional. Esto permite que el evaluador instale las dependencias y ejecute el proyecto con una configuración mínima.

## Estructura

| Archivo o carpeta | Responsabilidad |
|---|---|
| `src/server.ts` | Configuración, apertura de la base de datos y arranque del servidor. |
| `src/app.ts` | Rutas HTTP, lectura de autenticación y manejo centralizado de errores. |
| `src/validation.ts` | Esquemas Zod para validar entradas y parámetros. |
| `src/services.ts` | Reglas de negocio, permisos, contraseñas, tokens y representación de respuestas. |
| `src/data.ts` | Repositorio SQLite y sentencias SQL parametrizadas. |
| `src/errors.ts` | Errores controlados y sus códigos HTTP. |
| `test/api.test.ts` | Pruebas propias automatizadas. |
| `scripts/contract.mjs` | Ejecutor de la colección Hurl mediante Node.js. |
| `specs/openapi.yml` | Copia de la especificación OpenAPI utilizada. |
| `specs/hurl/` | Colección oficial sin modificaciones. |
| `specs/LICENSE` | Licencia de los recursos copiados de RealWorld. |
| `evidence/hurl-output.txt` | Resultado de la ejecución de las pruebas oficiales. |
| `.env.example` | Plantilla de configuración. |

## Funcionalidades

### Usuarios y autenticación

- Registro.
- Inicio de sesión.
- Consulta del usuario autenticado.
- Actualización del usuario autenticado.
- Hash de nuevas contraseñas con scrypt; compatibilidad con los hashes bcrypt existentes.
- Autenticación mediante JWT.

### Artículos

- Crear artículos.
- Listar artículos.
- Consultar un artículo por slug.
- Actualizar artículos.
- Eliminar artículos.
- Filtrar por autor, etiqueta o usuario que marcó favoritos.
- Paginar mediante `limit` y `offset`.
- Restringir la actualización y eliminación al propietario.

### Funcionalidades complementarias

Se implementaron para ejecutar la colección oficial completa:

- Consulta de perfiles.
- Seguir y dejar de seguir usuarios.
- Feed de artículos de usuarios seguidos.
- Marcar y desmarcar favoritos.
- Consulta de etiquetas.
- Crear, listar y eliminar comentarios.

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/users` | Registrar usuario. |
| POST | `/api/users/login` | Iniciar sesión. |
| GET | `/api/user` | Consultar usuario autenticado. |
| PUT | `/api/user` | Actualizar usuario autenticado. |
| GET | `/api/articles` | Listar artículos. |
| POST | `/api/articles` | Crear artículo. |
| GET | `/api/articles/:slug` | Consultar artículo. |
| PUT | `/api/articles/:slug` | Actualizar artículo. |
| DELETE | `/api/articles/:slug` | Eliminar artículo. |

Las operaciones protegidas requieren el encabezado definido por RealWorld:

```http
Authorization: Token <jwt>
```

## Decisiones técnicas

- Express para las rutas y el manejo HTTP.
- TypeScript con configuración estricta.
- Zod para validación de solicitudes.
- SQLite para persistencia local sin instalar un servidor.
- Consultas SQL parametrizadas.
- scrypt de Node.js para nuevas contraseñas, con sal aleatoria de 16 bytes, N=16384, r=8, p=1 y clave derivada de 64 bytes. El formato almacenado incluye una versión.
- bcrypt se conserva únicamente para verificar hashes anteriores; se rechazan entradas de más de 72 bytes en esa ruta para evitar truncamiento silencioso. Un usuario anterior con contraseña de más de 72 bytes necesitaría restablecerla; no se puede recuperar la parte que bcrypt descartó.
- JWT firmado con HS256 y expiración de un día.
- Clave de firma configurable mediante variables de entorno.
- Slugs con título y UUID para permitir artículos con títulos repetidos.
- Los listados omiten `body`, conforme a la especificación.
- `articlesCount` representa el total filtrado antes de aplicar paginación.
- Las pruebas propias utilizan SQLite en memoria para no modificar la base habitual.
- El contenido de artículos y comentarios se valida sin recortar sus espacios ni saltos de línea.
- Las solicitudes JSON mayores de 100 KB reciben HTTP 413 con un error estructurado.

## Pruebas propias

Ejecutar:

```powershell
npm test
```

Las cuatro pruebas originales se complementan con cuatro pruebas de regresión de contraseñas:

1. Un usuario no puede modificar ni eliminar artículos ajenos; el contenido original se conserva.
2. Los JWT inválidos y el JSON malformado producen errores controlados.
3. Las contraseñas se almacenan como hashes y su actualización cambia las credenciales válidas.
4. Los títulos repetidos generan slugs distintos; la paginación y la omisión de `body` funcionan correctamente.

5. Contraseñas que coinciden en sus primeros 72 bytes se distinguen al registrar y actualizar.
6. Contraseñas Unicode que superan 72 bytes conservan sus diferencias.
7. Las sales son aleatorias y los hashes almacenados malformados se rechazan.
8. Los usuarios bcrypt anteriores pueden iniciar sesión sin admitir truncamientos.
9. La creación y actualización de artículos conservan los espacios y saltos de línea del contenido.
10. Los comentarios conservan el formato de su contenido.
11. Los contenidos vacíos o compuestos solamente por espacios se rechazan.
12. Las solicitudes JSON que exceden 100 KB reciben una respuesta 413 y la API continúa disponible.
## Colección oficial Hurl

Instalación oficial:

https://hurl.dev/docs/installation.html

En Windows se puede instalar mediante:

```powershell
winget install hurl --source winget
```

Comprobar la instalación:

```powershell
hurl --version
```

Con la API ejecutándose, abrir otra terminal en la carpeta del proyecto y ejecutar:

```powershell
npm run test:contract
```

El script ejecuta todos los archivos `.hurl` sin modificaciones, de forma secuencial y utilizando identificadores distintos en cada ejecución.

La dirección predeterminada es `http://localhost:8000`. Se puede cambiar mediante `API_HOST`.

### Guardar evidencia en Windows

Desde PowerShell:

```powershell
cmd /c "npm run test:contract > evidence\hurl-output.txt 2>&1"
```

Inmediatamente después, verificar el código de salida:

```powershell
$LASTEXITCODE
```

El valor esperado es `0`.

Consultar el resultado guardado:

```powershell
Get-Content evidence\hurl-output.txt
```

Las pruebas oficiales crean usuarios y otros datos en la base de la API. Deben ejecutarse sobre una base de desarrollo o pruebas.

## Resultado verificado

Verificado localmente en Windows con Node.js 22.20.0 y Hurl 8.0.1:

| Verificación | Resultado |
|---|---|
| `npm run build` | Compilación TypeScript sin errores. |
| `npm test` | 12 pruebas aprobadas y 0 fallos. |
| `npm run test:contract` | 13 archivos aprobados, 154 peticiones y 0 fallos. |

La evidencia de Hurl está en `evidence/hurl-output.txt`.

También se verificó manualmente el registro, inicio de sesión y creación, consulta, actualización y eliminación de un artículo.

Pasar la colección oficial no demuestra todos los casos posibles de la especificación OpenAPI.

## Versión de la especificación

Repositorio oficial:

https://github.com/realworld-apps/realworld

Commit utilizado:

```text
ebbcdeb8d55b42a3a613c787560498b8ef10003f
```

Las copias de OpenAPI y Hurl corresponden a esa revisión.

Se verificó nuevamente la rama oficial mediante:

```powershell
git -C C:\Users\Berenice\realworld fetch origin
git -C C:\Users\Berenice\realworld rev-parse origin/main
```

El resultado coincidió con el commit utilizado.

Si la especificación cambia antes del envío, se deben revisar los cambios, actualizar los recursos correspondientes y repetir las pruebas.

## Desviaciones, ampliaciones y límites

- El alcance solicitado es autenticación y artículos. Se incluyeron funciones complementarias para ejecutar la colección oficial completa.
- No se modificaron los archivos Hurl para obtener resultados favorables.
- El tamaño máximo de las solicitudes JSON es de 100 KB y `limit` admite como máximo 1000. Estos límites defensivos no proceden de los casos oficiales revisados.
- El contenido de los artículos se almacena en una columna JSON. Es una simplificación del modelo de datos para el ejercicio.
- Los listados y filtros se procesan en memoria después de leer SQLite. Para mayores volúmenes se trasladarían a SQL con índices y paginación en la base.
- Algunas operaciones complementarias llaman directamente al repositorio desde las rutas; podrían trasladarse a servicios para uniformar la separación.
- No se incluyen refresh tokens, revocación individual de tokens, recuperación de contraseñas ni rate limiting.
- No se incluye frontend ni despliegue público.
- Para múltiples instancias y mayor concurrencia de escrituras se evaluaría PostgreSQL o SQL Server.

## Uso de IA

Se utilizó asistencia de IA para analizar la especificación, generar la implementación inicial, preparar pruebas y documentación, e identificar y corregir fallos.

La instalación y ejecución local en Windows, las pruebas manuales, la compilación y la ejecución de las pruebas automatizadas fueron realizadas por la candidata con asistencia de IA.

La IA se utilizó como herramienta de desarrollo; no forma parte de las funcionalidades de la API.

## Archivos excluidos de Git

El archivo `.gitignore` excluye:

- `.env`, que contiene la clave privada de firma.
- `node_modules/`, generado mediante `npm ci`.
- `dist/`, generado mediante `npm run build`.
- `data/` y archivos SQLite, que contienen datos locales.

El repositorio incluye `package-lock.json` para reproducir las versiones de las dependencias.
