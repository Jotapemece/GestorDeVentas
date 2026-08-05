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
cd src-tauri && cargo test --lib        # 90 tests (auth, config, sales, sync, clients, cashier, products)
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

### Guías de ejercicios (2026-08-05) — documentos .docx en la raíz (tarea lateral, no toca la app)
- **Archivos**: `Guia_Ejercicios_Primer_Semestre.docx` y `Guia_Ejercicios_Resueltos.docx` (originales, intactos; sus Nivel 4-5 ya fueron reemplazados por versiones simples tipo N3 en sesión anterior). Nuevos: `Guia_Ejercicios_2.docx` (copia del primero, retitulado, con ejercicios NUEVOS) y `Guia_Ejercicios_2_Resueltos.docx` (estructura del Resueltos —portada con índice en línea, temas en hoja nueva con título centrado, solo ejercicios resueltos sin "Herramientas/Fórmulas clave" ni "Ejemplos resueltos"— pero con los 15 ejercicios del doc2; portada "Guía de Ejercicios (simplificado)", 284 párrafos, 4 saltos de página conservados).
- **Plan aprobado para Guia_Ejercicios_2.docx** (estructura idéntica: portada, Contenido, intros, Herramientas/Fórmulas clave, ejemplos resueltos, 5 ejercicios por tema; dificultad corrida un escalón arriba). **2026-08-05**: aprobadas 6 sustituciones para diferenciarlo del doc1 (verificadas en el docx regenerado, 366 párrafos):
  - **Lineales**: N1 `5−(2x−3)=4x+2`→1 (menos delante del paréntesis) · N2 `(x+3)/2−(x−1)/4=3`→5 · N3 `√2(x−1)=4`→`1+2√2` (único con raíz, se queda aquí) · N4 `x/2−x/5=3+x/10`→15 (x fraccionario en ambos miembros) · N5 `(x−1)/4+(x+2)/3=x/2+1`→7 (x en ambos miembros y en fracciones)
  - **Cuadráticas** (solo factorización y fórmula general): N1 `x²−7x+12=0`→3,4 · N2 `3x²−10x−8=0`→factor. por agrupación (a≠1)→`−2/3`,4 · N3 `x(x−3)=10`→agrupar→5,−2 · N4 `x²+2x+5=0`→Δ=−16<0 **sin soluciones reales** · N5 `2x²−6x+1=0`→fórmula general **explícita** `x=(−b±√Δ)/2a`, Δ=28→`(3±√7)/2`
  - **Sistemas**: N1 `{x+2y=8;3x−y=10}` sust.→(4,2) · N2 `{4x+3y=5;2x−3y=−11}` reduc.→(−1,3) · N3 `{2x+y=1;x−y=5}` igual.→(2,−3) · N4 `{x+y=7;x−y=7}` (curioso: se restan, y=0)→(7,0) · N5 `{3x+2y=19;2x−3y=4}` reduc. doblando→(5,2)
  - **Ejemplos resueltos nuevos**: cuadráticas: discriminante `x²−6x+8=0` (Δ=4), factorización `x²+9x+20=0`; métodos: sustitución→(5,1), igualación→(6,2), reducción→(2,1)
- **Herramientas**: venv `/tmp/opencode/docxvenv` (python-docx), builders OMML en `/tmp/opencode/exercise_lib.py` (`r/frac/paren/sup/rad/om/system`, `p_*`, `parse_frag`), driver `/tmp/opencode/make_doc_2_final.py` (doc2; bloques `t1/t2/t3` importables, ejecución bajo `if __name__ == '__main__'`), driver `/tmp/opencode/make_doc_resueltos_2.py` (doc2 resueltos: copia Resueltos como base, reemplaza cuerpos de los 15 ejercicios con bloques del doc2 + párrafo vacío al final, retitula portada; `next_boundary` se detiene en saltos de página para no borrarlos). Patrón quirúrgico: copiar base → insertar bloques nuevos antes del anchor (orden inverso) → remover cuerpo viejo (por referencias, no índices).

### Objective
Implementar exportaciones por plataforma (Android → Descargas automático, escritorio → diálogo "Guardar como") y protección de modales críticos con confirmación al cerrar.

### Completed (this session)
- **Fase C — Corrección del sync** (2026-08-05): arreglado "cosas que no sincronizan" y "deudas que se sobrescriben".
  - **C1 — Timestamps UTC ISO**: migración `031_fix_timestamps_utc` (migrations.rs) convierte `updated_at` naive local (`datetime('now','localtime')`) de `productos`/`ventas`/`clientes`/`usuarios` a UTC ISO (`strftime('%Y-%m-%dT%H:%M:%fZ', datetime(col,'utc'))`), solo filas sin `T`/`Z` (idempotente). Actualizados los defaults `updated_at` de DDL nuevas a UTC strftime. Writers `updated_at` ya usaban `now_iso()` (solo los backfills 014/015/016/024 eran naive → ahora convertidos). Causa raíz: comparaciones `updated_at > watermark` rotas para filas naive (espacio < 'T').
  - **C2 — propagación de anulaciones** (sync/sales.rs): upload ahora sube el `anulado` REAL por detalle (antes hardcodeado a `0`). `download_sales_inner` reescrito para procesar TAMBIÉN ventas ya existentes (antes `INSERT OR IGNORE` + `continue` perdía anulaciones y avanzaba el watermark sin aplicarlas). Reconciliación por **transición idempotente** (helper puro `anulado_delta`): stock se restaura/sustrae solo cuando el estado local difiere (activo→anulado restaura, anulado→activo sustrae), venta anulada implica sus ítems anulados; sincroniza `total_usd/total_bs/nota_anulacion/anulada` y avanza `ULTIMO_DOWNLOAD_VENTAS` solo tras aplicar.
  - **C3 — upload productos incremental + tombstones** (sync/products.rs): ya NO sube todos los activos con `updated_at=ahora`; filtra `updated_at > ultimo_upload` incluyendo `activo=0` (borrados lógicos viajan). `SQL_SOFT_DELETE` y `replace_all_products` ahora bumpean `updated_at` (UTC) para que la desactivación se propague.
  - **C4 — deudas LWW por fecha + upload clientes incremental** (sync/clients.rs): upload ya no sube todos los clientes cada vez (solo `updated_at > ultimo_upload_clientes` + los sin sync_id); download solo sobrescribe si `remote.updated_at > local.updated_at` (LWW por timestamp). Conflictos siguen en ventana de 5 min.
  - **C5 — parse_ts** con hora local para naive (conflicts.rs): `NaiveDateTime` se interpreta como `Local` (no UTC) hasta que 031 los elimine.
  - **Tests**: +8 Rust (5 `anulado_delta` en sync/sales.rs, 2 migración 031, 1 parse_ts roundtrip local) → **98/98** `cargo test --lib`, `cargo check` OK.
- **Fase B — Correctitud dinero/stock** (2026-08-05): los hallazgos CRÍTICOS de dinero/stock de la auditoría 2026-08-04 quedan corregidos.
  - **B1 — Combos vendibles**: `resolver_linea_venta` (sales.rs) detecta códigos `COMBO-N` y resuelve contra `combos`/`combo_productos` (precio del combo, componentes con su es_inari). Al vender un combo se descuenta stock de sus componentes no-inari (`cantidad_componente × cantidad_combo`). Migración **032_drop_detalles_producto_fk** (migrations.rs) recrea `detalles_ventas` SIN `FOREIGN KEY(producto_codigo)` (permite líneas `COMBO-N` que no existen en `productos`) y con `cantidad REAL` (idempotente: verifica `sqlite_master`). El error de FK al insertar detalle de combo desaparece.
  - **B2 — void_sale sin restauración doble/inari**: restaura solo ítems `(anulado IS NULL OR anulado = 0)` y `COALESCE(p.es_inari,0) = 0`; para líneas `COMBO-N` restaura stock de los componentes no-inari. Antes restauraba TODOS los ítems (doble restauración) y los inari que nunca decrementaron.
  - **B3 — void_sale_items revierte deuda**: `recalculate_sale_after_void` lee `old_total_usd` ANTES de recalcular; si `remaining == 0` y la venta era `credito`, revierte `saldo_deuda_usd` del cliente (`MAX(0, saldo - old_total)`). Antes anular todos los ítems dejaba la deuda intacta.
  - **B4 — cantidades fraccionarias**: void_sale y void_sale_items leen `cantidad` como `f64` (antes i64, truncaba pesables); sync/sales.rs sube `cantidad` como f64 y descarga con `as_f64` (antes `as_i64`); contadores `items_restored`/`items_consumed` ahora f64. La columna `detalles_ventas.cantidad` es REAL desde 032.
  - **B5 — validación total_bs_ingresado**: no se puede subreportar el total en Bs. (`bs < total_usd*tasa - tolerancia` → error; tolerancia = `max(1.0, esperado*0.01)`). Se permite pagar de más (recibir vuelto). Antes un cliente podía fijar Bs. 0.01 en una venta de $100.
  - **B6 — reportes excluyen anuladas + saldo**: `get_sales_by_vendor` cuenta solo `anulada = 0` (`COUNT(CASE WHEN anulada=0 THEN 1 END)`); `SQL_LIST_DIARIAS` (get_daily_summary) agrega `AND v.anulada = 0` (antes listaba anuladas junto a totales que las excluyen); `get_saldo_caja` calcula `ventas_bs` con fallback por fila (`CASE WHEN total_bs > 0 THEN total_bs ELSE total_usd*tasa_aplicada END`). `get_sales_report_inner` ya filtraba `anulada = 0`.
  - **B7 — WAL checkpoint**: `do_backup` (db.rs) ejecuta `PRAGMA wal_checkpoint(TRUNCATE)` antes de copiar la BD (antes `std::fs::copy` podía perder transacciones del `-wal`).
  - **Tests**: +10 Rust (1 migración 032, 9 en sales.rs: resolver producto/combo/combo inexistente, venta de combo resta componentes, combo stock insuficiente, total_bs menor rechazado, pago de más aceptado, void total revierte deuda, void parcial no la revierte) → **108/108** `cargo test --lib`, `cargo check` OK.
  - **Plugin Tauri nuevo**: `src-tauri/plugins/gestor-downloads/` (package `com.gestorventas.downloads`). Comandos `save_to_downloads` (Descargas) y `save_to_path` (ruta arbitraria). Desktop: decode base64 + `sanitize_name` a `download_dir()`/ruta. Android: MediaStore.Downloads (API ≥29 con `IS_PENDING`+`VOLUME_EXTERNAL_PRIMARY`, sin permisos) y escritura directa a `DIRECTORY_DOWNLOADS` en API <29. Kotlin `ExamplePlugin.kt`; CLI corregido (package antes malformado).
  - **App conectada al plugin**: `.plugin(tauri_plugin_gestor_downloads::init())` en lib.rs, dependencia en Cargo.toml, `gestor-downloads:default` en `capabilities/default.json`, módulo Gradle en `gen/android/tauri.settings.gradle` + `app/tauri.build.gradle.kts`.
  - **Nuevo comando Rust** `backup_database_b64` (db.rs): backup cifrado en temp → `{file_name, base64}` para Android (registrado en lib.rs).
  - **Frontend**: helper `saveExportedFile(fileName, data)` (utils.js): base64 o Blob; Android `plugin:gestor-downloads|save_to_downloads` → Descargas; escritorio `plugin:dialog|save` (nombre editable) → `save_to_path`. Aplicado a productos XLSX (inventory-view), reporte XLSX, PDF, chart PNG (reports-view) y botón Respaldar BD (app.js: `backup_database_b64` en Android, `save` dialog + `backup_database` en escritorio). Toasts según plataforma.
  - **Modales**: `PROTECTED_MODALS` (payment, product, client, abono, combo, quick-debt, stock-adjust) en handler de backdrop (app.js): click fuera → `confirmModal` "¿Seguro que quieres cerrar?"; si no se confirma, `showModal(m)` restaura el modal. El resto cierra directo.
- **Verificado**: `cargo check` desktop y `--target aarch64-linux-android` (con NDK CC/AR env), Kotlin del plugin compila (`gradlew :tauri-plugin-gestor-downloads:compileDebugKotlin`), 90/90 Rust, 63 vitest, `node --check` + minify OK.
- **Inari en ventas por días**: helper `inariVisibleEnVentas()` (inventory-view.js) = día ∈ jueves-domingo `INARI_DIAS` O toggle manual `inari_activo` (flag `inariManualActivo`, se setea en `applyInariConfig` de app.js). El módulo de ventas (cashier-view.js) filtra productos `es_inari` y combos en búsqueda/favoritos/recientes cuando `inariVisibleEnVentas()` es false.
- **Snake ASCII (solo PC)**: `src/snake.js` (nuevo): juego "Snake" con gráficos ASCII renderizados en `<pre>`. Lógica pura (`snakeCreate/snakePlaceFood/snakeStep/snakeRender`) separada de la integración DOM. Grid 20×12 con paredes, velocidad base 140ms que baja con la longitud. Acceso desde la Guía rápida (nuevo tab "Juego" `data-section="juego"` + `#guide-juego` con botón `#snake-btn`, se oculta en Android vía `IS_ANDROID`). Modal `#snake-modal`, teclado capture+stopImmediatePropagation (Flechas/WASD, P/Espacio pausa, R/Enter reiniciar), guard en `snakeDoTick` si el modal se cierra por otra vía. SEL de snake en constants.js, estilos `.snake-*` en style.css, `initSnake()` llamada en views.js. Tests: 75 vitest (12 nuevos de lógica pura).
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

### Auditoría profunda 2026-08-04 — hallazgos registrados, fixes NO aplicados
- **Alcance**: ~21.000 líneas auditadas (6.800 Rust + 14.000 JS/HTML/CSS) + plugin gestor-downloads. Hallazgos de agentes explore (núcleo/dominio Rust) + auditoría manual bash; cada claim verificado (cruces de comandos Tauri, XSS, selectores, iconos, sync).
- **Bien (no re-auditar)**: cero inyección SQL (`params!`); 99 comandos registrados en lib.rs (1 desajuste); migraciones idempotentes + no marcan versión en fallo; AES-256-GCM backups; guards `admin_guard`/`employee_guard`; sync users NO sube hashes Argon2; 90 Rust + 84 vitest OK.
- **CRÍTICOS (dinero/seguridad)**:
  1. **Combos no vendibles**: frontend envía `codigo='COMBO-N'` y el backend busca en `productos` → "Producto no encontrado" (sales.rs:106-110, cashier-view.js:215).
  2. **`es_inari` del cliente salta stock**: `create_sale` lee `es_inari` del request y omite control/descenso de inventario (sales.rs:111,159-165 + models.rs:157) → inventario gratis con cliente manipulado.
  3. **`register_movimiento` sin auth ni rol**, con `usuario_id`/`username` falsificables y montos negativos (cashier.rs:532).
  4. **`set_tasa` sin auth** (solo rate-limit) (sales.rs:326).
  5. **`get_config_value` sin auth** expone `supabase_key`, `openrouter_api_key` y `backup_encryption_key` (config.rs:5).
  6. **Sync (19 comandos) sin auth**: `upload_all`, `download_all`, `resolve_conflicto` (muta BD) funcionan sin login (sync/*).
  7. **`create_sale` atribuye la venta al `usuario_id` del request** (autoría forjable) (sales.rs:143,222).
  8. **Anulaciones remotas no se propagan**: download usa `INSERT OR IGNORE` sin UPDATE → `anulada=1` nunca se aplica a filas existentes (sync/sales.rs:279-305).
  9. **`void_sale` restaura stock doble** (items ya anulados) y de items inari que nunca lo decrementaron (sales.rs:394-406).
  10. **Anular todos los items no revierte la deuda a crédito** (sales.rs:844-897).
  11. **Cantidades fraccionarias truncadas a `i64`** al anular/sync → pérdida de stock en pesables (sales.rs:402,830 + sync/*).
  12. **Upload productos sobrescribe a ciegas** (updated_at=ahora para todo, sin chequeo de versión) y **no sube borrados** (solo `activo=1`) (sync/products.rs:45-84).
  13. **`change_password` exige rol admin** → vendedor no puede cambiar su propia clave (auth.rs:372).
  14. **`admin_change_password` sin validar `PASSWORD_MIN_LENGTH`** (auth.rs:429).
  15. **`pay_debt`/`add_quick_debt` sin guard de rol** (solo rate-limit) (clients.rs:252,381).
  16. **Backup WAL sin checkpoint** → riesgo de perder transacciones del `-wal` (db.rs:385).
  17. **`get_sales_by_vendor` cuenta ventas anuladas** (sales.rs:745).
  18. **`total_bs_ingresado` arbitrario del cliente** (puede fijar Bs=0.01 en venta de $100) (sales.rs:131-138).
  19. **`get_saldo_caja` mezcla total_bs crudo sin `fallback_total_bs`** (cashier.rs:568-578).
  20. **`save_to_path` escribe ruta arbitraria** sin sanitizar (gestor-downloads desktop.rs:66-77).
  21. **`get_backup_key` entrega la clave maestra de descifrado** al frontend (db.rs:496-508).
- **MEDIOS**:
  - **XSS**: `clients-view.js:120` inyecta `p.producto_nombre` sin `escapeHtml` en el detalle de deuda; `escapeHtml` (utils.js:2) no escapa `'`.
  - **Comando roto**: `shortcuts.js:117` invoca `list_clients_simple` NO registrado en lib.rs → búsqueda global de clientes falla silenciosa siempre.
  - **3 iconos sin glifo** en fa-local.css: `nf-fa-image` (reports-view.js:148), `nf-fa-chart_line` (reports-view.js:190), `nf-fa-rotate_left` (index.html:243).
  - `historial_tasas` con `INSERT OR REPLACE` por fecha **pierde tasas intra-día**.
  - `get_daily_summary` lista ventas anuladas junto a totales que las excluyen.
  - `migrations.rs:216-239`: DROP+rebuild puede dejar `PRAGMA foreign_keys=OFF` a mitad; migraciones no-op 022/023 registradas como aplicadas.
  - Login retiene el mutex de DB durante Argon2 (DoS latencia); lockout con usernames inexistentes (DoS); deadlock teórico por orden de locks (`products.rs:150` vs `auth.rs:434`).
  - `conflicts.rs:7-15`: `parse_ts` trata timestamps locales sin TZ como UTC → ventana de conflicto desviada.
  - Sync clientes sobrescribe `saldo_deuda_usd` (LWW) sin tratarlo como conflicto (riesgo financiero).
  - PDF: acentos en mojibake (pdf.rs WinAnsi vs UTF-8).
- **BAJOS/deuda técnica**: query de costos duplicada 4×; lógica de períodos duplicada 2×; `format_metodo_label` trivial; `temp_dir` fijos en `import_products_from_db`; `.ok()` en paths críticos; `reset_usuarios` deja sesión fantasma; `ensure_daily_backup` no atómico.
- **Plan de remediación (pendiente, NO aplicado)**:
  - **Fase A — Seguridad**: guard auth en `get_config_value` (bloquear claves sensibles); `register_movimiento` con `admin_guard` + derivar usuario de sesión; `set_tasa`/`pay_debt`/`add_quick_debt` con guards; sync mutaciones con `admin_guard`; `change_password` sin exigir admin + `admin_change_password` validando longitud; `create_sale` ignora `usuario_id` del request y lee `es_inari`/`es_pesable` de la DB; sanitizar `save_to_path`; restringir `get_backup_key`; XSS `clients-view.js:120`.
  - **Fase B — Correctitud dinero/stock**: combos resueltos contra `combos`/`combo_productos` (restar stock de componentes); `void_sale` filtra `anulado=0` y no restaura inari; `void_sale_items` revierte deuda al anular todo; cantidades como REAL/f64; validar `total_bs_ingresado` (tolerancia vs `total_usd*tasa`); filtrar anuladas en reportes; `wal_checkpoint(TRUNCATE)` en backup. **✅ APLICADO (2026-08-05)** — ver "Fase B — Correctitud dinero/stock" en Completed.
  - **Fase C — Sync**: UPDATE en anulaciones remotas; upload solo lo modificado + tombstones; `parse_ts` con zona horaria; `saldo_deuda_usd` como candidato a conflicto. **✅ APLICADO (2026-08-05)** — ver "Fase C — Corrección del sync" en Completed.
  - **Fase D — Frontend menor**: registrar `list_clientes` para búsqueda global; añadir 3 glifos FA.
- **Estado**: registrado 2026-08-04; Fases B y C aplicadas 2026-08-05; pendientes A, D.

### Active
- **Fase B del sync aplicada** (2026-08-05): 108/108 `cargo test --lib`, `cargo check` desktop OK. Cambios Rust → reiniciar `npm run tauri dev` (F5 solo recarga frontend).
- **Pendiente por probar en vivo (Fase B)**: 
  1. Vender un combo → se registra la venta y baja el stock de sus componentes (antes "Producto no encontrado").
  2. Anular una venta con combo → se restaura el stock de los componentes una sola vez.
  3. Anular todos los ítems de una venta a crédito → la deuda del cliente se revierte.
  4. Vender producto pesable con cantidad fraccionaria (ej. 0.5 kg) → anularlo restaura 0.5 (antes truncaba).
  5. En efectivo Bs. intentar cobrar menos del total → rechazado; pagar de más (vuelto) → aceptado.
  6. Verificar que el backup (Config → Respaldar BD) sigue funcionando con el checkpoint WAL.
- **Pendiente por probar en vivo (Fase C)**: con 2 dispositivos y botones de Configuración → Sincronización —
  1. Venta nueva en un dispositivo → aparece en el otro (antes filas `updated_at` naive nunca pasaban el filtro).
  2. Anular venta/ítem → se marca anulada y el **stock se restaura** en el otro dispositivo (antes `INSERT OR IGNORE`+`continue` la perdía y avanzaba el watermark).
  3. Desactivar producto → queda inactivo en el otro (tombstone `activo=0`).
  4. Editar deuda en paralelo → gana la de timestamp más reciente (LWW); si editan en <5 min → aparece en "Ver conflictos".
  5. Verificar que la migración 031 convirtió `updated_at` a UTC (filas con `T`/`Z`).
- **Auditoría profunda 2026-08-04 registrada en AGENTS.md** (ver sección arriba); pendientes Fase A, D.
- **Snake ASCII (solo PC)** (2026-08-04): juego en modal con gráficos ASCII, acceso desde la Guía rápida (tab "Juego"), oculto en Android. Verificado node --check + minify + 75 vitest.

### Next Move
- Probar sync en vivo (F5 + botones de Configuración → Sincronización) según lista "Pendiente por probar (Fase C)".
- Probar la Fase B en vivo (combos, anulaciones con deuda, pesables, total_bs) según lista "Pendiente por probar en vivo (Fase B)".
- Aplicar Fase A (seguridad) y D (frontend menor) de la auditoría 2026-08-04.
- Build Android completo (`npm run tauri android build`) para confirmar integración Gradle del plugin de punta a punta.
- Probar el Snake manualmente en PC (F5 recarga frontend).

---

## Auditoría Plan

> ⚠️ **SUPERSEDED** por la "Auditoría profunda 2026-08-04" (Work State, arriba). Las Fases 1-5 de este plan histórico ya están completadas ✅; los fixes pendientes se priorizan ahora según el nuevo reporte.

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
