# Gestor de Ventas

## Stack
- **Frontend**: HTML/CSS/JS vanilla + Font Awesome 6 Free (Nerd Font icons `.nf-fa-*`)
- **Backend**: Tauri v2 + Rust + SQLite (rusqlite bundled)
- **Mobile**: Android via Tauri mobile (generated in `src-tauri/gen/android/`)
- **Windows**: NSIS installer (embedBootstrapper webview)

## Comandos importantes

### Desarrollo
```sh
npm run dev        # Minifica frontend + inicia servidor Tauri (Rust + frontend)
# F5 en frontend solo refresca HTML/JS/CSS (sin dev server, minificado)
# Para cambios en Rust, reiniciar npm run dev
# Para cambios en frontend JS/HTML/CSS, solo recargar F5 (dist/ se regenera)
```

### Build (producción)
```sh
npm run build      # Minifica frontend + compila Rust + empaqueta
```

### Frontend minification
- `scripts/minify.mjs` — usa esbuild para minificar JS/CSS + minificación simple de HTML
- Se ejecuta automáticamente en `beforeDevCommand` y `beforeBuildCommand`
- Salida en `dist/` (no versionado, generado automáticamente)
- Fuente original en `src/` (editar aquí, se regenera al hacer build/dev)
- `fa-local.css` se copia sin modificar (necesita el `@font-face` intacto)

### Android
```sh
npm run tauri android init              # (una vez) Genera proyecto Android
npm run tauri android dev               # Compila y corre en emulador/dispositivo
npm run tauri android build             # Genera APK/AAB firmado
```

### Windows build
```sh
npm run tauri build                     # Genera instalador NSIS en src-tauri/target/release/bundle/
```

### Testing
```sh
cd src-tauri && cargo test --lib        # 80 tests (auth, config, sales, sync, clients, cashier)
cd src-tauri && cargo check             # Verifica compilación Rust
node --check src/*.js && node --check dist/*.js   # Verifica JS (src y minificado)
```

## Estructura del proyecto

### `src-tauri/`
- `tauri.conf.json` — Config principal (ventana 1200x800, min 900x600, identifier `com.gestor-ventas.app`)
- `Cargo.toml` — Dependencias Rust
- `src/lib.rs` — Registro de comandos Tauri
- `src/models.rs` — Structs compartidos (Venta, Producto, DetalleVenta, etc.)
- `src/db.rs` — Conexión SQLite, `AppState`, backup
- `src/sales.rs` — Ventas, reportes, anulación, histórico, export XLSX
- `src/cashier.rs` — Caja, cierres, dashboard summary
- `src/products.rs` — CRUD productos, list_products con paginación
- `src/auth.rs` — Login, cambio password, admin_change_password
- `src/config.rs` — Configuraciones (tasa, sonido, temas, etc.)
- `src/migrations.rs` — Migraciones 001 a 013
- `src/tasa_bcv.rs` — Fetch BCV, check_tasa_update
- `src/audit.rs` — Auditoría
- `src/clients.rs` — Clientes/crédito/abonos
- `src/sync.rs` — Supabase sync (upload_products, download_products, upload_sales, download_sales, register_device)
- `src/constants.rs` — Constantes (métodos de pago, config keys)

### `src/` (frontend)
- `app.js` — Lógica principal frontend (~1520 líneas, eventos globales, init)
- `views.js` — Login, logout, navegación, guía, calculadora (694 líneas)
- `cashier-view.js` — Caja POS: carrito, tasa, productos recientes (1068 líneas)
- `config-view.js` — Configuración, auditoría, temas (241 líneas)
- `inventory-view.js` — Inventario, productos, combos Inari
- `clients-view.js` — Clientes, créditos, abonos (363 líneas)
- `constants.js` — Constantes, `SEL` (objeto de selectores DOM), config keys (615 líneas)
- `utils.js` — Utilidades: `qs`, `showToast`, `invoke`, `confirmModal`, `initTableSorting`, `initConnectionMonitor` (635 líneas)
- `style.css` — Estilos con temas (oscuro, claro, azul, verde, morado, turquesa, naranja, rubí)
- `index.html` — HTML único con todas las vistas y modales
- `fa-local.css` — Iconos Font Awesome 6 Free autogenerados

## Base de datos
- Archivo: `gestor_ventas.db` (SQLite, se crea automáticamente)
- Backup: botón en Config → `backup_database` copia a `gestor_ventas_backup_YYYYMMDD_HHMMSS.db`
- Migraciones en `migrations.rs` (019 actual: `password_change_required` en `usuarios`, `sync_id`/`updated_at` en `clientes`, `updated_at` en `productos`, tabla `conflictos`, `ajustes_stock`)
- Backups cifrados con AES-256-GCM, clave almacenada en config (`backup_key`)

## Supabase Sync
- Proyecto: `https://xryvxaslbtouihbulonw.supabase.co`
- Tablas: `dispositivos`, `categorias`, `productos`, `clientes`, `ventas`, `detalles_ventas`
- Anon key: `sb_publishable_3XXhx5ktfhrUvngJDYAQAA_xPCRMFzh`
- **Dispositivo registrado**: PC Jotapemece (`d093e594-8745-4dca-b97a-f7851c62cb65`)
- **Upload productos**: sube categorías + productos activos locales a la nube (upsert por `codigo`)
- **Upload ventas**: sube ventas con `sync_id` y `updated_at > ultimo_upload_ventas` + sus detalles (upsert por `sync_id`)
- **Download productos**: descarga productos con `updated_at > ultimo_download`; **NO sobrescribe `stock`** en productos existentes (stock se deriva de ventas/eventos, no de snapshots absolutos)
- **Download ventas**: descarga ventas de OTROS dispositivos (`dispositivo_origen ≠ local_id`), INSERT OR IGNORE por `sync_id`, y decrementa stock local por cada unidad vendida remotamente
- El download de ventas NO filtra por fecha — descarga **todas** las ventas remotas desde `ultimo_download_ventas`. Es correcto porque stock se deriva de TODAS las ventas de todos los dispositivos, sin importar la fecha
- Los `sync_id` se usan como PK en Supabase (`ventas.id = sync_id`) para que `detalles_ventas.venta_id` referencie correctamente
- Tabla `detalles_ventas` en Supabase: `id (UUID), venta_id (UUID FK), local_id (int), producto_codigo, cantidad, precio_usd_unitario, anulado, sync_id (UUID), updated_at`
- Timestamps separados: `ultimo_upload`, `ultimo_download`, `ultimo_upload_ventas`, `ultimo_download_ventas` en `configuracion`
- Cada nueva venta recibe un UUID (`sync_id`) y almacena `dispositivo_origen`
- `void_sale` y `void_sale_items` actualizan `updated_at` para propagar anulaciones
- Config URL/Key almacenadas en config local (`supabase_url`, `supabase_key`)
- Registro de dispositivo vía `register_device` → guarda `dispositivo_id` en config local

## Paginación
- Inventario: `list_products(search, page, page_size)` → `PaginatedResult<Producto>`
- Frontend: `inventoryPage` (1), `INVENTORY_PAGE_SIZE` (50), controles Anterior/Siguiente
- Búsqueda resetea a página 1

## Chartas Dashboard
- Toggle Barras/Pastel en `#dashboard-card`
- **Barras**: Ventas y USD agrupados por período (Hoy, 7 días, Mes), animación ease-out
- **Pastel**: Distribución por método de pago, con toggle día/semana/mes, animación ease-out
- Tooltips al hover sobre barras/porciones

## Componentes UI
- Modales con clase `.modal`, `.modal-content`, `.modal-lg`
- Botones: `.btn`, `.btn-primary`, `.btn-outline`, `.btn-danger`, `.btn-accent`, `.btn-sm`
- Tablas: `.table` (responsive con `.table-container`)
- Toggles: `.toggle-switch`, `.toggle-slider`
- Cards colapsables: `.config-card-header` con `.collapsed`
- Dropdown: `.dropdown-btn` + `.dropdown-menu` (fixed positioning)
- Empty state: `emptyState(icon, title, desc)`

## Convenciones
- Las vistas son `<section class="view" id="view-{name}">`
- `showView('{name}')` activa/desactiva vistas
- Los IDs de elementos se definen en `const SEL = { ... }` en constants.js
- Todos los selectores DOM estáticos deben estar en `SEL`; usar `qs(SEL.xxx)` no `document.getElementById(...)`
- `escapeHtml()` para todo texto insertado como HTML (XSS)
- `invoke('comando', { arg })` para llamadas Tauri
- `productCache` se usa en Caja para búsqueda de productos; refrescar con `loadProductCache()` tras descargar productos/ventas
- `showToast(msg, type)` para notificaciones
- `confirmModal(text, title, confirmLabel)` para confirmaciones
- `playSound('add'|'remove')` para sonidos

## Enar — Asistente IA integrado (chat)

Enar es un asistente tipo zorro integrado como FAB flotante. Se comunica con OpenRouter API.

### Config
- **API Key**: `openrouter_api_key` en `configuracion` (configurable en Config → IA).
- **Model**: `openrouter_model` (default `openrouter/free`).
- **Toggle**: `ia_habilitado` en config, oculta/muestra el FAB.

### Cómo funciona
1. Usuario abre el chat (FAB flotante, arrastrable con persistencia en localStorage).
2. Al enviar mensaje, `handleChatSend()` (views.js) recolecta **10 llamadas paralelas** a Tauri para contexto: productos, tasa, caja, ventas hoy, métodos de pago, dashboard, top productos, stock bajo, clientes con deuda.
3. Construye `CHAT_SYSTEM_PROMPT` con esos datos y lo envía a `openrouter::chat_with_ai` (openrouter.rs).
4. Backend envía POST a `https://openrouter.ai/api/v1/chat/completions` con `frequency_penalty: 1.0`, `reasoning.max_tokens: 0`.
5. La respuesta se renderiza con Markdown (bold, italic, code, line breaks) y botón "Copiar".
6. Chat history `chatHistory[]` en memoria (se pierde al recargar).

### Contexto que Enar recibe
- Productos activos (20), tasa, caja abierta/cerrada, categorías, ventas de hoy, métodos de pago, dashboard (hoy/semana/mes), top 3 productos, stock bajo (top 5), clientes con deuda (top 5).

### Capacidades
- **Solo lectura**: no ejecuta comandos Tauri de escritura.
- **Órdenes de compra**: botón "Generar orden de compra" → `generate_purchase_suggestion` (openrouter.rs) que consulta productos con `stock < stock_minimo` y pide una tabla al AI.
- **Prompts rápidos**: "Stock bajo", "Ventas hoy", "Deudas".
- **Modo expandido**: el panel puede agrandarse a 520×600px.
- **Tema oscuro**: tiene overrides específicos para sombras del FAB.

### Archivos clave
- `src/views.js:476` — `CHAT_SYSTEM_PROMPT` (prompt del sistema)
- `src-tauri/src/openrouter.rs` — `chat_with_ai`, `generate_purchase_suggestion`, `ChatMessage`
- `src/constants.js` — `CFG_IA_HABILITADO`, `CFG_OPENROUTER_API_KEY`, `CFG_OPENROUTER_MODEL`
- `src/index.html` — FAB, chat panel, suggestion modal, configuración IA

## Android build
- SDK mínimo: 24 (Android 7.0)
- Generado automáticamente por `tauri android init`
- APK/AAB: `src-tauri/gen/android/app/build/outputs/`
- Requiere: Android SDK, NDK, Java 17+, Gradle 8.x
- Para build release se necesita un keystore

### Keystore / Firma
- Archivo: `src-tauri/release-key.keystore` (ya existe en el repo)
- Alias: `gestor-ventas` (por defecto)
- Password: preguntar al usuario (no está en el repo)
- Configurar en `tauri.conf.json` o en `gen/android/app/build.gradle.kts`:
  ```kotlin
  android {
      signingConfigs {
          create("release") {
              storeFile = file("../../release-key.keystore")
              storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: "password_aqui"
              keyAlias = "gestor-ventas"
              keyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: "password_aqui"
          }
      }
  }
  ```

### Variables de entorno recomendadas (para CI / evitar keys en repo)
```sh
export ANDROID_KEYSTORE_PASSWORD="tu_password"
export ANDROID_KEY_PASSWORD="tu_password"
```

### Comandos Android
```sh
# Inicializar (una vez)
npm run tauri android init

# Desarrollo (compila y corre en emulador)
npm run tauri android dev

# Build release (APK firmado)
npm run tauri android build

# Build release con config personalizada
ANDROID_KEYSTORE_PASSWORD="pass" ANDROID_KEY_PASSWORD="pass" npm run tauri android build
```

### Requisitos del sistema para Android
- **Java 17+** (OpenJDK)
- **Android SDK** (30+)
- **Android NDK** (25+)
- **Gradle** (wrapper incluido en gen/android/)
- **Rust targets**: `rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android`

### macOS / iOS (futuro)
- Tauri v2 soporta iOS vía `npm run tauri ios init`
- Requiere Xcode 15+, macOS 14+

## Sync Plan (próximas fases)

### Fase 4 — Sincronización de Clientes ✅
- **upload_clientes** (`sync.rs`): sube todos los clientes locales a Supabase (tabla `clientes`, upsert por `sync_id`). Genera UUID (`sync_id`) automáticamente para clientes existentes que no tengan uno
- **download_clientes** (`sync.rs`): descarga clientes con `updated_at > ultimo_download_clientes`, INSERT OR IGNORE por `sync_id`
- **Migration 015**: agrega `sync_id TEXT UNIQUE` y `updated_at TEXT` a `clientes` local
- **Cliente model**: nuevos campos `sync_id: Option<String>`, `updated_at: Option<String>`
- **UUID generation**: `create_cliente` y `update_cliente` generan UUID y setean `updated_at`
- Botones en Config → Sincronización: Subir clientes / Descargar clientes
- **Supabase SQL necesario**: `ALTER TABLE clientes ADD COLUMN sync_id TEXT UNIQUE; ALTER TABLE clientes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW(); ALTER TABLE clientes ADD COLUMN local_id BIGINT;`

### Fase 5 — Sincronización de Ventas
- **upload_ventas**: sube ventas con `updated_at > ultimo_upload` + sus detalles (tablas `ventas`, `detalles_ventas`)
- **download_ventas**: descarga ventas de otros dispositivos con `updated_at > ultimo_download`
- **Control de duplicados**: `dispositivo_id + id local` como identificador único, o migración 014 con `sync_id TEXT UNIQUE`
- Botones en Config o integrado en sincronización general

### Fase 6 — Sync unificado con progreso
- **sync_all**: comando único que upload productos + clientes + ventas, luego download todo
- **Progreso**: evento Tauri `sync-progress` emitido durante la operación (paso actual, %)
- **Barra de progreso** en frontend (modal/overlay)
- **Resumen**: "X productos subidos, Y clientes descargados, Z ventas subidas"
- Botón "Sincronizar todo" como acción principal, botones individuales como avanzados

### Fase 7 — Sync automático
- **Intervalo configurable**: campo en Config ("Sync automático cada X minutos", 0 = desactivado)
- **setInterval** en frontend que llama a `sync_all` en background
- **Notificación**: badge o toast al completar auto-sync
- **Indicador**: mostrar última sincronización en tiempo real

### Fase 8 — Resolución de conflictos ✅
- **Last-write-wins** por defecto: al descargar productos/clientes, si no hay conflicto la versión remota más reciente gana
- **Detección**: si mismo item fue modificado local y remotamente después del último sync, y los `updated_at` están a menos de 5 min de diferencia → se marca como conflicto
- **Tabla `conflictos`** local: almacena `local_json` y `remote_json` del item en conflicto
- **Comandos**: `get_conflictos` (lista no resueltos), `resolve_conflicto(conflicto_id, use_remote)` (aplica versión remota o mantiene local)
- **Migration 016**: agrega `updated_at` a `productos` y crea tabla `conflictos`
- **Frontend**: contador de conflictos en Config → Sincronización, botón "Ver conflictos" que abre modal con tabla de diferencias campo por campo y botones "Mantener local" / "Usar remoto"

### Fase 9 — Multi-dispositivo completo
- **Asignación de ventas**: asociar cada venta a un dispositivo (`dispositivo_id`)
- **Dashboard global**: reportes con ventas de todos los dispositivos
- **Inventario consolidado**: stock unificado (último que sube gana)
- **Roles de dispositivo**: maestro (sync completo) vs esclavo (solo lectura/comparte ventas)

---

## Work State

### Objective
Auditoría: race conditions, selectores SEL, paginación, rate limiting, contraseñas por defecto.

### Completed (this session)
- **Race conditions**: `delete_product`, `create_sale`, `void_sale`, `change_password` ahora envuelven read+write en transacciones (products.rs, sales.rs, auth.rs)
- **SEL selectors**: agregados 9 IDs + 2 selectores a `SEL` en constants.js; migrados todos los `document.getElementById()` y `qs('...')` hardcodeados en app.js, utils.js, cashier-view.js, config-view.js, views.js, clients-view.js
- **list_sales pagination**: ahora acepta `page`/`page_size`, retorna `PaginatedResult<Venta>` (sales.rs)
- **Rate limiting**: `set_config_value` y `void_sale` protegidos con `admin_action_attempts` (config.rs, sales.rs)
- **Default password**: `reset_usuarios` crea admin con `password_change_required=1`; frontend activó handler forzando cambio de contraseña (auth.rs, views.js)
- **Tests**: 80 Rust passed, `cargo check` ✅, `node --check` ✅ en todos los JS

### Active
- (ninguno)

### Next Move
- Auditoría: DRY Rust (A2.5), SQL injection surface (A2.7), HTML templates inline (A2.9)
- Probar build Android / Windows

---

## Auditoría Plan

### Fase 1 — Integridad de datos (bugs)
1. Revisar cada `#[tauri::command]` con ≥2 writes — ¿en transacción? ✅ (create_product, create_sale, void_sale, pay_debt, delete_cliente, set_tasa, import_products, replace_all_products todos en transacción)
2. Stock inconsistencies: `void_sale` sync, doble descarga, stock negativo paths
3. Race conditions: read-then-write sin lock atómico ✅ (delete_product, create_sale, void_sale, change_password fijados con transacciones)
4. Error paths silenciosos: `unwrap()`, `.ok()`, `catch(_)` que traguen errores

### Fase 2 — Deuda técnica (normas)
5. DRY Rust: lógica repetida sales/clients/sync
6. Anti-hardcoding JS: strings remanentes ✅ (todos los `document.getElementById()` migrados a `qs(SEL.xxx)`)
7. SQL injection surface: `format!()` con input de usuario
8. Selectores DOM fuera de `SEL` ✅ (12 IDs + 2 selectores agregados a SEL, migradas todas las referencias)
9. HTML templates inline vs `<template>`

### Fase 3 — Performance
10. N+1 queries (reportes, historial) ✅ (no se encontraron N+1 significativos; reportes usan batch fetching, void_sale_items loop es pequeño y está en transacción)
11. Paginación faltante (list_sales) ✅ (list_sales ahora acepta page/page_size, retorna PaginatedResult<Venta>)

### Fase 4 — Seguridad
12. Rate limiting faltante (create_usuario, change_password) ✅ (ya tenían rate limiting via admin_action_attempts; se agregó a set_config_value y void_sale)
13. Default passwords: forzar cambio ✅ (reset_usuarios crea con password_change_required=1; frontend activó handler de cambio forzado)
