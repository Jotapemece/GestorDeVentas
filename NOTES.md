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

### Archivos modificados
- `src-tauri/Cargo.toml` — añadido `[profile.release]` con optimizaciones de tamaño
- `src-tauri/tauri.conf.json` — añadida sección `windows` con NSIS + WebView2 config
- `NOTES.md` — esta entrada
