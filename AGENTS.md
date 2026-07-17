# Gestor de Ventas

## Stack
- **Frontend**: HTML/CSS/JS vanilla + Font Awesome 6 Free (Nerd Font icons `.nf-fa-*`)
- **Backend**: Tauri v2 + Rust + SQLite (rusqlite bundled)
- **Mobile**: Android via Tauri mobile (generated in `src-tauri/gen/android/`)
- **Windows**: NSIS installer (embedBootstrapper webview)

## Comandos importantes

### Desarrollo
```sh
npm run dev        # Inicia servidor Tauri (Rust + frontend)
# F5 en frontend solo refresca HTML/JS/CSS (sin dev server)
# Para cambios en Rust, reiniciar npm run dev
```

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
cd src-tauri && cargo test --lib        # 23 tests (auth, config, sales)
cd src-tauri && cargo check             # Verifica compilación Rust
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
- `src/constants.rs` — Constantes (métodos de pago, config keys)

### `src/` (frontend)
- `app.js` — Toda la lógica frontend (~3047 líneas)
- `style.css` — Estilos con temas (oscuro, claro, azul, verde, morado, turquesa, naranja)
- `index.html` — HTML único con todas las vistas y modales
- `fa-local.css` — Iconos Font Awesome 6 Free autogenerados

## Base de datos
- Archivo: `gestor_ventas.db` (SQLite, se crea automáticamente)
- Backup: botón en Config → `backup_database` copia a `gestor_ventas_backup_YYYYMMDD_HHMMSS.db`
- Migraciones en `migrations.rs` (013 actual: `anulado` en `detalles_ventas`)

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
- Los IDs de elementos se definen en `const SEL = { ... }` en app.js
- `escapeHtml()` para todo texto insertado como HTML (XSS)
- `invoke('comando', { arg })` para llamadas Tauri
- `showToast(msg, type)` para notificaciones
- `confirmModal(text, title, confirmLabel)` para confirmaciones
- `playSound('add'|'remove')` para sonidos

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
