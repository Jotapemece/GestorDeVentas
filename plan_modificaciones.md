# Plan de Modificaciones

**Prioridad:** Alta > Media > Baja

---

## Hallazgos de auditoría

### [ALTA] Números mágicos en Rust - Hardcoded strings en consultas SQL

**Archivo:** `src-tauri/src/cashier.rs`  
**Línea:** 27, 138  
**Descripción del problema:** String literal `'credito'` y `"pago_movil"` usados directamente en consultas SQL y comparaciones, violando norma E (Sin Números/Textos Mágicos) y A (Anti-Hardcoding).  
**Fix sugerido:** Reemplazar con constantes de `constants.rs`: `constants::METODO_CREDITO` y `constants::METODO_PAGO_MOVIL`. Ya existen definidas pero no se usan consistentemente.  
**Esfuerzo:** Bajo  
**Estado:** pendiente

---

### [ALTA] String mágico en consulta SQL de cashier.rs

**Archivo:** `src-tauri/src/cashier.rs`  
**Línea:** 27  
**Descripción del problema:** La consulta `SQL_CLIENTES_CREDITO` contiene el string hardcodeado `'credito'` dentro del SQL.  
**Fix sugerido:** Usar interpolación de constante o definir la constante completa: `const SQL_CLIENTES_CREDITO: &str = "... WHERE v.metodo_pago = ? ...";` y pasar el valor como parámetro.  
**Esfuerzo:** Bajo  
**Estado:** pendiente

---

### [ALTA] Faltan constantes para claves de configuración en frontend JS

**Archivo:** `src/app.js`  
**Línea:** 405, 1625, 1680, 1914, 1920, 1973, 1978, 1993  
**Descripción del problema:** Strings literales como `'tasa_updated_at'`, `'tema'`, `'font_size'`, `'sonido_habilitado'`, `'sonido_volumen'`, `'historial_limpieza_dias'` están hardcodeados en múltiples llamadas a `invoke()`, violando norma A (Anti-Hardcoding) y E (Sin Textos Mágicos).  
**Fix sugerido:** Crear constantes en la sección `/* ========== CONSTANTS ========== */`:
```javascript
const CFG_TASA_UPDATED_AT = 'tasa_updated_at';
const CFG_TEMA = 'tema';
const CFG_FONT_SIZE = 'font_size';
const CFG_SONIDO_HABILITADO = 'sonido_habilitado';
const CFG_SONIDO_VOLUMEN = 'sonido_volumen';
const CFG_HISTORIAL_LIMPIEZA_DIAS = 'historial_limpieza_dias';
```
Y reemplazar todas las ocurrencias.  
**Esfuerzo:** Bajo  
**Estado:** pendiente

---

### [ALTA] Color mágico '#CCCCCC' en app.js

**Archivo:** `src/app.js`  
**Línea:** 195  
**Descripción del problema:** El color `'#CCCCCC'` está hardcodeado dentro de la función `createInventoryRow()`, violando norma E (Sin Números/Textos Mágicos).  
**Fix sugerido:** Definir constante `const COLOR_CATEGORIA_DEFAULT = '#CCCCCC';` al inicio del archivo y usarla en su lugar.  
**Esfuerzo:** Bajo  
**Estado:** pendiente

---

### [ALTA] Violación norma 5 - Manejo de errores JS inconsistente

**Archivo:** `src/app.js`  
**Línea:** Múltiples (359-381, 388-390, 402-409, etc.)  
**Descripción del problema:** Muchos bloques `try/catch` silencian errores con `console.error()` en lugar de mostrarlos al usuario mediante `showToast()`, violando la regla 5 de manejo de errores JS. Ejemplos: líneas 381, 409, 440, 923.  
**Fix sugerido:** Reemplazar todos los `catch(e) { console.error(...) }` por `catch(e) { showToast('Error: ' + e.message || e, 'error'); }` excepto en casos donde el error sea esperado y no requiera notificación al usuario.  
**Esfuerzo:** Medio  
**Estado:** pendiente

---

### [MEDIA] Uso de `.unwrap_or()` en Rust que podría ocultar errores

**Archivo:** `src-tauri/src/*.rs`  
**Línea:** Múltiples (db.rs:146, 162, 184, 201; products.rs:182, 211, 294, 391; sales.rs:207; cashier.rs:93, 252, 267, 288, 411)  
**Descripción del problema:** Aunque no son `.unwrap()` puros, los `.unwrap_or()` y `.unwrap_or_else()` en funciones críticas pueden ocultar problemas de base de datos. Norma 4 establece que errores de BD deben propagarse con mensajes claros.  
**Fix sugerido:** En comandos Tauri (`#[tauri::command]`), convertir a `.map_err(|e| format!("..."))` cuando sea posible. Mantener `.unwrap_or()` solo en helpers internos donde el fallback sea aceptable (ej: defaults). Documentar cada caso.  
**Esfuerzo:** Medio  
**Estado:** pendiente

---

### [MEDIA] Constante SQL_TASA usa CAST innecesario

**Archivo:** `src-tauri/src/constants.rs`  
**Línea:** 47  
**Descripción del problema:** `SQL_TASA` incluye `CAST(valor AS REAL)` que según las normas (sección SQLite) debe evitarse si no es necesario.  
**Fix sugerido:** Evaluar si el CAST es realmente necesario. Si la columna ya es TEXT y se necesita conversión, mantenerlo pero agregar comentario explicativo. Si no, remover.  
**Esfuerzo:** Bajo  
**Estado:** pendiente

---

### [MEDIA] DRY - Funciones helper repetidas en cashier.rs y sales.rs

**Archivo:** `src-tauri/src/cashier.rs`, `src-tauri/src/sales.rs`  
**Línea:** cashier.rs:92-94 (`obtener_tasa`), sales.rs:295-298 (`get_tasa`)  
**Descripción del problema:** La lógica para obtener la tasa está duplicada. Cashier tiene `obtener_tasa()` como función privada y sales tiene `get_tasa()` como comando público.  
**Fix sugerido:** Crear una función utilitaria compartida en `db.rs` o `constants.rs` llamada `fn get_tasa_from_db(conn: &Connection) -> f64` y usarla desde ambos módulos.  
**Esfuerzo:** Medio  
**Estado:** pendiente

---

### [MEDIA] Falta constante para límite de auditoría en frontend

**Archivo:** `src/app.js`  
**Línea:** 24  
**Descripción del problema:** `AUDIT_LIMIT_DEFAULT = 50` está definido en JS pero debería sincronizarse con la constante de Rust `AUDIT_LOG_DEFAULT_LIMIT` en `constants.rs`. Riesgo de divergencia.  
**Fix sugerido:** Mantener la constante en JS pero agregar comentario que indique que debe coincidir con `constants.rs::AUDIT_LOG_DEFAULT_LIMIT`. Idealmente, exponer este valor desde backend via invoke.  
**Esfuerzo:** Bajo  
**Estado:** pendiente

---

### [BAJA] Selectores DOM podrían agruparse mejor

**Archivo:** `src/app.js`  
**Línea:** 45-180 (objeto SEL)  
**Descripción del problema:** El objeto `SEL` tiene 70+ selectores pero algunos podrían derivarse de otros (ej: `cartTotalUsd` y `cartTotalBs` podrían ser generados dinámicamente si siguen patrón).  
**Fix sugerido:** No es crítico, pero se podría considerar agrupar selectores por módulo/vista para mejor organización. Actualmente está bien estructurado.  
**Esfuerzo:** Alto (refactor grande)  
**Estado:** pendiente - **NO RECOMENDADO** (YAGNI - funciona bien)

---

### [BAJA] Templates de receipt podrían ser constantes separadas

**Archivo:** `src/app.js`  
**Línea:** 226-227  
**Descripción del problema:** `TPL_RECEIPT_STYLE` y `TPL_CLOSE_REPORT_STYLE` son strings largos inline.  
**Fix sugerido:** Mover a archivo separado `templates.js` si crecen, pero actualmente es aceptable tenerlos como constantes.  
**Esfuerzo:** Bajo  
**Estado:** pendiente - **NO CRÍTICO**

---

## Propuestas de mejora

### [MEDIA] Centralizar nombres de métodos de pago en frontend

**Archivo:** `src/app.js`  
**Línea:** Múltiples comparaciones con strings como `'pago_movil'`, `'credito'`, `'mixto'`  
**Justificación:** Para mantener coherencia con backend y evitar errores de tipeo, crear objeto constante:
```javascript
const METODOS_PAGO = {
  EFECTIVO_BS: 'efectivo_bs',
  EFECTIVO_USD: 'efectivo_usd',
  BIOPAGO: 'biopago',
  PUNTO: 'punto',
  PAGO_MOVIL: 'pago_movil',
  CREDITO: 'credito',
  MIXTO: 'mixto'
};
```
**Esfuerzo:** Medio  
**Estado:** pendiente

---

### [MEDIA] Agregar validación de tipo en invoke calls

**Archivo:** `src/app.js`  
**Justificación:** Para prevenir errores en tiempo de ejecución, agregar validación básica de tipos en funciones que reciben datos del backend antes de procesarlos.  
**Esfuerzo:** Medio  
**Estado:** pendiente

---

### [BAJA] Documentar relación entre constants.rs y app.js constants

**Archivo:** `src/app.js`, `src-tauri/src/constants.rs`  
**Justificación:** Agregar comentarios cruzados indicando qué constantes de JS corresponden a cuáles de Rust para facilitar mantenimiento.  
**Esfuerzo:** Bajo  
**Estado:** pendiente

---

## Resumen de prioridades

| Prioridad | Cantidad | Esfuerzo total estimado |
|-----------|----------|------------------------|
| Alta      | 5        | 2-3 horas              |
| Media     | 4        | 4-6 horas              |
| Baja      | 3        | 1-2 horas              |

---

## Decisiones técnicas (ADR)

Las decisiones tomadas durante esta auditoría se registrarán en `decisiones.md` siguiendo formato ADR.

---

*Generado por auditoría de código - POS Desktop Tauri v2*
