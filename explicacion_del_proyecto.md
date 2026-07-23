# Explicación del Proyecto — Gestor de Ventas

## Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Tauri: el puente entre Rust y el frontend](#2-tauri-el-puente-entre-rust-y-el-frontend)
3. [Backend: Rust](#3-backend-rust)
   - [3.1 ¿Qué es Rust?](#31-qué-es-rust)
   - [3.2 Estructura del backend](#32-estructura-del-backend)
   - [3.3 Archivo por archivo](#33-archivo-por-archivo)
   - [3.4 SQLite y la base de datos](#34-sqlite-y-la-base-de-datos)
4. [Frontend: HTML/CSS/JS](#4-frontend-htmlcssjs)
5. [Sincronización con Supabase](#5-sincronización-con-supabase)
6. [Flujo de una venta](#6-flujo-de-una-venta)
7. [Android](#7-android)

---

## 1. Arquitectura General

El proyecto es una **aplicación de escritorio (y Android)** que funciona como Punto de Venta (POS). Está construida con **Tauri v2**, un framework que permite crear aplicaciones nativas usando Rust como backend y HTML/CSS/JS como frontend.

```
┌─────────────────────────────────────────────┐
│  Frontend (HTML + CSS + JavaScript)          │
│  app.js — toda la lógica de UI              │
│  index.html — una sola página con vistas     │
│  style.css — temas oscuro/claro/colores      │
└──────────────────┬──────────────────────────┘
                   │ Llamadas invoke()
                   ▼
┌─────────────────────────────────────────────┐
│  Tauri (puente Rust ↔ WebView)               │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  Backend Rust                                │
│  lib.rs → registra comandos Tauri            │
│  db.rs → conexión SQLite                     │
│  sales.rs → lógica de ventas                 │
│  products.rs → CRUD productos                │
│  cashier.rs → caja y cierres                 │
│  clients.rs → clientes y crédito             │
│  auth.rs → login y usuarios                  │
│  sync/ → sincronización con Supabase         │
│  ... (más módulos)                           │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  SQLite (gestor_    │
        │  ventas.db)         │
        └─────────────────────┘
```

**Concepto clave**: el frontend NO se conecta directamente a la base de datos. Todo pasa por Tauri: el frontend llama funciones Rust con `invoke('nombre_comando', { args })`, Rust ejecuta la lógica, accede a SQLite, y devuelve resultados al frontend.

---

## 2. Tauri: el puente entre Rust y el frontend

Tauri funciona así:

1. El frontend (una web view nativa) carga `index.html`.
2. El frontend puede llamar comandos Rust con `window.__TAURI__.core.invoke('comando', { arg1: valor })`.
3. Cada comando es una función Rust marcada con `#[tauri::command]`.
4. Esa función se registra en `lib.rs` con `tauri::generate_handler!`.
5. Tauri serializa los argumentos y resultados como JSON automáticamente.

Ejemplo:
```js
// JavaScript
const ventas = await invoke('list_sales', { limit: 10 });
```

```rust
// Rust
#[tauri::command]
pub fn list_sales(state: State<AppState>, limit: Option<i64>) -> Result<Vec<Venta>, String> {
    let db = state.lock_db()?;
    // ... consulta SQLite ...
    Ok(ventas)
}
```

Tauri también provee plugins para cosas como: abrir archivos, diálogos de sistema, notificaciones, etc.

---

## 3. Backend: Rust

### 3.1 ¿Qué es Rust?

Rust es un lenguaje de programación de sistemas que se caracteriza por:

- **Seguro de memoria**: el compilador verifica que no haya errores de memoria (punteros nulos, dobles liberaciones, etc.) sin necesidad de un garbage collector.
- **Rápido**: comparable a C/C++.
- **Sin runtime pesado**: no necesita una máquina virtual.
- **Sistema de tipos expresivo**: usa Option, Result, y pattern matching en vez de null o excepciones.
- **Propiedad y préstamo (ownership & borrowing)**: cada valor tiene un único dueño; puedes prestarlo prestado con & (lectura) o &mut (escritura). El compilador se asegura de que no haya usos inválidos.

**Conceptos básicos de Rust que aparecen en el código:**

```rust
// Variables inmutables por defecto
let x = 5;       // no se puede reasignar

// Mutables con 'mut'
let mut y = 10;
y = 20;

// Tuples
let (a, b) = (1, "hola");

// Option — puede ser Some(valor) o None
fn buscar() -> Option<i64> { ... }

// Result — puede ser Ok(valor) o Err(error)
fn hacer_algo() -> Result<String, String> { ... }

// Pattern matching
match resultado {
    Ok(valor) => println!("{}", valor),
    Err(e) => eprintln!("Error: {}", e),
}

// El operador ? propaga errores hacia arriba
let datos = obtener_algo()?;  // si es Err, retorna el error

// Structs — como objetos pero sin herencia
struct Usuario {
    id: i64,
    username: String,
}

// Vec — lista dinámica
let lista: Vec<i64> = vec![1, 2, 3];
```

### 3.2 Estructura del backend

```
src-tauri/src/
├── lib.rs          → Punto de entrada. Registra módulos y comandos Tauri.
├── main.rs         → Inicializa la app (mínimo).
├── db.rs           → Conexión SQLite, AppState, backup.
├── models.rs       → Structs compartidos (Venta, Producto, etc.)
├── migrations.rs   → Migraciones de esquema DB (016 versiones).
├── constants.rs    → Constantes (métodos de pago, config keys, etc.)
├── helpers.rs      → Funciones utilitarias (fechas, validaciones).
├── auth.rs         → Login, usuarios, hash de contraseñas.
├── products.rs     → CRUD de productos.
├── sales.rs        → Ventas, reportes, exportación XLSX.
├── cashier.rs      → Caja, cierres de caja, dashboard.
├── clients.rs      → Clientes, crédito, abonos.
├── config.rs       → Configuraciones (tasa, tema, sonido, etc.)
├── tasa_bcv.rs     → Fetch automático de tasa BCV desde internet.
├── audit.rs        → Historial de acciones.
└── sync/           → Sincronización con Supabase.
    ├── mod.rs      → Funciones compartidas (HTTP, URL encoding).
    ├── products.rs → Upload/download productos.
    ├── sales.rs    → Upload/download ventas.
    ├── clients.rs  → Upload/download clientes.
    ├── conflicts.rs→ Resolución de conflictos.
    └── orchestrator.rs → sync_all (orquestador unificado).
```

### 3.3 Archivo por archivo

#### `lib.rs`

Es el archivo más importante del backend. Hace tres cosas:

1. **Declara los módulos**: `mod auth;`, `mod sales;`, etc. — esto le dice al compilador que esos archivos existen.
2. **Configura la app en `setup()`**: inicializa SQLite, crea un `AppState` con la conexión y lo comparte entre todos los comandos.
3. **Registra los comandos**: `tauri::generate_handler![...]` — aquí se listan todas las funciones que el frontend puede llamar.

```rust
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Inicializar BD
            let (conn, db_path) = db::init_db(app.handle())?;
            // Guardar estado global
            app.manage(AppState {
                db: Mutex::new(conn),
                db_path: Mutex::new(db_path),
                current_user: Mutex::new(None),
                // ...
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::login,
            sales::create_sale,
            products::list_products,
            // ... ~50 comandos
        ])
        .run(tauri::generate_context!())
}
```

#### `models.rs`

Define los **structs** (estructuras de datos) que se usan en todo el backend. Son como "contratos" que definen cómo se ven los datos. Ejemplo:

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Venta {
    pub id: i64,
    pub fecha_hora: String,
    pub usuario_id: i64,
    pub username: String,
    pub metodo_pago: String,      // "efectivo_usd", "pago_movil", etc.
    pub total_usd: f64,
    pub tasa_aplicada: f64,
    pub total_bs: f64,
    pub anulada: bool,
    pub sync_id: Option<String>,
    pub dispositivo_origen: Option<String>,
    // ... más campos
}
```

`#[derive(Serialize, Deserialize)]` viene de la librería `serde` y permite convertir automáticamente estos structs a/desde JSON, que es lo que Tauri usa para comunicarse con el frontend.

#### `constants.rs`

Todas las constantes del proyecto en un solo lugar. Aquí se definen:

- `METODO_PAGO_MOVIL: &str = "pago_movil"` — los nombres de los métodos de pago
- `CFG_TASA_DOLAR: &str = "tasa_dolar"` — las claves de la tabla `configuracion`
- `ROL_ADMIN: &str = "admin"`, `ROL_VENDEDOR: &str = "vendedor"` — roles de usuario
- `PAGE_SIZE_MAX: i64 = 5000` — paginación
- Usuarios por defecto (`admin`/`admin`, `jota`/`1234`, `vendedor`/`1234`)

#### `helpers.rs`

Funciones pequeñas reutilizables:

- `now_iso()` → devuelve la fecha actual en formato ISO 8601 (`2026-07-19T10:00:00.000Z`)
- `fecha_hora_local()` → formato SQLite (`2026-07-19 10:00:00`)
- `siguiente_dia("2026-07-19")` → `"2026-07-20"`
- `validate_pago_movil_ref("1234")` → verifica que una referencia de pago móvil tenga 4 dígitos

#### `db.rs`

Maneja la conexión a SQLite:

- `AppState` — struct que contiene la conexión a la BD, la ruta del archivo, el usuario actual, y contadores de intentos de login. Se almacena en el estado de Tauri y se pasa a cada comando con `State<AppState>`.
- `lock_db()` — obtiene un lock del Mutex que protege la conexión SQLite (hilo seguro).
- `get_username()` — devuelve el nombre del usuario autenticado.
- `init_db()` — abre o crea `gestor_ventas.db`, ejecuta migraciones, inserta usuarios por defecto.
- `backup_database()` — copia el archivo `.db`.
- `auto_import_products()` — si existe un archivo `productos` al lado del ejecutable, importa productos automáticamente en la primera ejecución.

**¿Por qué Mutex?** SQLite no es seguro para hilos (thread-safe) por defecto con rusqlite. Como Tauri puede atender múltiples comandos concurrentemente, envolvemos la conexión en un `Mutex` para que solo un comando acceda a la vez.

#### `auth.rs`

Manejo de usuarios y autenticación:

- `hash_password()` → usa Argon2 (algoritmo moderno de hash de contraseñas).
- `verify_password()` → verifica contra Argon2 o contra SHA-256 legacy (para migración).
- `login()` → busca usuario en BD, verifica password, y lo guarda en `state.current_user`.
- `logout()` → limpia `state.current_user`.
- `change_password()` → cambia la contraseña del usuario actual.
- `admin_change_password()` → un admin cambia la contraseña de otro usuario.
- `create_usuario()`, `list_usuarios()`, `delete_usuario()` — CRUD de usuarios (solo admin).
- `check_admin_role()` → verifica que el usuario actual sea admin.
- `require_admin()` → igual que check_admin_role pero además audita la acción.

**Rate limiting**: después de 5 intentos fallidos de login, se bloquea por 5 minutos.

#### `products.rs`

CRUD de productos con SQLite:

- `list_products()` → lista con paginación y búsqueda.
- `create_product()` → valida precio>0, stock>=0, genera código automático (P0001, P0002...).
- `update_product()` → actualiza nombre, precio, stock.
- `delete_product()` → si tiene ventas asociadas, hace "soft delete" (activo=0); si no, borra físicamente.
- `export_products_xlsx()` → exporta a Excel con `rust_xlsxwriter`.
- `import_products_from_file()` → importa desde TSV.
- `import_products_from_db()` → importa desde otro archivo `.db`.

Cada producto tiene: `codigo` (PK), `nombre`, `precio_usd`, `stock`, `stock_minimo`, `activo`, `created_at`, `updated_at`.

#### `sales.rs`

El corazón del proyecto — creación y consulta de ventas:

- `create_sale()` → valida la solicitud, inicia transacción SQLite, descuenta stock, inserta venta y detalles, actualiza deuda si es crédito, audita, y confirma. Todo en una transacción.
- `list_sales()` → últimas ventas con JOIN a usuarios y clientes.
- `get_sale_detail()` → productos de una venta específica.
- `get_sales_report()` → reporte paginado por fechas con filtros (producto, usuario). Usa una query de agregación para contar totales y otra query paginada para los datos. Los detalles se obtienen en batch (evita N+1).
- `void_sale()` → anula una venta entera: restaura stock, revierte deuda de crédito, marca como anulada. En transacción.
- `void_sale_items()` → anula ítems específicos y recalcula totales. Si no quedan ítems activos, anula la venta completa.
- `export_report_xlsx()` → exporta reporte a Excel.
- `validar_pago_detalle()` → valida pagos mixtos (suma de montos = total, métodos válidos).

**Flujo de una venta (create_sale):**
1. Validar que haya productos, tasa > 0, etc.
2. Calcular total USD
3. Para pago mixto, validar que los montos sumen al total
4. Iniciar transacción SQLite
5. Insertar venta con sync_id (UUID)
6. Por cada producto: insertar detalle, descontar stock
7. Si es crédito, aumentar deuda del cliente
8. Auditar acción
9. Commit

#### `cashier.rs`

Manejo de caja:

- `abrir_caja()` / `get_caja_abierta()` → toggle de caja abierta/cerrada (config `caja_abierta`).
- `get_daily_summary()` → resumen del día (ventas, totales, tasa actual).
- `close_cashier()` → cierra la caja: calcula totales del día, guarda cierre y su detalle JSON (por método de pago, productos vendidos, clientes crédito). En transacción.
- `get_close_report_data()` → previsualización del cierre.
- `list_cierres()` → histórico de cierres.
- `get_dashboard_summary()` → ventas de hoy, últimos 7 días, mes.
- `get_dashboard_payment_methods()` → distribución por método de pago para gráficos.

**group_payments_by_method()**: función clave del dashboard. Toma las ventas del día y agrupa los montos por método de pago, incluyendo los pagos mixtos (que contienen múltiples métodos).

#### `clients.rs`

CRUD de clientes con sistema de crédito:

- `list_clientes()` → todos los clientes.
- `create_cliente()` → genera sync_id (UUID).
- `toggle_cliente_credito()` → activa/desactiva crédito.
- `get_cliente_history()` → ventas a crédito del cliente.
- `pay_debt()` → registra abono. En transacción, descontando saldo. Si saldo llega a 0, reactiva crédito automáticamente.
- `update_cliente()`, `delete_cliente()` — solo sin deuda pendiente.

#### `audit.rs`

Registro de todas las acciones importantes:

- `log_action()` → inserta en `historial_acciones`.
- `get_audit_logs()` → listado paginado.
- `get_cierres()` → filtra solo acciones de cierre de caja.
- `clear_audit()` → limpia historial (en transacción para poder auditar la limpieza).

#### `config.rs`

Configuración genérica clave/valor:

- `get_config_value()` / `set_config_value()` → config global.
- `get_user_config_value()` / `set_user_config_value()` → config por usuario (prefijo `username:clave`). Si no hay valor por usuario, devuelve el global.
- `list_theme_names()` → temas disponibles.

#### `tasa_bcv.rs`

Obtiene la tasa BCV automáticamente:

- `fetch_tasa_bcv()` → consulta API pública `dolar-vzla.rafnixg.dev` y extrae la tasa del dólar.
- `check_tasa_update()` → verifica una vez al día si la tasa cambió. Devuelve `Some(nueva_tasa)` si hay cambio, `None` si no.

#### `migrations.rs`

Maneja el esquema de la base de datos. Contiene 16 migraciones (001 a 016) que se ejecutan en orden. Cada migración agrega columnas, crea tablas, o modifica datos.

**Migraciones importantes:**
- 001-003: tablas iniciales
- 007: soft delete (activo en productos)
- 012-013: anulación de ventas y detalles
- 014: sync_id para sincronización
- 015: sync para clientes
- 016: updated_at en productos + tabla de conflictos

#### `sync/` (módulo de sincronización con Supabase)

Dividido en 6 archivos:

- **mod.rs**: funciones compartidas (`supabase_post`, `supabase_get`, `supabase_config`, `urlencoding`, `normalize_fecha`, `emit_progress`).
- **products.rs**: sube categorías y productos activos a Supabase (upsert por código), descarga productos (sin sobrescribir stock local).
- **sales.rs**: sube ventas nuevas/modificadas con sus detalles, descarga ventas de otros dispositivos (insert or ignore por sync_id) y ajusta stock local.
- **clients.rs**: sube/baja clientes con sync_id.
- **conflicts.rs**: detecta y resuelve conflictos cuando un mismo registro fue modificado en dos dispositivos simultáneamente.
- **orchestrator.rs**: `sync_all()` — comando unificado que ejecuta upload y download de todo, emitiendo progreso vía eventos Tauri.

Concepto importante: la sincronización NO es en tiempo real. Cada dispositivo tiene timestamps de último upload/download y sube solo lo que cambió después de ese timestamp.

### 3.4 SQLite y la base de datos

Archivo: `gestor_ventas.db` (se crea automáticamente al lado del ejecutable).

Esquema (simplificado):

```sql
-- Usuarios del sistema
usuarios (id, username, password, rol)

-- Productos
productos (codigo, nombre, precio_usd, stock, stock_minimo, activo, created_at, updated_at)

-- Clientes
clientes (id, nombre, credito_activo, saldo_deuda_usd, sync_id, updated_at)

-- Ventas
ventas (id, fecha_hora, usuario_id, metodo_pago, ..., total_usd, tasa_aplicada, total_bs, sync_id, ...)

-- Detalles de cada venta
detalles_ventas (id, venta_id, producto_codigo, cantidad, precio_usd_unitario, sync_id, anulado)

-- Auditoría
historial_acciones (id, fecha_hora, usuario, accion)

-- Cierres de caja
cierres_caja (id, fecha_hora, usuario_id, total_ventas, total_usd, total_bs, tasa_cierre)
cierres_detalle (cierre_id, detalle_json)

-- Configuración clave/valor (tasa, tema, URL de Supabase, etc.)
configuracion (clave, valor)

-- Control de versiones del esquema
schema_version (version, applied_at)

-- Conflictos de sincronización
conflictos (id, tabla, item_id, local_json, remote_json, resuelto, created_at)
```

**PRAGMA importantes:**
- `journal_mode=WAL` → Write-Ahead Logging, mejora rendimiento de lecturas concurrentes
- `foreign_keys=ON` → activa restricciones de llaves foráneas

---

## 4. Frontend: HTML/CSS/JS

### Concepto "Single Page Application" artesanal

No usa React, Vue ni Angular. Todo está en tres archivos:

**`index.html`**: contiene todas las vistas posibles como `<section class="view" id="view-login">`, `<section class="view" id="view-pos">`, etc. Solo una vista está visible a la vez (clase `active`).

**`style.css`**: ~4000 líneas con 8 temas de color (oscuro, claro, azul, verde, morado, turquesa, naranja, menta). Usa variables CSS para los temas.

**`app.js`**: ~3650 líneas con toda la lógica. No usa frameworks ni librerías externas (excepto Font Awesome para iconos).

### Cómo funciona app.js

```
Al arrancar:
1. Espera DOMContentLoaded
2. Configura listeners de navegación (sidebar)
3. Restaura sesión (remember-me)
4. Muestra login si no hay sesión
5. Carga configuraciones del usuario (tema, sonido, tamaño fuente)
6. Inicia polling de tasa BCV
7. Inicia intervalo de sincronización automática

Flujo de navegación:
- showView('pos') → oculta todas las vistas, muestra solo #view-pos
- Los clics en el sidebar llaman showView()

Patrones usados:
- qs(selector) → document.querySelector(selector)
- escapeHtml(texto) → previene XSS
- invoke('comando', {args}) → llama Rust
- showToast(mensaje, tipo) → notificaciones
- confirmModal(texto, titulo, boton) → diálogos de confirmación
- formatUSD(monto) → formatea como $1,234.56
- playSound(tipo) → beeps con Web Audio API
```

### Vistas principales

1. **Login**: formulario de inicio de sesión
2. **POS (Caja)**: el corazón — búsqueda de productos, carrito, checkout
3. **Inventario**: tabla de productos con CRUD, búsqueda, paginación, import/export
4. **Reportes**: filtros por fecha/producto/usuario, gráficos de barras y pastel
5. **Clientes**: lista, creación, historial de crédito, abonos
6. **Auditoría**: historial de acciones con paginación
7. **Configuración**: tasa, tema, sonido, backup, sincronización, usuarios
8. **Dashboard**: resumen de ventas con gráficos (barras y pastel)

### Módulos del frontend (dentro de app.js)

| Líneas | Sección | Descripción |
|--------|---------|-------------|
| 1-92 | Constantes | Config keys, métodos de pago, constantes de UI |
| 93-200 | Selectores (SEL) | Todos los IDs del DOM centralizados |
| 200-357 | Helpers | qs, escapeHtml, formatUSD, showToast, etc. |
| 357-599 | Audio | Sonidos con Web Audio API |
| 599-890 | Login/Auth | DOMContentLoaded, login, logout, remember-me |
| 890-1480 | POS/Caja | productSearch, cart, checkout, pago mixto |
| 1480-1800 | Inventario | CRUD productos, paginación, import/export |
| 1800-1980 | Reportes | Filtros, tabla, exportar XLSX |
| 1980-2180 | Clientes | Lista, crédito, abonos, historial |
| 2180-2370 | Auditoría | Logs de acciones y cierres |
| 2370-2710 | Dashboard/Charts | Gráficos canvas, toggle barras/pastel |
| 2710-2840 | Varios | Historial de producto, detalle venta, anulación |
| 2840-3656 | Init | DOMContentLoaded, event listeners, init |

---

## 5. Sincronización con Supabase

Supabase es un backend como servicio (BaaS) que provee una base de datos PostgreSQL con API REST.

**¿Para qué sirve?** Para que múltiples dispositivos compartan los mismos datos. Ejemplo: una PC en la bodega y un celular en la calle.

**Cómo funciona:**

1. Cada dispositivo se registra con un UUID único (`dispositivo_id`).
2. Cada venta, cliente y producto tiene un `sync_id` (UUID) y `updated_at` (timestamp).
3. Cuando sincronizas:
   - **Upload**: subes a Supabase todo lo que cambió desde tu último upload.
   - **Download**: bajas de Supabase todo lo que cambió desde tu último download, PERO solo lo de OTROS dispositivos.
4. Los datos se insertan o ignoran por `sync_id` (no se duplican).

**Tablas en Supabase:**
- `dispositivos` — dispositivos registrados
- `categorias` — categorías de productos
- `productos` — productos con sync_id
- `clientes` — clientes con sync_id
- `ventas` — ventas con sync_id
- `detalles_ventas` — detalles con sync_id

**Resolución de conflictos**: cuando dos dispositivos modifican el mismo registro en menos de 5 minutos, se marca como conflicto en la tabla local `conflictos`. El usuario decide si mantener la versión local o la remota.

---

## 6. Flujo de una venta

Este es el camino que sigue una venta desde que el cajero escanea un producto hasta que se guarda en la base de datos:

```
1. Cajero escribe código en #product-search
2. app.js → invoke('list_products', { search: codigo, page: 1, page_size: 50 })
3. Rust: list_products() busca en SQLite, devuelve productos
4. app.js muestra resultados en #product-search-body
5. Cajero hace clic en un producto
6. app.js lo agrega al carrito (array en memoria)
7. app.js recalcula totales (USD y Bs según tasa actual)
8. Cajero hace clic en "Cobrar" (#checkout-btn)
9. app.js abre #payment-modal con opciones de pago
10. Cajero selecciona método, ingresa monto, confirma
11. app.js → invoke('create_sale', { request })
12. Rust: create_sale() ejecuta:
    a. validate_sale_request() — validaciones
    b. execute_sale_transaction() — todo en una transacción:
       - Calcula total USD recorriendo productos
       - Valida stock de cada producto
       - Valida pago mixto si aplica
       - Inserta en tabla ventas (con sync_id UUID)
       - Por cada producto: inserta detalle, descuenta stock
       - Si es crédito: aumenta deuda del cliente
       - Audita la acción
       - COMMIT
13. Rust devuelve el objeto Venta creado
14. app.js muestra toast de éxito, reproduce sonido, limpia carrito
15. Si config tiene sonido, reproduce beep de éxito
16. Programa subida a Supabase (scheduleSaleUpload)
```

---

## 7. Android

La misma aplicación corre en Android gracias a Tauri Mobile.

**Generación del proyecto Android**:
```sh
npm run tauri android init
```

Esto crea `src-tauri/gen/android/` con un proyecto Gradle estándar.

**SDK mínimo**: Android 7.0 (API 24)

**Diferencias con desktop:**
- La base de datos se guarda en `/data/data/com.gestor-ventas.app/databases/`
- El viewport se ajusta para móviles (sin `user-scalable=no`, con `viewport-fit=cover`)
- CSS `touch-action: manipulation` para evitar delays
- Sidebar colapsable, bottom-tabs, inputs con `inputmode="numeric"`
- Focus trap (al abrir un modal, el foco se mantiene dentro)
- Animación slideUp en modales
- Safe area insets para notchs y barras de navegación

**APK firmado**: requiere un keystore (ya existe en `src-tauri/release-key.keystore`).

---

## Conceptos técnicos clave

### ? (operador de propagación de errores en Rust)

```rust
fn hacer_algo() -> Result<String, String> {
    let x = funcion_que_puede_fallar()?;
    // Si funcion_que_puede_fallar() devuelve Err(e),
    // la función retorna inmediatamente Err(e).
    // Si devuelve Ok(v), x = v.
    Ok(x)
}
```

### Mutex

Un Mutex (Mutual Exclusion) permite que solo un hilo acceda a un recurso a la vez. En el proyecto, envolvemos la conexión SQLite en un Mutex porque Tauri puede ejecutar múltiples comandos en paralelo.

```rust
pub struct AppState {
    pub db: Mutex<Connection>,  // Solo un comando a la vez puede usar la BD
}
```

### Result y Option (monads de Rust)

- `Result<T, E>` → Ok(T) o Err(E) — para operaciones que pueden fallar.
- `Option<T>` → Some(T) o None — para valores opcionales.

Son la forma de Rust de evitar punteros nulos y excepciones.

### Transacciones SQLite

Varias operaciones que deben ocurrir juntas o ninguna. Ejemplo: al crear una venta, si falla al insertar el tercer producto, TODO se deshace (rollback).

```rust
let tx = db.transaction()?;
tx.execute("INSERT ...")?;  // Si falla, todo se revierte
tx.execute("UPDATE ...")?;
tx.commit()?;  // Confirma todo
```
