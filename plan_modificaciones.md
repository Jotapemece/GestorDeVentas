# Plan de Modificaciones

**Prioridad:** Alta > Media > Baja

**Objetivo principal:** Adaptar el proyecto POS para que funcione correctamente en Android mediante Tauri v2 Mobile.

---

## Hallazgos de auditoría

### 🔴 PRIORIDAD ALTA (Bloqueantes para Android)

#### 1. Ruta de base de datos incompatible con Android
- **Archivo:** `src-tauri/src/db.rs`
- **Línea:** 93-104
- **Descripción del problema:** La función `get_db_path()` usa `CARGO_MANIFEST_DIR` para construir rutas relativas al sistema de archivos del proyecto. En Android, el almacenamiento es sandboxed y no se puede escribir arbitrariamente. La DB debe guardarse en el directorio de datos de la app (`context.dir()`).
- **Fix sugerido:** Usar `tauri::AppHandle::path()` o `std::env::var("TAURI_ANDROID_DATA_PATH")` para obtener el directorio apropiado en móvil. Implementar lógica condicional `cfg!(target_os = "android")`.
- **Esfuerzo:** Medio
- **Estado:** pendiente

#### 2. Importación de productos usa ruta de archivo hardcoded
- **Archivo:** `src-tauri/src/products.rs`, `src/app.js`
- **Línea:** `products.rs:306-325`, `app.js:986`
- **Descripción del problema:** La función `import_products_from_file` recibe un `file_path` string y usa `std::fs::read_to_string`. En Android no hay acceso directo al sistema de archivos. Se necesita el plugin `tauri-plugin-dialog` para file picking y `tauri-plugin-fs` para lectura.
- **Fix sugerido:** 
  1. Agregar plugins: `tauri-plugin-dialog = "2"` y `tauri-plugin-fs = "2"` en `Cargo.toml`
  2. Registrar plugins en `lib.rs`
  3. En frontend, usar `invoke('open_dialog')` para seleccionar archivo
  4. Leer contenido vía `invoke('read_file_text', { path })` del plugin fs
- **Esfuerzo:** Alto
- **Estado:** pendiente

#### 3. Exportación XLSX usa ruta relativa al ejecutable
- **Archivo:** `src-tauri/src/products.rs`
- **Línea:** 280-299
- **Descripción del problema:** `export_products_xlsx` guarda el archivo en `current_exe().parent()/productos_export.xlsx`. En Android esto fallará por permisos. Se necesita guardar en Downloads o usar File Saver API.
- **Fix sugerido:** Usar `tauri-plugin-dialog` para preguntar dónde guardar, o guardar en directorio de datos de la app y luego usar Intent de Android para compartir. Alternativa: retornar el contenido Base64 al frontend y descargar vía blob.
- **Esfuerzo:** Alto
- **Estado:** pendiente

#### 4. Falta configuración de permissions para Android
- **Archivo:** `src-tauri/gen/android/app/src/main/AndroidManifest.xml`
- **Línea:** N/A (archivo generado, pero requiere revisión)
- **Descripción del problema:** El Manifiesto solo tiene permiso INTERNET. Para funcionalidad completa se necesitan permisos de almacenamiento externo (si se usa), vibración (opcional), etc.
- **Fix sugerido:** Configurar `tauri.conf.json` sección `bundle.android.permissions` para inyectar permisos automáticamente, o modificar el template antes de build.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

#### 5. No hay manejo de ciclo de vida móvil (pause/resume)
- **Archivo:** `src/app.js`
- **Línea:** N/A
- **Descripción del problema:** En Android la app puede ser pausada/resumida. No hay listeners para `tauri://focus` / `tauri://blur` que puedan afectar estado (ej: cerrar modal, guardar sesión).
- **Fix sugerido:** Agregar event listeners para eventos de ventana Tauri mobile. Guardar estado crítico antes de pause.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

### 🟡 PRIORIDAD MEDIA (Mejoras significativas)

#### 6. UI no optimizada para pantallas táctiles pequeñas
- **Archivo:** `src/style.css`, `src/index.html`
- **Línea:** Varias
- **Descripción del problema:** Botones y inputs pueden ser muy pequeños para dedos. No hay media queries específicos para mobile. El sidebar ocupa espacio valioso en portrait.
- **Fix sugerido:** 
  - Agregar media query `@media (max-width: 768px)` en style.css
  - Aumentar padding/touch targets a mínimo 44x44px
  - Considerar sidebar colapsable o bottom navigation en mobile
  - Usar `touch-action: manipulation` para mejor respuesta táctil
- **Esfuerzo:** Medio
- **Estado:** pendiente

#### 7. Falta soporte para orientación de pantalla
- **Archivo:** `src-tauri/tauri.conf.json`, `src/style.css`
- **Línea:** N/A
- **Descripción del problema:** No hay configuración para lockear orientación o adaptar layout dinámicamente entre portrait/landscape.
- **Fix sugerido:** 
  - En `tauri.conf.json` agregar configuración Android para permitir ambas orientaciones
  - En CSS, usar `@media (orientation: portrait)` para ajustes específicos
  - En JS, escuchar `screen.orientation.change` si está disponible
- **Esfuerzo:** Bajo
- **Estado:** pendiente

#### 8. Print receipt no funciona en Android
- **Archivo:** `src/app.js`
- **Línea:** 557-590
- **Descripción del problema:** `printReceipt()` usa iframe oculto y `contentWindow.print()`. Android WebView no soporta impresión nativa igual que desktop. Se necesita plugin de impresión o compartir PDF.
- **Fix sugerido:** 
  - Opción A: Usar `tauri-plugin-printer` (si existe para mobile)
  - Opción B: Generar PDF en Rust (agregar crate `printpdf` o similar) y compartir vía Intent
  - Opción C: Mostrar recibo como modal "imprimible" y usar screenshot nativo
- **Esfuerzo:** Alto
- **Estado:** pendiente

#### 9. Sonidos Web Audio API pueden no sonar en background
- **Archivo:** `src/app.js`
- **Línea:** 184-202
- **Descripción del problema:** `AudioContext` se suspende en segundo plano en móviles. Los sonidos de feedback (add/remove) no sonarán si la app está minimizada.
- **Fix sugerido:** Reanudar `audioCtx` en evento `focus`. Considerar usar Vibration API como fallback (`navigator.vibrate()`).
- **Esfuerzo:** Bajo
- **Estado:** pendiente

#### 10. Fullscreen API puede comportarse diferente en Android
- **Archivo:** `src/app.js`
- **Línea:** 204-210
- **Descripción del problema:** `requestFullscreen()` en Android puede tener restricciones o requerir interacción del usuario. Inmersive mode es diferente.
- **Fix sugerido:** Usar Tauri's `window.set_fullscreen(true)` desde backend si está disponible para mobile, o aceptar limitaciones del WebView.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

#### 11. No hay splash screen configurado para Android
- **Archivo:** `src-tauri/gen/android/` (resources)
- **Línea:** N/A
- **Descripción del problema:** Al abrir la app en Android, se verá pantalla blanca hasta que cargue el WebView. Mala UX.
- **Fix sugerido:** Configurar splash screen en `tauri.conf.json` sección `bundle.android.splashScreen` o agregar drawable de launch theme.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

#### 12. Back button de Android no manejado
- **Archivo:** `src/app.js`
- **Línea:** N/A
- **Descripción del problema:** El botón físico/back gesture de Android no está interceptado. Debería cerrar modales primero, luego navegar entre vistas, finalmente salir o ir a home.
- **Fix sugerido:** Escuchar evento `tauri://back-button` (si disponible) o usar `window.addEventListener('popstate')`. Implementar stack de navegación.
- **Esfuerzo:** Medio
- **Estado:** pendiente

---

### 🟢 PRIORIDAD BAJA (Nice-to-have)

#### 13. Falta icono adaptativo para Android
- **Archivo:** `src-tauri/icons/`
- **Línea:** N/A
- **Descripción del problema:** Android requiere adaptive icons (foreground/background layers). Actualmente solo hay iconos PNG tradicionales.
- **Fix sugerido:** Generar adaptive icon resources XML + drawables. Configurar en `AndroidManifest.xml`.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

#### 14. No hay deep linking configurado
- **Archivo:** `src-tauri/tauri.conf.json`, `AndroidManifest.xml`
- **Línea:** N/A
- **Descripción del problema:** No se puede abrir la app desde URLs externas o intents.
- **Fix sugerido:** Configurar intent-filter en manifest si se requiere apertura vía URL scheme.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

#### 15. Versión de Android SDK podría actualizarse
- **Archivo:** `src-tauri/gen/android/app/build.gradle.kts`
- **Línea:** 14-16
- **Descripción del problema:** `compileSdk = 37`, `targetSdk = 37`. Verificar que sea la versión estable más reciente al momento del build.
- **Fix sugerido:** Actualizar a última versión estable de Android SDK antes de release.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

## Propuestas de mejora adicionales (no solicitadas pero recomendadas)

### 16. Agregar logging estructurado para debugging en Android
- **Archivo:** `src-tauri/src/*.rs`
- **Justificación:** En Android no hay stdout visible. Usar `tracing` crate + `tauri-plugin-log` para logs persistentes.
- **Esfuerzo:** Medio

### 17. Implementar auto-backup de DB en Android
- **Archivo:** `src-tauri/src/db.rs`
- **Justificación:** Si el usuario desinstala, pierde datos. Auto-backup periódico a Downloads o cloud.
- **Esfuerzo:** Alto

### 18. Usar biometría para login rápido
- **Archivo:** Frontend + Rust backend
- **Justificación:** Android tiene APIs de huella/facial. Mejora UX para reapertura rápida.
- **Esfuerzo:** Alto

### 19. Notificaciones push locales para alertas
- **Archivo:** Nuevo módulo Rust + JS
- **Justificación:** Alertar sobre stock bajo o tasa no actualizada incluso con app cerrada.
- **Esfuerzo:** Medio

### 20. Cache de productos más agresivo en frontend
- **Archivo:** `src/app.js`
- **Justificación:** Reducir invokes a Rust. Usar `localStorage` para persistir cache entre sesiones.
- **Esfuerzo:** Bajo

---

## Instrucciones específicas para habilitar Android

### Paso 1: Agregar plugins necesarios a Cargo.toml

```toml
[dependencies]
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-opener = "2"
# ... resto de dependencias
```

### Paso 2: Registrar plugins en lib.rs

```rust
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

// En el builder:
tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    // ... resto
```

### Paso 3: Modificar db.rs para rutas Android-safe

```rust
fn get_db_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        // Usar directorio de datos interno de Android
        let data_dir = app_handle.path()
            .data_dir()
            .map_err(|e| e.to_string())?;
        Ok(data_dir.join("gestor_ventas.db"))
    }
    
    #[cfg(not(target_os = "android"))]
    {
        // Lógica actual para desktop
        let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        path.pop();
        path.push("gestor_ventas.db");
        Ok(path)
    }
}
```

### Paso 4: Pasar AppHandle a funciones que lo necesiten

Modificar signature de `init_db()`:
```rust
pub fn init_db(app_handle: &tauri::AppHandle) -> Result<Connection, String> {
    let db_path = get_db_path(app_handle)?;
    // ...
}
```

Y en `lib.rs`:
```rust
pub fn run() {
    tauri::Builder::default()
        // ... plugins
        .setup(|app| {
            let conn = init_db(&app.handle())?;
            app.manage(AppState { /* ... */ });
            Ok(())
        })
        // ... invoke handlers
}
```

### Paso 5: Implementar file picker en frontend para importación

Reemplazar input de texto por:
```javascript
async function openImportModal() {
  // En lugar de leer valor del input
  const filePath = await invoke('dialog_open', {
    title: 'Seleccionar archivo TSV',
    multiple: false,
    filters: [{ name: 'TSV', extensions: ['tsv', 'txt'] }]
  });
  
  if (filePath) {
    const content = await invoke('fs_read_text_file', { path: filePath });
    // Procesar contenido...
  }
}
```

### Paso 6: Configurar tauri.conf.json para Android

```json
{
  "bundle": {
    "android": {
      "permissions": [
        "INTERNET",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ],
      "minSdk": 24,
      "targetSdk": 34
    }
  },
  "app": {
    "windows": [{
      "fullscreen": false,
      "resizable": true,
      "mobile": {
        "enable": true
      }
    }]
  }
}
```

### Paso 7: Build para Android

```bash
# Instalar target Android
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

# Build debug
npx tauri android dev

# Build release
npx tauri android build --apk
```

---

## Resumen de esfuerzo estimado

| Prioridad | Cantidad | Esfuerzo total |
|-----------|----------|----------------|
| Alta      | 5        | ~3-4 días      |
| Media     | 7        | ~4-5 días      |
| Baja      | 3        | ~1 día         |

**Total estimado:** 8-10 días de desarrollo para Android fully functional.

---

*Documento generado: $(date)*
*Próximo paso: Crear decisiones.md con ADRs para cada decisión técnica.*
