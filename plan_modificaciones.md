# Plan de Modificaciones

**Prioridad:** Alta > Media > Baja

---

## Hallazgos de auditoría

### [ALTA] Uso de `.expect()` y `.unwrap()` en db.rs (módulo de inicialización)

- **Archivo:** `src-tauri/src/db.rs`
- **Líneas:** 35, 43, 132, 189
- **Descripción del problema:** Se usa `.expect()` en operaciones críticas de inicialización de BD. Aunque es código de migración, viola la norma de manejo de errores (Regla #4). Un fallo aquí crashea la aplicación sin gracefully degradation.
- **Fix sugerido:** Reemplazar `.expect()` con `.map_err(|e| format!("..."))` y propagar el error, o usar logging + fallback seguro. En `init_db()`, retornar `Result<Connection, String>` y manejar el error en `lib.rs`.
- **Esfuerzo:** Medio
- **Estado:** pendiente

---

### [ALTA] SQL hardcoded en db.rs fuera de constantes

- **Archivo:** `src-tauri/src/db.rs`
- **Líneas:** 48-130, 168-188, 276, 283, 297, 359, 367, 372, 377
- **Descripción del problema:** Múltiples sentencias SQL inline dentro de `execute_batch()` e `execute()` sin estar definidas como constantes. Viola norma A (Anti-Hardcoding) y G (SoC - SQL debe estar en constantes).
- **Fix sugerido:** Extraer todas las sentencias SQL a constantes `const SQL_XXX: &str = "..."` al inicio del módulo, incluso si son usadas solo en `db.rs`. Ejemplo: `const SQL_CREATE_TABLES: &str = "..."` para el batch principal.
- **Esfuerzo:** Medio
- **Estado:** pendiente

---

### [ALTA] Duplicación de constante `SQL_INSERT_HISTORIAL` entre módulos

- **Archivos:** `src-tauri/src/auth.rs` (línea 9), `src-tauri/src/products.rs` (línea 38), `src-tauri/src/sales.rs` (línea 17), `src-tauri/src/clients.rs` (línea 39), `src-tauri/src/cashier.rs` (línea 39)
- **Descripción del problema:** La misma consulta SQL está duplicada en 5 módulos diferentes. Viola norma B (DRY) y C (SPOT). Si cambia la estructura de `historial_acciones`, hay que actualizar 5 lugares.
- **Fix sugerido:** Mover `SQL_INSERT_HISTORIAL` a un módulo compartido (`db.rs` o `constants.rs`) y reexportarla. Crear una función helper `fn log_audit(db: &Connection, usuario: &str, accion: &str) -> Result<(), String>` que centralice la lógica.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

### [ALTA] Duplicación de `SQL_USERNAME_BY_ID` entre módulos

- **Archivos:** `src-tauri/src/sales.rs` (línea 15), `src-tauri/src/cashier.rs` (línea 49)
- **Descripción del problema:** Misma consulta duplicada. Viola norma B (DRY) y C (SPOT).
- **Fix sugerido:** Mover a `db.rs` o `constants.rs` como constante compartida, o crear función helper `fn get_username_by_id(db: &Connection, id: i64) -> Result<String, String>`.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

### [ALTA] Duplicación de `SQL_TASA` entre módulos

- **Archivos:** `src-tauri/src/sales.rs` (línea 32), `src-tauri/src/cashier.rs` (línea 12)
- **Descripción del problema:** Misma consulta duplicada. Viola norma B (DRY) y C (SPOT).
- **Fix sugerido:** Mover a `constants.rs` (ya existe `CFG_TASA_DOLAR`) y crear constante `SQL_GET_TASA` compartida, o función helper `fn get_tasa(db: &Connection) -> Result<f64, String>`.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

### [MEDIA] Números mágicos en sales.rs y cashier.rs

- **Archivos:** `src-tauri/src/sales.rs` (línea 238: `limit.unwrap_or(100)`), `src-tauri/src/cashier.rs` (línea 159: `.unwrap()` en sort)
- **Descripción del problema:** El valor `100` es un literal numérico dentro de lógica. En cashier.rs línea 159, `.unwrap()` en `partial_cmp` puede panickear si hay NaN.
- **Fix sugerido:** 
  - En sales.rs: crear constante `const VENTAS_LIMIT_DEFAULT: i64 = 100;` en `constants.rs` y usarla.
  - En cashier.rs: usar `.unwrap_or(Ordering::Equal)` en lugar de `.unwrap()` para evitar panic.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

### [MEDIA] Hardcoded strings en config.rs `list_theme_names()`

- **Archivo:** `src-tauri/src/config.rs`
- **Líneas:** 37-47
- **Descripción del problema:** Los 7 nombres de tema están hardcodeados directamente en la función. Si se agrega un tema, hay que modificar esta función. Viola norma A (Anti-Hardcoding) y C (SPOT).
- **Fix sugerido:** Mover array a `constants.rs` como `pub const TEMAS_DISPONIBLES: &[&str] = &[...]` y que `list_theme_names()` retorne `TEMAS_DISPONIBLES.iter().map(|s| s.to_string()).collect()`.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

### [MEDIA] JS: selectores DOM inline en app.js (dentro de funciones)

- **Archivo:** `src/app.js`
- **Líneas:** Múltiples (ej: línea 155 `qs(SEL.toast)`, línea 224 `qs(SEL.loginUsername)`)
- **Descripción del problema:** Aunque existe el objeto `SEL` con selectores, algunos elementos se obtienen vía `document.getElementById()` o propiedades dinámicas sin pasar por `SEL`. Revisar consistencia.
- **Fix sugerido:** Auditar todo el archivo y asegurar que TODO selector DOM use `qs(SEL.XXX)`. Agregar cualquier selector faltante al objeto `SEL`.
- **Esfuerzo:** Medio
- **Estado:** pendiente

---

### [MEDIA] JS: string `'1'` y `'0'` para sonido en config

- **Archivo:** `src/app.js`
- **Líneas:** 1757, 1818
- **Descripción del problema:** Valores `'1'` y `'0'` usados como literales para estado booleano de sonido. Viola norma E (Sin Números/Textos Mágicos).
- **Fix sugerido:** Definir constantes `const SOUND_ENABLED = '1'; const SOUND_DISABLED = '0';` al inicio del módulo y usarlas.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

### [BAJA] Función `check_admin()` redundante en auth.rs

- **Archivo:** `src-tauri/src/auth.rs`
- **Líneas:** 41-54
- **Descripción del problema:** Existe `require_admin()` (líneas 18-39) que hace verificación + logging, pero también existe `check_admin()` que solo verifica. Se usa `check_admin()` en `create_usuario` y `list_usuarios`, pero no loguea la acción antes de ejecutar. Inconsistencia en auditoría.
- **Fix sugerido:** Eliminar `check_admin()` y usar `require_admin()` con un mensaje genérico en todos los casos, o renombrar a `verify_admin_no_log()` si realmente se necesita versión sin log. Documentar decisión.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

### [BAJA] Falta validación de rol en frontend para UI .admin-only

- **Archivo:** `src/app.js`
- **Líneas:** 168-171 (`applyRoleUI()`)
- **Descripción del problema:** La función oculta elementos `.admin-only` basándose en `currentUser.rol`, pero no hay protección real: un usuario con conocimiento técnico podría mostrar los elementos vía consola. Además, no hay feedback visual de "por qué" está oculto.
- **Fix sugerido:** Agregar tooltip o atributo `title` explicativo en elementos ocultos: `title="Solo administradores"`. Considerar remover completamente del DOM en vez de solo `display:none`.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

### [BAJA] CSP permite `'unsafe-inline'` en style-src y script-src

- **Archivo:** `src-tauri/tauri.conf.json`
- **Líneas:** 22
- **Descripción del problema:** La CSP actual permite estilos y scripts inline por seguridad relajada. Esto es necesario actualmente porque el CSS tiene estilos inline dinámicos y el JS se inyecta en HTML, pero reduce seguridad.
- **Fix sugerido:** Evaluar si se puede eliminar `'unsafe-inline'` moviendo todos los estilos dinámicos a CSS classes y asegurando que no haya `<script>` inline en index.html. Si no es posible, documentar la justificación en README.
- **Esfuerzo:** Alto
- **Estado:** pendiente

---

## Propuestas de mejora

### [MEDIA] Centralizar helpers de auditoría en módulo `audit.rs`

- **Archivos afectados:** `src-tauri/src/*.rs` (todos los que llaman a `SQL_INSERT_HISTORIAL`)
- **Justificación:** Actualmente cada módulo ejecuta su propio INSERT de auditoría. Centralizar en `audit.rs` con funciones `log_action(db, usuario, accion)` mejora cohesión (norma J) y facilita agregar features futuras (ej: timestamps centralizados, filtrado de acciones sensibles).
- **Fix sugerido:** 
  1. Mover `SQL_INSERT_HISTORIAL` a `audit.rs` como `pub const`.
  2. Crear `pub fn log_action(db: &Connection, usuario: &str, accion: &str) -> Result<(), String>`.
  3. Actualizar todos los módulos para llamar `audit::log_action(...)` en vez de ejecutar directamente.
- **Esfuerzo:** Medio
- **Estado:** pendiente

---

### [MEDIA] Agregar tests unitarios para funciones puras en Rust

- **Archivos afectados:** `src-tauri/src/*.rs`
- **Justificación:** No hay tests automatizados. Funciones como `hash_password()`, `siguiente_dia()`, validaciones de pago, etc., son candidatas ideales para tests unitarios. Mejora mantenibilidad y previene regresiones.
- **Fix sugerido:** Agregar módulo `#[cfg(test)]` en cada archivo con tests para funciones puras. Empezar con:
  - `auth::hash_password()` (verificar determinismo)
  - `cashier::siguiente_dia()` (casos borde: fin de mes, año bisiesto)
  - `sales::validar_pago_detalle()` (casos válidos/inválidos)
- **Esfuerzo:** Alto
- **Estado:** pendiente

---

### [BAJA] Documentar decisiones técnicas en decisiones.md

- **Archivo:** `raíz/decisiones.md` (no existe)
- **Justificación:** El proyecto tiene decisiones importantes (7 temas, SHA-256 para passwords, WAL mode, soft delete vs hard delete) que no están documentadas. Futuros mantenedores no entenderán el "por qué".
- **Fix sugerido:** Crear `decisiones.md` con formato ADR (Architecture Decision Record):
  - ADR-001: Uso de SHA-256 para hashing de contraseñas (simple, offline, sin dependencias extra)
  - ADR-002: Soft delete para productos con historial de ventas (preservar integridad referencial)
  - ADR-003: 7 temas predefinidos vía CSS variables (sin JS para colores, performance)
  - ADR-004: SQLite WAL mode + foreign keys ON (concurrencia + integridad)
- **Esfuerzo:** Medio
- **Estado:** pendiente

---

### [BAJA] Refactorizar `db.rs` para separar migraciones por versión

- **Archivo:** `src-tauri/src/db.rs`
- **Justificación:** Las migraciones están secuenciales en `init_db()`. Si el proyecto crece, será difícil trackear qué migración corresponde a qué versión del schema.
- **Fix sugerido:** Implementar sistema de versionado de schema:
  1. Agregar tabla `schema_version(version INTEGER)`.
  2. Cada migración en función separada `migrate_v1_to_v2()`, `migrate_v2_to_v3()`, etc.
  3. En `init_db()`, leer versión actual y ejecutar migraciones pendientes en orden.
- **Esfuerzo:** Alto
- **Estado:** pendiente

---

### [BAJA] Agregar índice en `productos(categoria_id)`

- **Archivo:** `src-tauri/src/db.rs`
- **Línea:** ~158 (donde se agrega columna `categoria_id`)
- **Justificación:** Se hacen filtros por `categoria_id` en `products.rs` (líneas 52-76). Sin índice, queries en inventarios grandes serán lentos.
- **Fix sugerido:** Agregar `CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);` después de agregar la columna.
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

### [BAJA] Validar que `tasa > 0` antes de permitir venta

- **Archivo:** `src-tauri/src/sales.rs`
- **Líneas:** 72-233 (`create_sale()`)
- **Justificación:** No hay validación explícita de que `request.tasa > 0`. Una venta con tasa 0 generaría `total_bs = 0`, lo cual es incorrecto.
- **Fix sugerido:** Agregar check al inicio de `create_sale()`:
  ```rust
  if request.tasa <= 0.0 {
      return Err("La tasa del dólar debe ser mayor a cero".to_string());
  }
  ```
- **Esfuerzo:** Bajo
- **Estado:** pendiente

---

## Resumen de prioridades

| Prioridad | Cantidad | Esfuerzo total estimado |
|-----------|----------|-------------------------|
| Alta      | 7        | 4-6 horas               |
| Media     | 4        | 6-8 horas               |
| Baja      | 6        | 8-12 horas              |

**Total estimado:** 18-26 horas de trabajo

---

## Notas adicionales

1. **No se encontraron violaciones graves** a las reglas de "Cero SQL en frontend" ni "Sin dependencias externas". El proyecto cumple bien con estas normas fundamentales.

2. **El uso de constantes SQL** ya está bien implementado en la mayoría de módulos (`products.rs`, `sales.rs`, `auth.rs`). Solo falta extenderlo a `db.rs` y consolidar duplicados.

3. **La arquitectura modular por dominio** (SoC - Separation of Concerns) está bien aplicada: cada módulo maneja su entidad correspondiente sin mezclar lógica.

4. **El frontend vanilla JS** sigue buenas prácticas con el objeto `SEL` para selectores y funciones utilitarias (`qs`, `qsa`, `showToast`, `formatUSD`). Solo hay pequeños ajustes por hacer.

5. **Los 7 temas vía CSS variables** están correctamente implementados en `style.css` sin JS para colores, cumpliendo la norma K.
