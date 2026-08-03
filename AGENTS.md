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
Optimización y limpieza: ejecutar Fases 1 y 2 del Auditoría Plan (bugs de correctitud + DRY Rust).

### Completed (this session)
- **Plan de optimización anotado** en AGENTS.md (6 fases, 20 ítems)
- **Fase 1 completa**:
  - Rate limit real: helpers `rate_limit_fail`/`rate_limit_success` (db.rs) + guards `admin_guard`/`employee_guard` (auth.rs: rate-limit check + lock_db + require_admin/require_employee + audit). Aplicado a create_sale, set_tasa, void_sale_items, void_sale, pay_debt, add_quick_debt, restore_backup, get_backup_key, clear_audit; comandos refactorizados (create_usuario, delete_usuario, reset_usuarios, admin_change_password, change_password, set_config_value)
  - Contadores reales en sync/products.rs (`updated`/`inserted` = filas afectadas)
  - Migraciones Result-based; no se marca versión en fallo; 002 idempotente
  - sync/users.rs ya NO sube hashes Argon2; download fuerza `password_change_required=1` con hash aleatorio (`random_password_hash`)
- **Fase 2 completa**:
  - Helpers SQL en db.rs: `get_config_value` (Option), `set_config_value`, `add_stock`, `sub_stock`; `fallback_total_bs` (helpers.rs). Refactorizados config.rs, sync/mod.rs, sales.rs, sync/sales.rs, cashier.rs, orchestrator.rs, tasa_bcv.rs
  - combos.rs: `row_to_combo`, `list_combos_inner`
  - Eliminado `PayDebtRequest.usuario_id` (models.rs + clients-view.js) y `ExportReportFilter` (export_report_xlsx usa `SalesReportFilter`)
  - Código muerto eliminado: `format_download_result`/`format_upload_result` (sync/mod.rs), constantes `CFG_OPENROUTER_*`, `CFG_INARI_ACTIVO`, `INARI_DIAS` (constants.rs), `#[allow(dead_code)]` de `ROL_VENDEDOR`
  - `DetalleVenta.costo` real (COALESCE p.costo) en get_cliente_history en vez de `0.0`
- **Tests**: 80 Rust + 66 vitest ✅
- **Fase 3 completa**:
  - Eliminadas constantes muertas `DROPDOWN` y `FONT.SIZE_MIN/MAX/DEFAULT` (queda `FONT.SIZE_STEP`); eliminado `SEL.soundToggleBtn`
  - Helpers compartidos en utils.js: `esRefPagoMovilValida`, `bsToUsd`, `getTasaConFallback` (reemplazan 3+ copias en cashier-view.js/clients-view.js); `buildReportFilter` en reports-view.js (filtro reporte 2 copias)
  - Migrados a SEL: `clientNombreError`, `creditosTotalPersonas`, `creditosConDeuda`, `creditosDeudaTotal`; app.js usa SEL para report dates; los getElementById restantes son dinámicos (params/data attrs)
  - Eliminados ids HTML sin uso: `historial-cierres-body`, `historial-cierre-detalle-title`, `sale-detail-bar`, `debt-detail-bar`, `user-management-card`, `dashboard-card`
- **Fase 4 completa**:
  - Eliminados duplicados exactos: `.compact .reports-filters`/`.compact .reports-filter-row` (2ª copia), `.payment-method-btn` `{padding:8px 4px;font-size:11px}` (muerta, la sobreescribe la siguiente), `.view.active.mobile-keyboard` (2ª copia), `.col-toggle-btn:hover` (2ª copia)
  - Resto de selectores repetidos revisados: son overrides responsive intencionales (media queries 768/600/480px), NO fusionados para no romper nada
  - CSS faltante aplicado: `.form-error` (error combo), `.toggle-row` (flex label+toggle), `.abono-saldo-restante`, `.top-product-info` (flex:1 en card), `.bs-price-cell` (white-space:nowrap), `.modal-content.resizing` (user-select:none)
  - Corregido comentario engañoso "2-col method grid" → "compact method grid"
- **Fase 5 completa**:
  - `PRAGMA busy_timeout=5000` en conexión principal (init_db) y secundaria (secondary_conn) → evita "database is locked" en sync paralelo
  - Helper `sumar_ventas_rango(db, start, end)` en cashier.rs: consolida la query duplicada `SQL_SUM_VENTAS_RANGE` en `obtener_totales_del_dia` y `get_dashboard_summary`
  - Eliminadas 5 llamadas redundantes `renderCartTabs()` tras `renderCart()` (cashier-view.js) — renderCart ya la invoca internamente
- **Tests**: 80 Rust + 66 vitest ✅

### Nuevas features (2026-08-02)
- **Backup diario automático** al cerrar caja: helper `do_backup` + `ensure_daily_backup` (db.rs, sin chequear admin), `close_cashier` lo invoca tras commit (una vez por día vía `CFG_ULTIMO_BACKUP_DIARIO`), resultado en `CloseReport.backup_msg` → toast en frontend
- **Ajuste manual de stock** con auditoría: comando `registrar_ajuste_stock` (products.rs, rate-limit + require_admin), delta +/-, motivo obligatorio, registra en `ajustes_stock` (sync_id, usuario) + auditoría. UI: "Ajustar stock" en dropdown del inventario (modal con cantidad/motivo)
- **Clientes temporales de crédito**: migración 029 (`clientes.es_temporal`, `clientes.created_at`, `clientes_eliminados`, `ajustes_stock.usuario`). `create_cliente(es_temporal)`, `pay_debt` elimina el temporal al saldar deuda (audit + historial `clientes_eliminados`), `delete_cliente` registra temporales eliminados manualmente, comando `list_clientes_eliminados`. Frontend: badge "Temporal", checkbox en modal de cliente, botón "Historial Temporales" en Crédito. Sync: los temporales NO se suben a Supabase
- **Verificado**: cargo check limpio, 80/80 Rust, 66/66 vitest, minify OK

### Active
- Nada en curso — features completadas y verificadas

### Next Move
- Opcional: añadir tests Rust de `eliminar_cliente_temporal`/`registrar_ajuste_stock` (requieren infraestructura de test con BD temporal); revisar que WAL no pierda datos en backups (copiar .db sin checkpoint previo).

---

## Auditoría Plan

### Fase 1 — Bugs de correctitud
1. Rate limiting inoperante: `check_action_rate_limit` (db.rs:20-36) solo lee, nunca incrementa. 9 comandos sin bloqueo real (create_sale, set_tasa, void_sale_items, void_sale, pay_debt, add_quick_debt, restore_backup, get_backup_key, clear_audit). Solo auth.rs/config.rs incrementan manualmente.
2. Contadores falsos en sync: sync/products.rs:233 `updated += 1` aunque el UPDATE falle o afecte 0 filas.
3. Migración frágil: `migrate_ventas_check_constraint` (migrations.rs:193-222) hace DROP+rebuild con `.ok()`; si falla, la versión queda marcada aplicada (INSERT schema_version:149 usa `.ok()`).
4. Seguridad: sync/users.rs:63 sube hash Argon2 de contraseñas a Supabase con anon key pública.

### Fase 2 — DRY Rust (deuda técnica)
5. Extraer guard unificado `admin_guard` (rate limit + require_admin/require_employee + audit): reemplaza 15 bloques (auth.rs:263,339,395,466,510; config.rs:27; sales.rs:351, etc.).
6. Helpers SQL: upsert configuracion (4 copias: config.rs:7, sync/mod.rs:98, sales.rs:338, tasa_bcv.rs:69); SELECT valor config (6 copias); stock +/- (4 copias: sales.rs:19/399/716, sync/sales.rs:371); fallback total_bs (3 copias: sales.rs:35, cashier.rs:340/382).
7. combos.rs: `Combo` se mapea 3 veces (96, 144, 208) y `list_combos`/`list_combos_simple` casi idénticos → `row_to_combo` + un list.
8. Eliminar campo muerto `PayDebtRequest.usuario_id` (models.rs:179) y struct redundante `ExportReportFilter` (models.rs:355).
9. Código muerto: `format_download_result`/`format_upload_result` (sync/mod.rs:149,161); constantes `CFG_OPENROUTER_API_KEY`, `CFG_OPENROUTER_MODEL`, `CFG_INARI_ACTIVO`, `INARI_DIAS` (constants.rs:47,49,75,77); quitar `#[allow(dead_code)]` espurio de `ROL_VENDEDOR` (constants.rs:55).
10. `DetalleVenta` con `costo: 0.0` hardcodeado (clients.rs:180) vs real (sales.rs:651) → unificar.

### Fase 3 — Limpieza frontend JS
11. Constantes muertas: `DROPDOWN` (constants.js:103), `FONT.SIZE_MIN/MAX/DEFAULT` (constants.js:104).
12. `SEL.soundToggleBtn` (constants.js:698) → id inexistente; corregir a `#sound-toggle` o eliminar.
13. Helpers compartidos: validación ref pago móvil (3 copias: cashier-view.js:712/619, clients-view.js:203); conversión Bs→USD (3 copias: clients-view.js:187/217/363); fallback tasa (2 copias: clients-view.js:216/362); filtro reporte (2 copias: reports-view.js:24-31 vs 689-694).
14. Migrar ~16 `document.getElementById`/strings fuera de `SEL` (inventory-view.js:170-178, app.js:134/856/1520, utils.js:590/648, cashier-view.js:453/606/934, views.js:263, clients-view.js:73-85/389-391).
15. ids HTML sin uso: `historial-cierres-body`, `historial-cierre-detalle-title`, `sale-detail-bar`, `debt-detail-bar`, `user-management-card`, `dashboard-card`.

### Fase 4 — CSS
16. Reglas duplicadas: `.compact .reports-filters`/`.reports-filter-row` (style.css:1267-1270 y 1523-1524); `.payment-method-btn` definida 3 veces (1656, 1657, 1764).
17. Pasada sistemática de deduplicación.

### Fase 5 — Performance y robustez
18. WAL ya activo (db.rs:54). Falta `PRAGMA busy_timeout` → riesgo "database is locked" al correr sync (secondary_conn) en paralelo.
19. `get_dashboard_summary` (cashier.rs:447-461) y `obtener_totales_del_dia` (cashier.rs:63-79) duplican `SQL_SUM_VENTAS_RANGE` → consolidar.
20. Revisar re-renders innecesarios del carrito (`renderCart()` en cadena).

### Estado de ejecución
- **Fase 1 + 2 + 3 + 4 + 5**: ✅ completadas
