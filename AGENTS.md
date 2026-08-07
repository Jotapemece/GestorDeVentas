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
- Migraciones recientes: 031 (`updated_at` UTC ISO en productos/ventas/clientes/usuarios), 032 (detalles_ventas sin FK a productos, `cantidad REAL`), 033 (`clientes.activo` soft-delete), 034 (`categorias.updated_at`)
- Backups cifrados con AES-256-GCM, clave almacenada en config (`backup_key`)

## Supabase Sync
- Proyecto: `https://xryvxaslbtouihbulonw.supabase.co`
- Tablas: `dispositivos`, `categorias`, `productos`, `clientes`, `ventas`, `detalles_ventas`
- Anon key: `sb_publishable_3XXhx5ktfhrUvngJDYAQAA_xPCRMFzh`
- **Dispositivo registrado**: PC Jotapemece (`d093e594-8745-4dca-b97a-f7851c62cb65`)
- **Download ventas**: descarga ventas de OTROS dispositivos (`dispositivo_origen ≠ local_id`), INSERT OR IGNORE por `sync_id`, y decrementa stock local por cada unidad vendida remotamente
- El download de ventas NO filtra por fecha — descarga **todas** las ventas remotas desde `ultimo_download_ventas`. Es correcto porque stock se deriva de TODAS las ventas de todos los dispositivos, sin importar la fecha
- Los `sync_id` se usan como PK en Supabase (`ventas.id = sync_id`) para que `detalles_ventas.venta_id` referencie correctamente
- Tabla `detalles_ventas` en Supabase: `id (UUID), venta_id (UUID FK), local_id (int), producto_codigo, cantidad, precio_usd_unitario, anulado, sync_id (UUID), updated_at`
- Timestamps separados: `ultimo_upload`, `ultimo_download`, `ultimo_upload_ventas`, `ultimo_download_ventas` en `configuracion`
- Cada nueva venta recibe un UUID (`sync_id`) y almacena `dispositivo_origen`
- `void_sale` y `void_sale_items` actualizan `updated_at` para propagar anulaciones
- Config URL/Key almacenadas en config local (`supabase_url`, `supabase_key`)
- Registro de dispositivo vía `register_device` → guarda `dispositivo_id` en config local
- **Upload productos**: sube categorías (solo las que cambiaron, `updated_at > ultimo_upload`, col 034) + productos con `updated_at` real > `ultimo_upload`, incluye `dispositivo_origen`, sube borrados lógicos (`activo=0`)
- **Upload ventas**: sube ventas con `sync_id` y `updated_at` REAL > `ultimo_upload_ventas` + sus detalles (upsert por `sync_id`); errores al persistir `sync_id` abortan (no avanza watermark)
- **Upload clientes**: sube clientes no-temporales con `updated_at > ultimo_upload_clientes` o sin `sync_id`, incluye `activo` (tombstone de soft-delete) y `dispositivo_origen`
- **Download productos/clientes**: filtran `or=(dispositivo_origen.is.null,dispositivo_origen.neq.{id})` para NO re-descargar lo que subió este dispositivo (requiere columnas `dispositivo_origen` en Supabase); errores SQL en el batch abortan (rollback tx → el watermark NO avanza, fix 2)
- **Clientes soft-delete**: `delete_cliente` marca `activo=0` + `updated_at` (no DELETE), las listas filtran `activo=1`, el borrado viaja como tombstone

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
Lógica de caja correcta: las ventas a crédito (fiado) no cuentan en el saldo de caja (el dinero no entró), los egresos/ingresos de `movimientos_caja` afectan el saldo y los gráficos de reportes (barras, ganancias, pastel), y los abonos/pagos de deuda se registran como ingreso de caja indicando el método de pago usado. **✅ APLICADO (2026-08-06)** — ver "Lógica de caja" en Completed.

### Completed (this session)
- **Lógica de caja — fiado/abonos/egresos en caja y gráficos** (2026-08-06): **127/127** Rust + **94/94** vitest + `cargo check` OK + `node --check` OK + minify OK.
  - **Caja excluye fiado**: `get_saldo_caja` (cashier.rs) suma ventas con `metodo_pago != 'credito'` — el dinero que no entra a la caja no cuenta. Dashboard/reporte de ventas sigue mostrando ventas totales (incl. crédito) como cuentas por cobrar.
  - **Abonos/pagos de deuda → ingreso de caja con método**: `pay_debt` (clients.rs) inserta un movimiento `movimientos_caja` tipo `ingreso` cuyo concepto indica el método usado (`abono_concepto` helper: "Abono deuda - Cliente #X - Método: ... - Ref: ..."). Usa `state.get_employee()` (sesión) para autoría. Así el abono sube el saldo de caja y aparece en el listado de movimientos.
  - **Movimientos en gráficos de reportes** (decisión usuario "Todo"):
    - **Barras + cards**: `get_dashboard_summary` añade `neto_movimientos_usd`/`neto_movimientos_bs` a `DashboardPeriod` (vía nuevo helper `sumar_movimientos_rango`). Frontend: cards muestran "Mov. neto" y el bar chart gana una 3ª métrica "Caja" = `total_usd + neto_movimientos_usd`.
    - **Ganancias (línea)**: `get_profit_series` mergea en Rust ventas por día + movimientos por día (días con solo movimientos también aparecen); `ProfitDataPoint.neto_movimientos_usd` se incorpora a `profit_usd` y se muestra en el tooltip.
    - **Pastel**: `get_dashboard_payment_methods` añade un `MetodoTotal` `movimientos_caja` ("Ingresos caja", solo si neto > 0). Constante nueva `METODO_MOVIMIENTOS_CAJA` en constants.rs; label en `methodLabels` de reports-view.js.
  - **Tests**: +3 `sumar_movimientos_rango`/saldo-crédito (cashier.rs), +3 `abono_concepto` (clients.rs).
- **Pulido frontend P1-P3/P6 + auditoría 3 agentes** (2026-08-06): ver registros "Fase A — Seguridad (auditoría 3 agentes)" y "Pulido frontend" abajo.
- **Fase A — Seguridad (auditoría 3 agentes)** (2026-08-06): cierre de los hallazgos de seguridad de la auditoría con 3 agentes (hallazgos S1-S4). **120/120** Rust + **94/94** vitest + `cargo check` OK + minify OK.
  - **A1 — `get_user_config_value`/`set_user_config_value`** (config.rs): bloquean `CFG_BACKUP_KEY` (antes la clave maestra de cifrado salía por este comando; `get_backup_key` sigue siendo el único canal, admin-only + rate limit).
  - **A2 — OpenRouter sin API key por IPC**: `chat_with_ai` y `generate_purchase_suggestion` (openrouter.rs) ya NO reciben `api_key` como parámetro — se lee desde `configuracion` en el backend (key facturable nunca viaja a la webview). Frontend (views.js): `loadOpenRouterKey`/`generateOrder`/chat ya no envían `apiKey`; `saveOpenRouterKey` (solo escritura) intacta. Añadidas `CFG_OPENROUTER_API_KEY` y `CFG_OPENROUTER_MODEL` en constants.js; eliminada la constante muerta `CFG_OPENROUTER_MODEL` del Rust (solo la usaba el frontend).
  - **A3 — Exportación de archivos con auth**: nuevo comando `save_exported_file` (db.rs) que exige `check_employee_role` + cap base64 de 200 MB (`MAX_B64_PAYLOAD_BYTES`) + `sanitize_export_name`. El frontend (utils.js `saveExportedFile`) usa este comando en escritorio en vez de `plugin:gestor-downloads|save_to_path` (que no tenía auth). **`allow-save-to-path` quitado del permiso default** del plugin (permissions/default.toml); quien lo necesite debe otorgarlo explícitamente. Android sigue usando `save_to_downloads`.
- **Fase B — Correctitud dinero (auditoría 3 agentes)** (2026-08-06): **121/121** Rust + **94/94** vitest + `cargo check` OK + minify OK.
  - **B1 — Combos en carrito**: `addToCart`/`loadProductName` (cashier-view.js) usan `resolveCartProduct(codigo)` que busca en `productCache` y, si el código es `COMBO-N`, resuelve contra `comboCache` (nombre + precio real + es_inari). Antes el item de combo entraba con `precio_usd: 0` (el backend ya lo resolvía bien, pero el carrito mostraba $0).
  - **B2 — `get_profit_series` sin fan-out** (cashier.rs): el JOIN `ventas × detalles_ventas × productos` multiplicaba `SUM(v.total_usd)` por cada detalle. Ahora revenue se suma en `ventas` puro y el costo se calcula con subquery correlacionada por venta.
  - **B3 — Deuda abonada al anular todo**: `recalculate_sale_after_void` y `void_sale` (sales.rs) usan `saldo_deuda_usd = saldo_deuda_usd - total` SIN `MAX(0,...)`. Si el cliente ya abonó parte de la venta y se anula toda, el abono vuelve como crédito a favor (saldo negativo) en vez de esfumarse. +1 test Rust `test_void_items_todos_abono_previo_queda_credito`.
- **Fase D — Frontend (auditoría 3 agentes)** (2026-08-06): D1 y D2 aplicados. **94/94** vitest + minify OK.
  - **D1 — Escape en modales protegidos**: helper global `isProtectedModal(id)` (utils.js) y el handler de Escape respeta `PROTECTED_MODALS` pidiendo `confirmModal` antes de cerrar (igual que el backdrop de app.js, que ahora reusa el helper). Antes Escape cerraba directo perdiendo datos.
  - **D2 — XSS `data-codigo`**: `inventory-view.js:35` escapa `p.codigo` con `escapeHtml` en el botón "Editar" (antes se inyectaba crudo).
  - **D3 — SALTADO** por decisión del usuario: no se encontró la "mezcla de dos confirmaciones" en `confirmCloseCashier`.
- **Pulido frontend P1-P3** (2026-08-06): **94/94** vitest, `node --check` OK, minify OK. Solo JS/CSS/HTML.
  - **P1 — Fix botón "Ver" muerto en Reporte de Ventas**: `reportSalesBody` no tenía delegación de clic. Añadido listener en `app.js` (muestra detalle de venta del reporte). + 2 iconos FA6: `nf-fa-minus` (`\f068`), `nf-fa-user_plus` (`\f234`).
  - **P2 — Dropdowns por fila**: ventas del día, reporte, usuarios y cierres convierten botones sueltos en `.dropdown` con `data-action="toggle-dropdown"`. Delegaciones en `app.js` (ventasDay, report, userListBody, historial cierres) con `e.stopPropagation()` antes de `toggleDropdown`/`closeAllDropdowns`.
  - **P3 — Dropdowns de sección**: Caja (`Más`: Reportes/Cierres/Movimientos/Sync), Créditos (`Más`: Historial Temporales), Reportes (`Exportar`). Nuevos SELs `cashierActions`, `creditosHeader`, `reportsFilters`; IDs originales conservados.
  - **P6 — Toggle de auto-sync**: config `sync_auto_enabled` (default `true`; `CFG_SYNC_AUTO_ENABLED` + `SYNC_AUTO_DEFAULT_ENABLED` en constants.js), toggle `#sync-auto-enabled` + badge `#sync-auto-badge` en card "Sincronización automática" (sync-view.js). `applySyncAutoConfig()` centraliza badge ("Activo"/"Desactivado" con `.sync-auto-off`) + `startSyncAutoInterval(on ? minutes : 0)`.
- **Sync fixes (2026-08-06)**: **111/111** Rust + **85/85** vitest + `cargo check` OK + minify OK.
  - **1 — `updated_at` real al subir**: `upload_products_inner` (sync/products.rs) y `upload_sales_inner` (sync/sales.rs) leen `COALESCE(updated_at,'')` de la fila local y la suben tal cual (fallback a `now` solo si vacío), en vez de sobrescribir con `now`. El watermark avanza igual con el `ts` actual.
  - **2 — Watermark no avanza si falla un UPDATE**: `download_products_inner` propaga errores SQL con `?` en `upd.execute`/`ins.execute` (antes `.map(...).unwrap_or_default()` tragaba el fallo) → `run_download` revierte la tx y el `upsert_config` del watermark se deshace. Igual en `upload_sales_inner:196` y `upload_clientes_inner` al persistir `sync_id` (antes `.ok()`): si falla, aborta y no avanza el watermark.
  - **3 — No re-descargar lo propio**: `download_products_inner` y `download_clientes_inner` filtran `or=(dispositivo_origen.is.null,dispositivo_origen.neq.{id})` (antes solo ventas lo hacía). Los uploads de productos/clientes ahora incluyen `dispositivo_origen` (antes se ignoraba el `_dispositivo_id`). **Requiere columnas `dispositivo_origen` en Supabase** (ver "Supabase ALTER" en Next Move).
  - **4 — Tombstones de clientes**: migración **033** `clientes.activo` (soft-delete). `delete_cliente` para no-temporales marca `activo=0` + `updated_at` (conserva fila y ventas; antes DELETE + desvincular). `SQL_LIST_CLIENTES`/`SQL_CLIENTE_BY_ID` filtran `activo=1`. `upload_clientes_inner` sube `activo`; `download_clientes_inner` aplica `activo` remoto en UPDATE/INSERT.
  - **7 — Auto-sync para vendedores**: `sync_all` pasa de `check_admin_role` a `check_employee_role` (orchestrator.rs). `upload_all`/`download_all` siguen admin-only. `sync_all` sube usuarios pero solo `sync_id` (sin hashes).
  - **6 — Auto-sync global**: ya arrancaba en `handleLogin` (views.js); default de intervalo `30` → `SYNC.AUTO_MIN` (10) en `loadSyncAutoConfig` e input de index.html. Se arregla listener leak (`syncAutoListenerAttached` evita re-registrar `change` en cada `loadSyncConfig`). `handleLogout` limpia `syncAutoIntervalId` (antes seguía corriendo tras logout).
  - **8 — Badge de pendientes**: `get_sync_stats` (orchestrator.rs) añade `pending_products/clientes/ventas/total` (filas con `updated_at > watermark`). Frontend: `#sync-nav-pending` (`.nav-badge-accent`) en el sidebar + título descriptivo, actualizado en `loadSyncStats` y al hacer login.
  - **10 — Categorías incrementales**: migración **034** `categorias.updated_at` (backfill UTC ISO idempotente). `upload_products_inner` sube solo categorías `updated_at > ultimo_upload` o `NULL` (antes subía todas con `updated_at=now` cada vez).
  - **Supabase ALTER necesario (manual)**: `ALTER TABLE productos ADD COLUMN dispositivo_origen TEXT DEFAULT ''; ALTER TABLE clientes ADD COLUMN dispositivo_origen TEXT DEFAULT '';`
- **Fase D — Frontend menor** (2026-08-06): cierre de los hallazgos MENORES de la auditoría 2026-08-04. `cargo check` OK, 85/85 vitest, minify OK.
  - **D1 — búsqueda global de clientes**: `shortcuts.js:117` invocaba `list_clients_simple` NO registrado en lib.rs (fallaba silenciosa siempre). Ahora usa `list_clientes` (ya registrado, devuelve `nombre` + `saldo_deuda_usd`).
  - **D2 — 3 glifos FA faltantes** en `fa-local.css`: añadidos `nf-fa-image` (`\f03e`, reports-view.js exportar PNG), `nf-fa-chart_line` (`\f201`, empty state de gráfico), `nf-fa-rotate_left` (`\f2ea`, botón "Deshacer" en index.html). Codepoints Font Awesome 6 Free.
- **Fase A — Seguridad** (2026-08-06): cierre de los hallazgos CRÍTICOS de la auditoría 2026-08-04. **109/109** Rust + **85/85** vitest + `cargo check` OK + minify OK.
  - **A1 — `get_config_value`** (config.rs): exige sesión (`state.get_username()`) y bloquea `CFG_BACKUP_KEY` (clave maestra de cifrado nunca se entrega por este comando; `get_backup_key` sigue siendo el único y es admin-only). Supabase/OpenRouter siguen legibles por usuarios autenticados (la UI de Config los necesita).
  - **A2 — `register_movimiento`** (cashier.rs): usa `state.get_employee()` (sesión) en vez de `usuario_id`/`username` del request; valida `tipo ∈ {ingreso, egreso}`, montos >0 y no negativos, concepto no vacío. Frontend (cashier-view.js:1360) ya no envía `usuarioId`/`username`.
  - **A3 — guards de rol**: `check_employee_role` en `set_tasa` (sales.rs), `pay_debt` y `add_quick_debt` (clients.rs).
  - **A4 — sync mutaciones con `check_admin_role`**: `upload_sales`/`download_sales` (sync/sales.rs), `upload_products` (sync/products.rs), `upload_clientes` (sync/clients.rs), `upload_usuarios` (sync/users.rs), `upload_all`/`download_all`/`sync_all` (orchestrator.rs), `resolve_conflicto` (conflicts.rs). **`register_device` y `download_products/clientes/usuarios` quedan públicos** porque el flujo de registro de dispositivo (primer uso) los llama ANTES del login (decisión confirmada).
  - **A5 — `change_password`** (auth.rs) sin `check_admin_role` (cualquier empleado cambia su propia clave; ya verificaba old_password + rate limit); `admin_change_password` valida `PASSWORD_MIN_LENGTH`.
  - **A6 — `create_sale`** (sales.rs): `LineaVenta` añade `es_inari: bool` leído SIEMPRE de la BD (`SELECT ... COALESCE(es_inari,0) FROM productos`), nunca del request → un cliente no salta el control de stock. `execute_sale_transaction` recibe `vendedor_id` desde la sesión (`state.get_employee()`), ignorando `request.usuario_id` (autoría no forjable). Eliminada constante muerta `SQL_PRODUCTO_PRECIO_STOCK`.
  - **A7 — `save_to_path`** (gestor-downloads desktop.rs): rechaza rutas relativas y sanitiza solo el nombre de archivo (`sanitize_name`), conservando el directorio del diálogo del usuario.
  - **A9 — XSS**: `escapeHtml` (utils.js) ahora escapa `'` (`&#39;`); `clients-view.js:121` escapa `p.producto_nombre` y `p.cantidad`. Stubs de test sincronizados.
  - **Tests**: +1 Rust `test_resolver_linea_venta_ignora_es_inari_del_request` (verifica que un request con `es_inari=true` sobre producto NO-inari falla por stock; y que inari real en BD sigue sin control) → 109; +1 vitest `escapa comilla simple` → 85.
  - **Nota**: `get_backup_key` (A8) ya tenía rate limit + `check_admin_role`; no requirió cambio. `register_movimiento` no recibe `admin_guard` completo porque vendedores también gestionan caja (deriva de sesión).
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
  - **Fase A — Seguridad**: guard auth en `get_config_value` (bloquear claves sensibles); `register_movimiento` con `admin_guard` + derivar usuario de sesión; `set_tasa`/`pay_debt`/`add_quick_debt` con guards; sync mutaciones con `admin_guard`; `change_password` sin exigir admin + `admin_change_password` validando longitud; `create_sale` ignora `usuario_id` del request y lee `es_inari`/`es_pesable` de la DB; sanitizar `save_to_path`; restringir `get_backup_key`; XSS `clients-view.js:120`. **✅ APLICADO (2026-08-06)** — ver "Fase A — Seguridad" en Completed.
  - **Fase B — Correctitud dinero/stock**: combos resueltos contra `combos`/`combo_productos` (restar stock de componentes); `void_sale` filtra `anulado=0` y no restaura inari; `void_sale_items` revierte deuda al anular todo; cantidades como REAL/f64; validar `total_bs_ingresado` (tolerancia vs `total_usd*tasa`); filtrar anuladas en reportes; `wal_checkpoint(TRUNCATE)` en backup. **✅ APLICADO (2026-08-05)** — ver "Fase B — Correctitud dinero/stock" en Completed.
  - **Fase C — Sync**: UPDATE en anulaciones remotas; upload solo lo modificado + tombstones; `parse_ts` con zona horaria; `saldo_deuda_usd` como candidato a conflicto. **✅ APLICADO (2026-08-05)** — ver "Fase C — Corrección del sync" en Completed.
  - **Fase D — Frontend menor**: registrar `list_clientes` para búsqueda global; añadir 3 glifos FA. **✅ APLICADO (2026-08-06)** — ver "Fase D — Frontend menor" en Completed.
- **Estado**: registrado 2026-08-04; Fases A, B, C y D aplicadas.

### Auditoría 3 agentes 2026-08-06 — Fases A, B y D aplicadas
- **Alcance**: 3 agentes en paralelo (explore núcleo Rust, general sync, general frontend) + verificación manual de cada claim. 19 bugs.
- **Seguridad (Fase A)**: S1 `get_user_config_value` filtraba la clave maestra pero `set` no y el canal por-user no bloqueaba `CFG_BACKUP_KEY`; S2 `save_to_path` sin auth (escribe ruta arbitraria); S3 key de OpenRouter viajaba por IPC a la webview; S4 `decode_base64` sin límite de tamaño (DoS). **✅ APLICADO** — ver "Fase A — Seguridad (auditoría 3 agentes)" en Completed.
- **Dinero (Fase B)**: F1 combos entran al carrito con precio $0 (`cashier-view.js:325-363` — el carrito no resuelve combos contra `comboCache`); B2 `get_profit_series` double-conteo por JOIN fan-out (`cashier.rs:491-499`); B3 anular todos los ítems de venta a crédito con abono previo no revierte la parte ya abonada (`recalculate_sale_after_void`). **✅ APLICADO** — ver "Fase B — Correctitud dinero (auditoría 3 agentes)" en Completed.
- **Frontend (Fase D)**: D1 Escape/backdrop en modales protegidos; D2 `data-codigo` sin `escapeHtml` en inventario; D3 `confirmCloseCashier` mezcla dos confirmaciones (**SALTADO** por decisión del usuario — no se encontró la mezcla en el código). **D1 y D2 ✅ APLICADOS**.
- **Estado**: Fases A, B y D aplicadas (2026-08-06).

### Active
- **Pulido frontend Fase P5 (2026-08-06)**: **94/94** vitest, `node --check` OK, minify OK. Solo CSS + 1 micro-cambio JS, sin tocar Android layout. Cambios Rust → reiniciar `npm run tauri dev`.
  - **P5.12 — Dropdown items unificados**: `.dropdown-menu button` ahora `display:flex; align-items:center; gap:8px` con icono `.nf` fijo de 18px centrado (color `--text-light`, hover `--primary`). Afecta a inventario/créditos (reusan `toggleDropdown`). Los items ya usaban `<i class="nf">` en todos los casos (verified utils.js:100-106). `.compact`/móvil (min-height 44px) intactos.
  - **P5.13 — Toolbars y celdas de acción alineadas**: `.cashier-actions` gana `align-items:center; flex-wrap:wrap` + `white-space:nowrap`, y margen en iconos `.nf`; nueva regla base `.table td .btn + .btn { margin-left:4px }` para gap uniforme entre botones de fila (ventas del día, usuarios). Eliminado el `margin-right:4px` inline redundante de `admin-pwd-btn` en `utils.js:137` (antes doble-gap, ahora uniforme).
- **Pulido frontend P1-P3 (2026-08-06)**: **94/94** vitest, `node --check` OK, minify OK. Solo JS/CSS/HTML, sin tocar Android layout.
  - **P1 — Fix botón "Ver" muerto en Reporte de Ventas**: `reportSalesBody` no tenía delegación de clic (palabras clave: `files`). Añadido listener en `app.js` (muestra detalle de venta del reporte). + 2 iconos FA6 faltantes en `fa-local.css`: `nf-fa-minus` (`\f068`) y `nf-fa-user_plus` (`\f234`).
  - **P2 — Dropdowns por fila**: ventas del día, reporte, usuarios y cierres convierten sus botones sueltos ("Ver detalle"/"Anular", "Cambiar contraseña"/"Eliminar", "Ver detalle") en `.dropdown` con `.dropdown-btn[data-action="toggle-dropdown"]`. Delegaciones añadidas en `app.js` (ventasDay, report, userListBody, historial cierres) que detienen propagación antes de `toggleDropdown`/`closeAllDropdowns`.
  - **P3 — Dropdowns de sección**: en cabeceras Caja (`Reportes/Cierres/Movimientos/Sync`), Créditos (`Historial Temporales`) y Reportes (`Exportar XLSX/PDF`) se agrupan en un dropdown "Más"/"Exportar" manteniendo los `id` originales (los listeners existentes siguen funcionando). Se añadió `SEL.cashierActions`, `SEL.creditosHeader`, `SEL.reportsFilters` para la delegación `toggle-dropdown`. Inventario ya tenía dropdown propio (`inventory-more-menu`), sin cambios.
  - **P6 — Toggle de auto-sync**: nueva config `sync_auto_enabled` (default `true`, `CFG_SYNC_AUTO_ENABLED` + `SYNC_AUTO_DEFAULT_ENABLED` en constants.js) con toggle `#sync-auto-enabled` en la card "Sincronización automática" (Sync). `loadSyncAutoConfig` lee intervalo y estado; `applySyncAutoConfig()` centraliza: actualiza badge `#sync-auto-badge` ("Activo"/"Desactivado" con clase `sync-auto-off` gris) y llama `startSyncAutoInterval(on ? minutes : 0)` (0 = desactivado). Cambiar el toggle o el intervalo guarda en config (admin-only, consistente con la vista Sync). Al desactivar se limpia el intervalo; al activar se reinicia con el valor actual.
- **Auditoría bugs+optimización APLICADA (2026-08-06)**: **120/120** `cargo test --lib`, `cargo check` OK, **94/94** vitest, `node --check` OK, minify OK. Cambios Rust → reiniciar `npm run tauri dev`.
  - **A1 — Cantidad sin validar (CRÍTICO dinero)**: `validate_sale_request` no validaba `cantidad` por línea; una cantidad negativa AÑADÍA stock y volvía el total negativo (`sub_stock(-1)` → `stock+1`). Ahora rechaza `!is_finite() || cantidad <= 0.0` por producto (`sales.rs:77`). +3 tests (negativa/cero/NaN).
  - **A2 — Red dentro de la tx de sync (CRÍTICO "database is locked")**: `upload_all`/`download_all`/`sync_all` mantenían UNA tx SQLite abierta durante TODAS las llamadas HTTP (4-8 round-trips). Con `busy_timeout=5000`, el POS fallaba si el sync tardaba >5s. Ahora cada etapa (productos/clientes/usuarios/ventas × up/down) usa SU PROPIA tx corta (recolecta config → red → escribe → commit), liberando el lock durante la red. `orchestrator.rs`.
  - **A3 — LWW asimétrico en productos**: `download_products_inner` sobrescribía una edición local más reciente con la remota vieja (clientes sí filtraban `remote_ts>local_ts`, productos no). Añadido el check `rem <= loc → continue` (`sync/products.rs`).
  - **A4 — Saldo de caja ignora movimientos solo-Bs (CRÍTICO dinero)**: `SQL_TOTAL_MOVIMIENTOS` solo sumaba `monto_usd`; un egreso de Bs. 500 (`monto_usd=0`) no bajaba el saldo. Ahora suma Bs. y los convierte con la tasa (`cashier.rs`).
  - **A5 — Pérdidas aplanadas a 0**: `total_ganancia_usd` y `profit_usd` devolvían `0.0` en pérdidas; ahora `usd - costo` (puede ser negativo) (`cashier.rs:466,510`).
  - **B1 — Guards de rol en preview/apply**: `apply_download` (muta BD con `force`) → `check_admin_role`; `preview_download` → `check_employee_role` (`preview.rs`).
  - **B2 — Argon2 bajo el lock de DB**: `login`/`create_usuario`/`reset_usuarios` hasheaban/verificaban con el mutex de BD tomado (DoS latencia). Ahora: leer fila → `drop(db)` → `verify_password`/`hash_password` → re-lock solo para escribir (`auth.rs`).
  - **B3 — IA sin auth ni rate-limit**: `chat_with_ai` y `generate_purchase_suggestion` ahora exigen `state.get_employee()` + `check_action_rate_limit`; `generate_purchase_suggestion` suelta el lock antes del HTTP 45s (no bloquea el POS). `openrouter.rs`.
  - **B4 — Lockout con usernames inexistentes (DoS)**: `login` NO cuenta intentos cuando el usuario no existe (responde "Credenciales inválidas" idéntico sin incrementar `login_attempts`; evita bloquear cuentas reales bajo usernames inventados) (`auth.rs`).
  - **B5 — `upload_usuarios_inner` subía TODOS los usuarios + hash Argon2 nuevo por sync**: ahora filtra `updated_at > ultimo_upload_usuarios OR sin sync_id` (`users.rs`).
  - **B6 — PDF acentos mojibake**: `sanitize_latin1` conservaba `á` (≤0xFF) pero el stream se escribía con `.as_bytes()` (UTF-8, 2 bytes) en una fuente WinAnsi. Nuevo `to_latin1_bytes` escribe 1 byte/char (WinAnsi==Latin-1 en 0xA0-0xFF) y el `/Length` usa esa longitud (`pdf.rs`).
  - **B7 — `stock_minimo` no bumpeaba `updated_at`** → el cambio nunca viajaba en sync. Añadido `updated_at = now_iso()` (`products.rs:664`).
- **Modal descarga selectiva APLICADO (2026-08-06)**: **117/117** `cargo test --lib`, `cargo check` OK, **94/94** vitest, `node --check` OK, minify OK. Cambios Rust → reiniciar `npm run`.

  - Fase 1: `add_stock`/`sub_stock` (db.rs) buppean `productos.updated_at`; `download_products_inner` (sync/products.rs) incluye `stock = ?N` en el UPDATE de descarga.
  - Fase 2: comandos `preview_download` (descarga todo de Supabase ignorando watermark, `dispositivo_origen ≠ local`, diff campo a campo vs local → `{tipo, sync_id, nombre, local_ts, remote_ts, campos:[{campo,local,remoto}]}`, incluye inserts y tombstones `activo`) y `apply_download(changes, force)` (LWW por defecto; `force=true` ignora la fecha y el remoto siempre gana — para corregir datos locales obsoletos). Módulo `sync/preview.rs` + registro en `lib.rs`.
  - Fase 3: modal `#download-preview-modal` en Config → Sincronización (botón "Descargar todo" ahora lo abre): secciones Clientes/Productos con contadores, checkboxes por item (default marcado), "Aceptar todo", "Ninguno", "Aplicar seleccionados", "Cancelar", y checkbox **"Forzar reemplazo"** (aplica el dato remoto aunque el local sea más reciente). `openDownloadPreview()` en app.js.
- **Force reemplazo APLICADO (2026-08-06)**: en vivo el LWW omitía 5 clientes correctos porque `local_ts > remote_ts` (timestamps locales inflados por migraciones/backfills). Solución: checkbox "Forzar reemplazo" en el modal → `apply_download` recibe `force: bool` y salta los checks `remote_ts <= local_ts` en productos y clientes (`sync/preview.rs:339,425`). **117/117** Rust, `cargo check` OK, **94/94** vitest, minify OK.
- **EN CURSO — modal descarga selectiva + fixes causa raíz (2026-08-06)**: plan aprobado (merge = LWW con override force). Cambios pendientes de probar en vivo con 2 dispositivos.
- **Auditoría móvil (Android) APLICADA (2026-08-06)**: **117/117** Rust, `cargo check` OK, **94/94** vitest, `node --check` OK, minify OK, plugin Kotlin + `:app:compileUniversalDebugKotlin` compilan.
  - **M1 — Back button nativo**: `MainActivity.kt` registra un `OnBackPressedCallback` que llama `webView.goBack()` si hay historial (si no, cierra la app). En frontend `initAndroidBack()`/`androidTrackView()`/`androidBackStep()` (app.js) mantienen un stack de navegación: back cierra el modal abierto; si no, retrocede a la vista anterior. `showView` (sync-view.js) registra la vista via `androidTrackView`. **Requiere probar en teléfono**.
  - **M2 — Plugin descargas Android <10**: `AndroidManifest.xml` del app declara `WRITE_EXTERNAL_STORAGE` con `maxSdkVersion="28"`; `ExamplePlugin.kt` ahora pide el permiso en runtime (API≤28) con `@TauriPlugin(permissions=[Permission("storage")])` + `@PermissionCallback saveToDownloadsPermissionCallback`. **Firma en claro eliminada**: `build.gradle.kts` lee `keystore.properties` (gitignore) o env `ANDROID_KEYSTORE_PASSWORD`/`ANDROID_KEY_PASSWORD`/`ANDROID_KEY_ALIAS`, sin fallback hardcodeado.
  - **M3 — UX táctil**: `IS_ANDROID` ahora usa `Tauri` plugin OS oficial (`@tauri-apps/plugin-os`, `tauri-plugin-os`, capability `os:default`) con fallback de userAgent (`PLATFORM`/`IS_ANDROID` en constants.js). `inputmode="decimal"`/`"numeric"` añadido a campos numéricos (carrito utils.js, mixto cashier-view.js, precio app.js, producto/precio/costo/stock/stock-mínimo/combo/deuda en index.html). `shareReceipt` (config-view.js) ahora usa `navigator.share` real con fallback a clipboard si falla/AbortError.
  - **M4 — Safe-area/notch**: `Theme.gestor_ventas` añade `android:windowLayoutInDisplayCutoutMode=shortEdges` + `windowDrawsSystemBarBackgrounds` + `navigationBarColor=transparent` (el CSS ya usaba `env(safe-area-inset-*)`); `MainActivity` usa `enableEdgeToEdge`. **Orientación AndroidManifest fijada a `portrait`** (POS móvil). Clear: el CSS de las bottom-tabs usa safe-area; el edge-to-edge + bars transparentes hace que los insets del WebView coincidan con el notch. Se activa desde la app el snap del Spanish `snake` excluded en móvil (ya lo era).
- **Pendiente probar en vivo (M1-M4)**: back que cierra modales/navega, guardado en Descargas en Android <10 (solicitud de permiso), teclado numérico con `inputmode`, y los insets/notch/orientación en el teléfono real.
- **Pendiente SUPABASE ALTER (manual, requisito de los fixes 3 y 4)**: ejecutar una vez en el SQL Editor de Supabase:
  ```sql
  ALTER TABLE productos ADD COLUMN dispositivo_origen TEXT DEFAULT '';
  ALTER TABLE clientes ADD COLUMN dispositivo_origen TEXT DEFAULT '';
  ```
  Sin estas columnas, `download_products`/`download_clientes` siguen llegando (el `or=(...is.null...)` los cubre a ambos lados), pero los uploads enviarán `dispositivo_origen` y fallarán si la columna no existe.
- **Pendiente de probar en vivo (sync fixes)**:
  1. Subir productos/clientes/ventas → verificar que el badge `#sync-nav-pending` muestra pendientes y baja tras `sync_all`.
  2. Con 2 dispositivos: vender/editar producto en A → en B el badge sube y `sync_all` trae el cambio (no se re-descarga lo propio en A).
  3. Borrar un cliente normal en A → en B.`list_clientes` no lo muestra (tombstone `activo=0`), y sus ventas se conservan.
  4. Vendedor: `sync_all` (auto-sync) funciona; `upload_all`/`download_all` siguen admin-only.
  5. Categorías: solo viajan las cambiadas (tras la primera subida post-migración 034 no se re-suben todas).
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
- **Auditoría profunda 2026-08-04 registrada en AGENTS.md** (ver sección arriba); Fases A-D aplicadas.
- **Snake ASCII (solo PC)** (2026-08-04): juego en modal con gráficos ASCII, acceso desde la Guía rápida (tab "Juego"), oculto en Android. Verificado node --check + minify + 75 vitest.

### Next Move
- **Probar en vivo la lógica de caja** (2026-08-06): (1) vender a crédito y verificar que NO sube el saldo de caja (Movimientos) pero sí aparece en ventas del día; (2) registrar un egreso/ingreso manual y ver que mueve el saldo y la barra "Caja"/"Mov. neto" del dashboard; (3) abonar una deuda y verificar que sube la caja, aparece en el listado de movimientos con el método de pago, y suma en el pastel "Ingresos caja" y en la línea de ganancias.
- **Ejecutar el ALTER en Supabase** (ver Active): `dispositivo_origen` en `productos` y `clientes`.
- Commitear/pushear los Sync fixes a `origin/duo`.
- Añadir también el badge de cliente temporal y verificar en vivo la búsqueda global F5 + Fase D.
- Probar sync en vivo (F5 + botones de Configuración → Sincronización) según listas "Pendiente por probar (Fase C)" y "Pendiente de probar en vivo (sync fixes)".
- Probar la Fase B en vivo (combos, anulaciones con deuda, pesables, total_bs) según lista "Pendiente por probar en vivo (Fase B)".
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

---

## Modal descarga selectiva (plan aprobado 2026-08-06)

Problema: al descargar, deuda/stock/precio "no se reemplazan" (solo ventas llegan). Causa raíz:
1. `add_stock`/`sub_stock` (db.rs) no bumpean `productos.updated_at` → el stock cambiado nunca viaja en upload.
2. UPDATE de descarga de productos (sync/products.rs) no incluye `stock`.
3. Filtro `updated_at=gt.{watermark}` pierde filas con `updated_at` viejo aunque el valor remoto cambió (ventas llegan por `updated_at` fresco; deuda/stock/precio no).
4. LWW en clientes (sync/clients.rs) → cada dispositivo cree tener la última versión.

Solución (aprobada, regla de merge = LWW: remoto solo gana si es más nuevo):
- **Fase 1 — causa raíz**: `add_stock`/`sub_stock` añaden `updated_at = now_iso()`; `download_products_inner` añade `stock = ?N` al UPDATE. ✅
- **Fase 2 — backend**: comando `preview_download` (descarga TODO de Supabase ignorando watermark, filtra `dispositivo_origen ≠ local`, devuelve diff campo a campo vs local: `{tipo, sync_id, nombre, local_ts, remote_ts, campos:[{campo, local, remoto}]}`, incluye inserts y tombstones). Comando `apply_download(changes)` aplica solo si `remote_ts > local_ts` o insert. ✅
- **Fase 3 — frontend**: modal "Cambios disponibles" en Config → Sincronización con checkboxes por item, "Aceptar todo", "Aplicar seleccionados", "Cancelar"; reemplaza el botón "Descargar todo". ✅
- **Fase 4 — verificación**: cargo check/test (117), vitest (94), node --check, minify. ✅
