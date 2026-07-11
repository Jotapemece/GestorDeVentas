# Plan de Modificaciones

**Prioridad:** Alta > Media > Baja

---

## Hallazgos de auditoría

### [ALTA] Violación SoC Frontend - Inline handlers en HTML y JS dinámico

**Archivos afectados:**
- `src/index.html` (líneas 147, 270, 638)
- `src/app.js` (líneas 182-183, 268, 358, 713-714, 856, 1102, 1233)

**Descripción del problema:**
El código contiene handlers inline (`onclick`, `onchange`, `oninput`, `onfocus`) tanto en HTML estático como en strings de HTML generado dinámicamente en JS. Esto viola la norma H (SoC Frontend) que establece "No mezclar lógica en HTML (onclick, etc.). Los event listeners se asignan en app.js."

Ejemplos específicos:
- `index.html:147` - `<button onclick="clearCart()">`
- `index.html:270` - `<button onclick="loadAuditMore()">`
- `index.html:638` - `<button onclick="printReceipt()">`
- `app.js:182-183` - HTML string con `onchange="updateCategoriaColor(...)"` y `onclick="deleteCategoria(...)"`
- `app.js:268` - HTML string con `onclick="addToCart(...)"` 
- `app.js:358` - HTML string con `oninput="handleCartQtyInput(...)"` y `onclick="removeFromCart(...)"`
- `app.js:713-714` - HTML string con `onclick="editProduct(...)"` y `onclick="showProductDetail(...)"`
- `app.js:856` - HTML string con `onclick="openDebtDetail(...)"` y `onclick="openAbonoModal(...)"`
- `app.js:1102` - HTML string con `onclick="printCloseReport()"`
- `app.js:1233` - HTML string con `onclick="showCierreDetalle(...)"`

**Fix sugerido:**
1. Para HTML estático (`index.html`): Eliminar atributos `onclick` y agregar IDs únicos. En `app.js`, registrar event listeners en la función de inicialización.
   ```html
   <!-- Antes -->
   <button id="cancel-sale-btn" onclick="clearCart()">×</button>
   
   <!-- Después -->
   <button id="cancel-sale-btn" data-action="clear-cart">×</button>
   ```
   
   ```js
   // En app.js, después de DOMContentLoaded o init
   qs('#cancel-sale-btn').addEventListener('click', clearCart);
   ```

2. Para HTML dinámico (`app.js`): Usar delegación de eventos o asignar listeners tras insertar el elemento.
   - Opción A (delegación): Un listener en el contenedor padre que detecte clicks en botones con data attributes.
   - Opción B: Tras crear el fragment/row, usar `querySelectorAll` para agregar listeners a los nuevos elementos.

**Esfuerzo:** Medio
**Estado:** pendiente

---

### [ALTA] Manejo de errores inconsistente en JS - invoke() sin .catch()

**Archivo:** `src/app.js` (múltiples líneas)

**Descripción del problema:**
La norma 5 establece: "Toda llamada a invoke() debe tener `.catch(err => showToast(err, 'error'))`. Errores de red/backend deben mostrarse al usuario. No silenciar errores con catch(e => {})."

Sin embargo, hay múltiples llamadas a `invoke()` sin manejo de errores adecuado:
- Líneas 92, 120, 131, 133, 144, 164, 214, 226, 234, 243, 645, 686, 706, 801, 803, 817, 825, 840, 850, 875, 884, 929, 987, 1002-1003, 1044, 1063-1064, 1226, 1248, 1307, 1325, 1363, 1380, 1388, 1530, 1536, 1579, 1584, 1593, 1599, 1612

Solo las líneas 1530 y 1536 tienen `.catch(() => {})`, pero silencian el error en lugar de mostrarlo.

**Fix sugerido:**
Envolver todas las llamadas `await invoke()` en bloques try-catch que muestren el error al usuario:
```js
// Patrón a aplicar
try {
    const result = await invoke('comando', args);
    // procesar resultado
} catch (err) {
    showToast(err, 'error');
    throw err; // si es necesario propagar
}
```

Para operaciones no críticas (como guardar preferencias), al menos loguear el error:
```js
.catch(err => console.error('Error guardando config:', err));
```

**Esfuerzo:** Alto (requiere revisar ~40+ llamadas invoke)
**Estado:** pendiente

---

### [MEDIA] Números mágicos en app.js

**Archivo:** `src/app.js`

**Descripción del problema:**
La norma E prohíbe "literales numéricos o strings dentro de funciones de lógica". Se encontraron:
- Línea 23: `3000` (TOAST_DURATION)
- Línea 50: `0.3` (volumen base)
- Línea 53-57: `880`, `440`, `523`, `659`, `784`, `600`, `200` (frecuencias de sonido), `0.15`, `0.1`, `0.4`, `0.3`, `0.2`, `0.25` (duraciones)
- Línea 15: `50` (auditLimit hardcoded)
- Línea 252: `200` (debounce delay)
- Línea 398: `8000` (timeout para botón imprimir)
- Línea 1385: `100`, `200` (porcentajes de fuente)

**Fix sugerido:**
Extraer constantes al inicio del archivo:
```js
const TOAST_DURATION = 3000;
const SOUND_VOLUME_BASE = 0.3;
const AUDIO_FREQ = { add: 880, remove: 440, success: [523, 659, 784], error: 200, cancel: [600, 200] };
const AUDIO_DURATION = { add: 0.15, remove: 0.1, success: 0.4, error: 0.3, cancel: 0.25 };
const AUDIT_LIMIT_DEFAULT = 50;
const SEARCH_DEBOUNCE_MS = 200;
const PRINT_BTN_TIMEOUT = 8000;
const FONT_SIZE = { min: 50, max: 200, default: 100 };
```

**Esfuerzo:** Bajo
**Estado:** pendiente

---

### [MEDIA] Selectores DOM hardcodeados en funciones

**Archivo:** `src/app.js`

**Descripción del problema:**
La norma A prohíbe escribir selectores DOM directamente en funciones. Ejemplos:
- Línea 18: `document.getElementById('toast')`
- Línea 73-74: `document.getElementById('view-' + name)` y `` `.nav-btn[data-view="${name}"]` ``
- Línea 87-89: `login-username`, `login-password`, `login-error`
- Línea 100-102: `login-screen`, `main-app`, `sidebar-user`
- Línea 132: `tasa-input`
- Línea 135: `tasa-warning`
- ... y decenas más

**Fix sugerido:**
Crear un objeto de constantes de selectores al inicio del archivo:
```js
const SEL = {
    TOAST: '#toast',
    LOGIN_SCREEN: '#login-screen',
    MAIN_APP: '#main-app',
    SIDEBAR_USER: '#sidebar-user',
    LOGIN_USERNAME: '#login-username',
    LOGIN_PASSWORD: '#login-password',
    LOGIN_ERROR: '#login-error',
    TASA_INPUT: '#tasa-input',
    TASA_WARNING: '#tasa-warning',
    // ... resto de selectores
};
```

Luego reemplazar: `document.getElementById('toast')` → `qs(SEL.TOAST)`

**Esfuerzo:** Medio-Alto (~100+ reemplazos)
**Estado:** pendiente

---

### [MEDIA] SQL embebido en db.rs sin constantes

**Archivo:** `src-tauri/src/db.rs`

**Descripción del problema:**
La norma A (Anti-Hardcoding Rust) establece que nombres de tablas/columnas SQL deben estar en constantes. El archivo tiene SQL inline:
- Líneas 48-130: CREATE TABLE statements con strings literales
- Líneas 34-37, 137, 158, 168-189, 201, 216, 230, 239, 262-263, 276, 283, 297, 359, 367, 372, 377

**Fix sugerido:**
Mover consultas complejas a constantes en un módulo `sql` o al inicio de cada módulo:
```rust
// En db.rs o modulo sql.rs
mod sql {
    pub const CREATE_PRODUCTOS: &str = "...";
    pub const CREATE_CONFIGURACION: &str = "...";
    // ...
}
```

Para queries simples (INSERT/UPDATE de una línea), puede ser aceptable mantenerlos inline si son únicos en el módulo.

**Esfuerzo:** Medio
**Estado:** pendiente

---

### [BAJA] DRY violado - Validación de pago_mixto duplicada

**Archivos:**
- `src-tauri/src/sales.rs` (líneas 6-24)
- `src-tauri/src/clients.rs` (líneas 156-177)

**Descripción del problema:**
La validación de `pago_detalle` para pagos mixtos está duplicada casi idéntica en dos módulos. La norma B (DRY) indica abstraer en función helper si aparece más de dos veces.

**Fix sugerido:**
Crear una función compartida en `sales.rs` (o un módulo `validation.rs`):
```rust
// En sales.rs (exportarla como pub(crate))
pub(crate) fn validar_pago_detalle(detalle: &[PagoItem], total_usd: f64) -> Result<String, String> {
    // lógica existente
}
```

Luego en `clients.rs`:
```rust
use crate::sales::validar_pago_detalle;
// ...
if request.metodo_pago == "mixto" {
    if let Some(ref detalle) = request.pago_detalle {
        validar_pago_detalle(detalle, request.monto_usd)?;
    }
}
```

**Esfuerzo:** Bajo
**Estado:** pendiente

---

### [BAJA] require_admin importado desde products.rs

**Archivos:**
- `src-tauri/src/products.rs` (línea 8-25)
- `src-tauri/src/clients.rs` (línea 36, 49)
- `src-tauri/src/categorias.rs` (línea 29, 48, 67)
- `src-tauri/src/config.rs` (línea 21)

**Descripción del problema:**
La función `require_admin` está definida en `products.rs` pero se usa en otros módulos. Esto viola la norma G (SoC — Separation of Concerns): "Si cambia la estructura de DB, solo debe afectar al módulo Rust correspondiente + models.rs."

**Fix sugerido:**
Mover `require_admin` a `auth.rs` (donde ya existe `hash_password` y lógica de autorización):
```rust
// En auth.rs
pub(crate) fn require_admin(state: &State<AppState>, db: &rusqlite::Connection, action: &str) -> Result<String, String> {
    // implementación actual
}
```

Actualizar imports en todos los módulos:
```rust
use crate::auth::require_admin;
```

**Esfuerzo:** Bajo
**Estado:** pendiente

---

### [BAJA] CSS con valores RGB hardcodeados en animaciones

**Archivo:** `src/style.css`

**Descripción del problema:**
Las animaciones usan valores RGB hardcodeados en lugar de variables CSS:
- Línea 272: `rgba(var(--accent-rgb), 0.25)` — pero `--accent-rgb` no está definido en :root
- Línea 264, 266, 276: Referencias a `var(--sidebar-text-rgb)` que no existen

**Fix sugerido:**
Agregar versiones RGB de las variables principales en `:root`:
```css
:root {
  --bg: #F5F0FF;
  --bg-rgb: 245, 240, 255;
  --primary: #B8A9C9;
  --primary-rgb: 184, 169, 201;
  /* ... para cada color usado en rgba() */
}
```

O alternativamente, usar la sintaxis moderna `color-mix()` o definir sombras/bordes sin alpha.

**Esfuerzo:** Bajo
**Estado:** pendiente

---

## Propuestas de mejora

### [MEDIA] Centralizar configuración de CSP en tauri.conf.json

**Archivo:** `src-tauri/tauri.conf.json` (línea 24)

**Justificación:**
El CSP actual permite `'unsafe-inline'` para style-src y script-src, lo cual es necesario actualmente por los inline handlers, pero es una práctica de seguridad débil. Una vez corregidos los inline handlers, se puede endurecer el CSP.

**Propuesta:**
Después de fixear los inline handlers, actualizar a:
```json
"csp": "default-src 'self'; style-src 'self'; font-src 'self' data:; img-src 'self' data:; script-src 'self'"
```

**Esfuerzo:** Bajo (una vez completado el fix de inline handlers)
**Estado:** pendiente (depende de fix ALTA #1)

---

### [BAJA] Agregar tests unitarios para validaciones Rust

**Archivos:** `src-tauri/src/*.rs`

**Justificación:**
Las funciones de validación crítica (validar_pago_detalle, require_admin, hash_password) no tienen tests. Agregar tests unitarios mejoraría la confianza en refactorizaciones futuras.

**Propuesta:**
Agregar módulo `#[cfg(test)]` en cada archivo con casos de prueba:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_validar_pago_detalle_suma_correcta() {
        // ...
    }
}
```

**Esfuerzo:** Medio
**Estado:** pendiente

---

### [BAJA] Documentar decisiones técnicas en decisiones.md

**Archivo:** Raíz del proyecto (nuevo archivo)

**Justificación:**
El contexto menciona: "Registrar decisiones: mantener cronológicamente en un archivo decisiones.md en la raíz con formato ADR". Este archivo aún no existe.

**Propuesta:**
Crear `decisiones.md` con formato ADR (Architecture Decision Record):
```markdown
# Decisiones Técnicas (ADR)

## ADR-001: Uso de Tauri v2 con SQLite embebido

**Fecha:** 2024-XX-XX
**Estado:** Aceptado
**Contexto:** Necesidad de app desktop/mobile offline...
**Decisión:** Usar Tauri v2 con rusqlite bundled...
**Consecuencias:** ...
```

**Esfuerzo:** Bajo
**Estado:** pendiente

---

## Resumen de prioridades

| Prioridad | Cantidad | Esfuerzo total estimado |
|-----------|----------|------------------------|
| Alta      | 2        | Alto                   |
| Media     | 3        | Medio-Alto             |
| Baja      | 5        | Bajo-Medio             |

**Orden recomendado de implementación:**
1. Fix ALTA #2 (Manejo de errores invoke) — previene bugs silenciosos
2. Fix ALTA #1 (Inline handlers) — mejora mantenibilidad y seguridad
3. Fix MEDIA #3 (Números mágicos) — rápido win
4. Fix MEDIA #4 (Selectores DOM) — mejora consistencia
5. Fix BAJA #6 (Mover require_admin) — mejora SoC
6. Fix BAJA #5 (DRY validación) — reduce duplicación
7. Fix MEDIA #2 (SQL constants) — mejora legibilidad Rust
8. Fix BAJA #7 (CSS RGB vars) — polish final
9. Propuestas de mejora (CSP, tests, ADR)

---

*Generado por auditoría de código — POS Escritorio Tauri v2*
