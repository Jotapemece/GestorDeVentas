# Notas de Desarrollo - Gestor de Ventas

## 2026-07-15 — Solución: "index.html not found" en Android

### Problema
La app compilaba correctamente pero al abrirse mostraba pantalla negra con "index.html not found". El APK pesaba 300KB menos que la versión funcional (59.3MB vs 59.6MB).

### Causas
1. **`.cargo/config.toml` con linkers NDK** — Estaba configurado manualmente con rutas a la NDK v27, pero Tauri v2 ya maneja los linkers automáticamente a través de `cargo tauri android build`. Tenerlo interfería con la compilación cruzada nativa.

2. **Dependencia extra `androidx.constraintlayout:constraintlayout:2.2.1`** — Se agregó al `build.gradle.kts` pero la versión funcional no la incluye. Provocaba conflictos en el empaquetado del APK.

### Solución
Eliminar ambos del proyecto. El proyecto debe estar **idéntico** a la versión de Descargas (que es la misma base funcional).

### Verificación
`diff -rq --exclude=node_modules --exclude=target --exclude='.git' --exclude=build --exclude='.gradle' --exclude='.kotlin' --exclude='*.db*' --exclude=jniLibs --exclude=generated --exclude=assets --exclude=proguard-tauri.pro --exclude=tauri.build.gradle.kts --exclude=tauri.properties [dir1] [dir2]` debe mostrar **0 diferencias**.

---

## 2026-07-15 — Modo inmersivo + Bottom tabs con nombres

### Cambios
- **`MainActivity.kt`**: Agregado `SYSTEM_UI_FLAG_IMMERSIVE_STICKY` para ocultar barras de navegación del sistema Android. Se reocultan al recuperar el foco (`onWindowFocusChanged`).
- **`style.css`**:
  - `@media (max-width: 480px)`: `.nav-text` cambia de `display: none` a `display: block; font-size: 8px` para mostrar nombres en tabs inferiores.
  - `padding-bottom` de `#main-content` aumentado de 64px a 72px para que el contenido no se solape con los tabs más altos.

### Commit
`7f6670f` — "feat: modo inmersivo Android, nombres visibles en bottom-tabs, NOTES.md"

---

## 2026-07-16 — Auditoría UI/UX completa

### Problemas encontrados y soluciones

#### 1. Bloques CSS `[data-theme]` eran código muerto
- **Problema**: `style.css` tenía 7 bloques `[data-theme="..."]` (~120 líneas) con valores de color que diferían de los definidos en JS (`app.js` themes y script inline en `index.html`). JS aplica siempre estilos inline (especificidad 1-0-0), que vencen a los atributos CSS (0-1-0). Por tanto, esos bloques nunca se usaban.
- **Solución**: Eliminados completamente. El `:root` queda como fallback base.

#### 2. Clase duplicada `.btn-add` (idéntica a `.btn-accent`)
- **Problema**: `.btn-add` (línea 207-208) era idéntica a `.btn-accent` (línea 200-201). Creaba ambigüedad.
- **Solución**: Eliminada la clase CSS `.btn-add`. Cambiado `class="btn btn-add"` → `class="btn btn-accent"` en `index.html`.

#### 3. Función `hideToast` duplicada
- **Problema**: `app.js` línea 249 definía `hideToast(toastEl)` que era inmediatamente sobrescrita por `hideToast(el)` en línea 253 con lógica diferente (animación CSS). La primera versión era código muerto.
- **Solución**: Eliminada la primera definición (líneas 249-251).

#### 4. Faltaban indicadores de foco para teclado
- **Problema**: Solo `input:focus` tenía anillo visible. Botones y elementos de navegación no mostraban foco.
- **Solución**: Añadido `button:focus-visible`, `.nav-btn:focus-visible`, etc. con `outline: 2px solid var(--primary)`.

#### 5. Touch targets por debajo de 44px en móvil
- **Problema**: Múltiples elementos interactivos tenían `min-height: 36px` en lugar de los 44px recomendados (Material Design, iOS HIG):
  - `.cart-qty-input`
  - `.btn-sm`
  - `.tasa-input-group input`
  - `.abono-metodo-btn`
  - `.inventory-actions .btn`
- **Solución**: Todos cambiados a `min-height: 44px`.

#### 6. Menú desplegable (dropdown) se solapaba con bottom-tabs en móvil
- **Problema**: `.dropdown-menu` en móvil tenía `bottom: 80px` con `z-index: 100`. Los bottom-tabs tienen `z-index: 999`, causando solapamiento visual.
- **Solución**: Añadido `z-index: 1001` y `bottom: calc(80px + env(safe-area-inset-bottom, 0px))` para que el dropdown siempre esté sobre los tabs.

#### 7. Métodos de pago en cuadrícula 2-col en móvil
- **Problema**: 7 botones en 2 columnas creaban 4 filas con un botón huérfano.
- **Solución**: Cambiado a `grid-template-columns: 1fr 1fr 1fr` (3 columnas).

#### 8. Gráfico tipo donut sin fondo y con `setTimeout` frágil
- **Problema**: Canvas de gráficos circulares no tenía relleno de fondo. En temas oscuros, el texto de la leyenda podía ser ilegible. Además, `setTimeout(fn, 100)` para dibujar post-renderizado era frágil.
- **Solución**:
  - Añadido `ctx.fillRect(0, 0, w, h)` con el color `--card` como fondo del canvas.
  - Cambiado `setTimeout` a `requestAnimationFrame` (dos instancias).

#### 9. `lastCloseReportData` no se limpiaba al cerrar sesión
- **Problema**: Si se cerraba sesión y se iniciaba otra, el reporte de cierre anterior quedaba accesible.
- **Solución**: Añadido `lastCloseReportData = null` en `handleLogout`.

### Archivos modificados
- `src/style.css` — ~120 líneas eliminadas, ~10 líneas añadidas/modificadas
- `src/index.html` — 1 línea modificada (`btn-add` → `btn-accent`)
- `src/app.js` — ~5 líneas modificadas/eliminadas
- `NOTES.md` — esta entrada

---

## 2026-07-16 — Optimización para Windows 32-bit (x86) + 2GB RAM

### Compatibilidad con 32 bits

El código Rust es completamente compatible con 32-bit:
- Usa `i64`/`f64` en todos los modelos (no `usize` para datos de negocio)
- SQLite compila desde fuente para la arquitectura destino (`bundled`)
- No hay dependencias con ensamblador nativo o intrinsics x86-64

### Cambios realizados

#### 1. Perfil release optimizado para tamaño (`Cargo.toml`)

```toml
[profile.release]
opt-level = "z"      # Optimizar por tamaño binario
lto = true           # Link-time optimization
codegen-units = 1    # Compilación más lenta, binario más pequeño
strip = true         # Eliminar símbolos de depuración
panic = "abort"      # Sin tablas de unwinding (binario más pequeño)
```

Esto reduce el binario final ~40-60%, crucial para equipos con 2GB RAM y discos pequeños.

#### 2. Configuración del empaquetado Windows (`tauri.conf.json`)

- **Instalador NSIS** en lugar de MSI (más pequeño, más rápido de instalar)
- **`installMode: "currentUser"`** — instala solo para el usuario actual (no requiere admin)
- **`webviewInstallMode: { "type": "embedBootstrapper" }`** — el instalador descarga WebView2 si no está presente (sin depender de Windows Update). En equipos sin internet, usar `{ "type": "offlineInstaller" }` (pero el instalador pesa ~130MB extra).

### Requisitos mínimos estimados

| Componente | RAM estimada |
|------------|-------------|
| WebView2   | 100-200 MB  |
| Rust backend | ~5-15 MB  |
| SQLite     | ~2-5 MB     |
| SO + otros | ~500-800 MB |
| **Total**  | **~700 MB - 1 GB** |

Con 2GB RAM el sistema operativo dispone de ~1GB libre → la app funciona sin problemas.

### Cómo compilar para Windows 32-bit

#### Opción A: Compilación nativa en Windows (recomendada)

```powershell
# 1. Instalar Rust para x86
rustup target add i686-pc-windows-msvc

# 2. Compilar
npm install
npm run tauri build -- --target i686-pc-windows-msvc
```

#### Opción B: Cross-compile desde Linux (avanzado)

```bash
# 1. Instalar toolchain MinGW 32-bit
sudo apt install gcc-mingw-w64-i686

# 2. Agregar target Rust
rustup target add i686-pc-windows-gnu

# 3. Crear .cargo/config.toml para el linker
mkdir -p .cargo
cat > .cargo/config.toml << 'EOF'
[target.i686-pc-windows-gnu]
linker = "i686-w64-mingw32-gcc"
ar = "i686-w64-mingw32-ar"
EOF

# 4. Compilar
npm install
npm run tauri build -- --target i686-pc-windows-gnu
```

> ⚠️ El cross-compile desde Linux no puede generar instalador NSIS/MSI (solo el .exe portable). Para el instalador completo, compilar en Windows nativo.

### Requisito: NSIS (makensis)

Al hacer build para Windows (incluso cross-compile desde Linux), Tauri necesita el compilador NSIS para generar el instalador `.exe`:

- **En Linux (cross-compile):** `sudo apt install nsis`
  > Si Tauri busca `makensis.exe` en lugar de `makensis`, crear un symlink: `sudo ln -s /usr/bin/makensis /usr/local/bin/makensis.exe`

- **En Windows nativo:** NSIS se descarga automáticamente o se puede instalar desde https://nsis.sourceforge.io

También se puede omitir el instalador y generar solo el `.exe` portable con: `npm run tauri build -- --target i686-pc-windows-gnu --bundles none` (pero no tendrá instalador).

### Notas sobre WebView2 en equipos antiguos

- WebView2 requiere **Windows 10** (versión 1809+) o Windows 11
- En Windows 8.1/7, WebView2 se puede instalar manualmente pero no es recomendado
- Si la PC no tiene WebView2, el bootstrapper lo descarga (~2MB la primera vez)
- Para instalación completamente offline: cambiar `webviewInstallMode` a `"offlineInstaller"` (el installer crece ~130MB)

### Cómo generar un ejecutable portable (sin instalador)

Para saltarse el NSIS y generar solo el `.exe` autónomo:

```bash
# Opción 1: script automático (recomendado)
./build-portable.sh                 # 32-bit (por defecto)
./build-portable.sh x86_64-pc-windows-gnu  # 64-bit

# Opción 2: manual
npm run build:portable -- --target i686-pc-windows-gnu
# Luego copiar ambos archivos:
#   src-tauri/target/i686-pc-windows-gnu/release/gestor-ventas.exe
#   src-tauri/target/i686-pc-windows-gnu/release/WebView2Loader.dll
```

El contenido de `dist/gestor-ventas/` se copia a cualquier PC y funciona sin instalación.

> Nota: si `tauri build` falla igualmente en el paso de empaquetado, el `.exe` ya está compilado en `target/` antes de que el bundler intente ejecutarse. Puedes ignorar el error y tomar el `.exe` de ahí.

**Requisito en la PC destino:** WebView2 Runtime. En Windows 10/11 suele venir instalado. Si no:
- Descargar e instalar el [Evergreen WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (una sola vez, funciona para cualquier app que lo use)
- O el instalador NSIS ya lo descarga automáticamente (modo `embedBootstrapper`)

### Archivos modificados
- `src-tauri/Cargo.toml` — añadido `[profile.release]` con optimizaciones de tamaño
- `src-tauri/tauri.conf.json` — añadida sección `windows` con NSIS + WebView2 config
- `package.json` — añadido script `build:portable`
- `NOTES.md` — esta entrada

---

## 2026-07-16 — Fix: crash en Windows por ruta BD usando `CARGO_MANIFEST_DIR`

### Problema
La app se abría como pantalla en blanco y se cerraba inmediatamente en Windows.

### Causa
`get_db_path()` en `db.rs` usaba `env!("CARGO_MANIFEST_DIR")`, una constante de compilación que contiene la ruta del proyecto **en la máquina de build** (Linux). En la PC Windows destino esa ruta no existe, `Connection::open()` falla, y `lib.rs` llama a `std::process::exit(1)`.

### Solución
Cambiar la resolución de ruta en desktop para usar el directorio del ejecutable (`std::env::current_exe()`) en lugar de la ruta de compilación. Así:
- **Portable**: la BD se crea junto al `.exe` en cualquier carpeta
- **Instalado**: la BD se crea en el directorio de instalación
- También se simplificó `auto_import_products()` eliminando el fallback a `CARGO_MANIFEST_DIR` que era igualmente inválido en producción

### Archivos modificados
- `src-tauri/src/db.rs` — `get_db_path()` ahora usa `current_exe()`; `auto_import_products()` simplificado
- `NOTES.md` — esta entrada

---

## 2026-07-16 — Tasa BCV automática desde API

### Descripción
Se integró un botón 🔄 al lado del input de tasa que al presionarlo consulta la API `https://dolar-vzla.rafnixg.dev/api/v1/bcv/realtime` y actualiza la tasa automáticamente. El proyecto de referencia es `cuantoes-master` (Flutter, del amigo del usuario).

### Implementación

#### Backend (Rust)
- **`src-tauri/src/tasa_bcv.rs`** — Nuevo comando `fetch_tasa_bcv`. Usa `ureq` (HTTP client) para GET a la API, parsea JSON con serde y extrae `rate` del objeto con `currency: "dolar"`.
- **`Cargo.toml`** — dependencia `ureq = { version = "2", features = ["json"] }`

#### Frontend
- **`index.html`** — Botón con icono `nf-fa-refresh` junto al warning de tasa
- **`app.js`** — Función `fetchTasaBcv()`: llama al comando, guarda con `set_tasa`, refresca UI (precios, carrito, warning). Estado `.loading` con spinner.
- **`fa-local.css`** — Iconos `nf-fa-refresh` (\f021) y `nf-fa-cloud_download` (\f0ed)
- **`style.css`** — Estilos del botón, compatibilidad compact y mobile

### API Response
```json
[
  {"currency":"dolar","trade_type":"SELL","rate":727.45,"date":"..."},
  {"currency":"euro","trade_type":"SELL","rate":832.24,"date":"..."}
]
```

### Notas
- El campo es `rate`, no `price` (error inicial corregido en `51974d8`)
- La moneda es `"dolar"`, no `"USD"`
- Se usa `to_lowercase()` para match case-insensitive
- El comando es sincrónico (se ejecuta en thread pool de Tauri), no bloquea la UI
- No requiere cambios en CSP ni permisos porque la petición HTTP es desde Rust

### Archivos modificados
- `src-tauri/Cargo.toml` — añadido `ureq`
- `src-tauri/Cargo.lock` — lockfile actualizado
- `src-tauri/src/tasa_bcv.rs` — nuevo archivo
- `src-tauri/src/lib.rs` — registro del módulo y comando
- `src/index.html` — botón en tasa-input-group
- `src/app.js` — función fetchTasaBcv + event listener
- `src/fa-local.css` — iconos refresh y cloud_download
- `src/style.css` — estilos del botón
- `NOTES.md` — esta entrada

---

## 2026-07-16 — Mejoras: validaciones, XSS, coma automática, vuelto, edición clientes

### Cambios realizados (10 items)

#### Item 2 — Validación de tasa (>0)
- **Backend** (`sales.rs`): `set_tasa` rechaza valores ≤ 0 con error
- **Frontend** (`app.js`): `handleTasaChange` valida > 0, restaura valor anterior y muestra toast si inválido

#### Item 3 — Confirmación al cancelar venta
- (`app.js`): El botón × del carrito ahora muestra `confirmModal` antes de limpiar el carrito

#### Item 4 — XSS eliminado en 6 funciones render
- (`app.js`): `createProductRow`, `createCartRow`, `createInventoryRow`, `createClientRow`, `createAuditRow`, `createDailySaleRow` ahora usan `escapeHtml()` en todos los datos de usuario. También se escapaban `codigo` en data-atributos.

#### Item 6 — Spinner al confirmar pago + finally block
- (`app.js`): El botón "Confirmar Pago" muestra "Procesando..." y se bloquea. Se agregó bloque `finally` para resetear el flag `processingPayment` incluso si hay error fuera del try.
- (`style.css`): Clase `.btn.loading` con opacidad y pointer-events: none

#### Item 7 — Coma automática en input de precio
- **Constante**: `CFG_COMA_AUTOMATICA`
- **Función `parsePrecio(s)`**: reemplaza coma por punto antes de parsear
- **Función `applyComaAutomatica(input)`**: toma solo dígitos, divide entre 100, formatea con coma (ej: "150" → "1,50")
- **Toggle en Config**: activa/desactiva el comportamiento
- **Input type**: cambia entre `text` (coma activa) y `number` (inactiva)
- **Edit product**: muestra el precio formateado con coma si está activo

#### Item 9 — Vuelto para pagos en efectivo
- (`index.html`): Nuevo grupo `#cambio-group` con input "Monto recibido" y `#cambio-resultado` con el vuelto
- (`app.js`): Se muestra solo para métodos `efectivo_bs`/`efectivo_usd`. Calcula la diferencia y la muestra.
- Toggle "Calcular vuelto en efectivo" en Config (ON por defecto). Cuando OFF, no se muestra el vuelto aunque se pueda ingresar el monto.

#### Item 11 — escapeHtml escapa &
- (`app.js`): `escapeHtml` ahora reemplaza `&` por `&amp;` antes de los otros caracteres

#### Item 12 — playSound catch no muestra toast
- (`app.js`): Si el audio falla, solo desactiva `soundEnabled = false` sin mostrar toast (evita loop de errores)

#### Item 13 — Timeout en API BCV
- (`tasa_bcv.rs`): Se agregó `AgentBuilder` con `timeout_connect(10s)` y `timeout_read(10s)`, más User-Agent header

#### Item 15 — Editar y eliminar clientes (solo admin)
- **Backend** (`clients.rs`): `update_cliente(id, nombre)` y `delete_cliente(id)` con validación (nombre no vacío, solo si deuda=0)
- **Frontend** (`app.js`):
  - Botón ✏️ para editar nombre (reusa modal de cliente)
  - Botón 🗑️ para eliminar (solo si deuda=0, con confirmación)
  - Variable `editingClienteId` para distinguir crear/editar
- **Icono**: `nf-fa-pencil` (\f303) en `fa-local.css`

#### Extras — Redondeo efectivo Bs. y toggle vuelto
- Toggle "Redondear pago en efectivo Bs." en Config: cuando activo, el total Bs. se redondea a entero (`Math.round`) solo para pagos en efectivo Bs.
- Función `totalBsRedondeado(totalUsd)`: aplica el redondeo si está activo

### Archivos modificados (commits `7983545` + `dd65e56`)
- `src-tauri/src/sales.rs` — validación tasa > 0
- `src-tauri/src/tasa_bcv.rs` — timeout + User-Agent
- `src-tauri/src/clients.rs` — update_cliente, delete_cliente
- `src-tauri/src/lib.rs` — registro de comandos
- `src/app.js` — ~220 líneas cambiadas (escapeHtml, XSS, validación, confirm cancel, spinner, coma auto, vuelto, playSound, edit/delete clientes, toggles)
- `src/fa-local.css` — icono pencil
- `src/index.html` — cambio group, toggles config
- `src/style.css` — .btn.loading, cambio-resultado, mobile
- `NOTES.md` — esta entrada

---

## 2026-07-16 — Almacenar monto real en Bs. recibido en caja (total_bs)

### Problema
La caja siempre mostraba el total Bs. calculado como `total_usd * tasa_aplicada`. Si:
- `redondeoBs` estaba activo: se redondeaba el cálculo pero igual no se guardaba
- El cliente pagaba más sin pedir vuelto (ej: 900 Bs. por algo de 895): se perdía el dato real

### Solución
Se añadió la columna `total_bs` a las tablas `ventas` y `cierres_caja` para almacenar el monto real en Bs. recibido.

#### Backend
- **`migrations.rs`**: Migraciones `010` (ventas) y `011` (cierres_caja) para añadir columna + poblar datos existentes con `ROUND(total_usd * tasa_aplicada, 2)`
- **`models.rs`**: `CreateSaleRequest` ahora tiene `total_bs_ingresado: Option<f64>` — si se envía, se usa ese valor; si no, se calcula `total_usd * tasa` (redondeado a 2 decimales)
- **`sales.rs`**: INSERT ahora incluye `total_bs`. SELECT `list_sales` lee la columna almacenada (fallback a cálculo si es 0)
- **`cashier.rs`**:
  - Nuevo query `SQL_SUM_BS_RANGE` para sumar total_bs del día
  - `obtener_totales_del_dia` ahora devuelve `(cnt, usd, bs, tasa)` en lugar de `(cnt, usd, tasa)`
  - `get_daily_summary`, `close_cashier`, `compute_report_data_range` usan el suma real de Bs.
  - `list_cierres` y `get_cierre_detalle` leen `total_bs` almacenado (fallback a cálculo)

#### Frontend
- **`app.js`**: `confirmPayment` calcula y envía `total_bs_ingresado`:
  - Si `redondeoBs` activo: envía `totalBsRedondeado(total)` para cualquier método
  - Si efectivo_bs y `!calcularVuelto` y recibido > total: envía el monto recibido (el cliente pagó de más sin pedir vuelto)
  - Si efectivo_bs y `calcularVuelto` activo: se muestra cambio, pero el Bs. registrado es el total normal

### Archivos modificados
- `src-tauri/src/migrations.rs` — migraciones 010, 011 + schema inicial
- `src-tauri/src/models.rs` — `total_bs_ingresado` en `CreateSaleRequest`
- `src-tauri/src/sales.rs` — INSERT/SELECT con total_bs
- `src-tauri/src/cashier.rs` — queries y lógica actualizada
- `src/app.js` — lógica para pasar `total_bs_ingresado`
- `NOTES.md` — esta entrada
