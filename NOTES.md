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
