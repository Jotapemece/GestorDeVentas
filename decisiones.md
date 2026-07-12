# Decisiones Técnicas (ADR - Architectural Decision Records)

---

## ADR-001: Centralización de constantes de métodos de pago

**ID:** ADR-001  
**Origen:** Auditoría de código - plan_modificaciones.md  
**Fecha:** 2024  
**Estado:** Propuesto  

### Contexto
El proyecto tiene definidas constantes para métodos de pago en `src-tauri/src/constants.rs`:
- `METODO_EFECTIVO_BS`
- `METODO_EFECTIVO_USD`
- `METODO_BIOPAGO`
- `METODO_PUNTO`
- `METODO_PAGO_MOVIL`
- `METODO_CREDITO`
- `METODO_MIXTO`

Sin embargo, en `cashier.rs` línea 27 se usa el string literal `'credito'` directamente en una consulta SQL, y en `cashier.rs` línea 138 se compara con `"pago_movil"`. Esto viola las normas de Anti-Hardcoding (A) y Sin Números/Textos Mágicos (E).

### Alternativas consideradas

1. **Mantener strings literales inline**  
   - Pros: Más visible en el contexto inmediato
   - Contras: Riesgo de errores de tipeo, difícil refactorización, viola normas del proyecto

2. **Usar constantes existentes en constants.rs** ✅  
   - Pros: Single Point of Truth (SPOT), consistente con el resto del código, facilita cambios futuros
   - Contras: Requiere importar el módulo constants

3. **Crear constantes locales en cada módulo**  
   - Pros: Independencia entre módulos
   - Contras: Duplicación, riesgo de divergencia

### Decisión
Usar las constantes definidas en `constants.rs` consistentemente en todos los módulos Rust. Para frontend JS, crear objeto constante paralelo `METODOS_PAGO`.

### Impacto
- **Archivos a modificar:** `src-tauri/src/cashier.rs`, `src/app.js`
- **Esfuerzo:** Bajo (2-3 horas)
- **Riesgo:** Mínimo - cambio cosmético que no afecta funcionalidad
- **Beneficio:** Mejor mantenibilidad, adherencia a normas del proyecto

---

## ADR-002: Constantes para claves de configuración en frontend

**ID:** ADR-002  
**Origen:** Auditoría de código - plan_modificaciones.md  
**Fecha:** 2024  
**Estado:** Propuesto  

### Contexto
En `src/app.js` hay múltiples llamadas a `invoke()` con strings hardcodeados para claves de configuración:
- `'tasa_updated_at'` (línea 405)
- `'tema'` (líneas 1625, 1663, 1987)
- `'font_size'` (líneas 1680, 1688)
- `'sonido_habilitado'` (línea 1914, 1973)
- `'sonido_volumen'` (línea 1920, 1978)
- `'historial_limpieza_dias'` (línea 1993, 2006)

Estas mismas claves existen en `src-tauri/src/constants.rs` como `CFG_TASA_UPDATED_AT`, `CFG_TEMA`, etc.

### Alternativas consideradas

1. **Mantener strings inline en JS**  
   - Pros: No requiere cambios
   - Contras: Violación norma A y E, riesgo de errores de tipeo

2. **Crear constantes en app.js paralelas a Rust** ✅  
   - Pros: Claridad, fácil referencia, mantiene separación frontend/backend
   - Contras: Duplicación potencial si cambian nombres en backend

3. **Exponer constantes desde backend via invoke**  
   - Pros: Single Source of Truth real
   - Contras: Over-engineering, llamada adicional al startup

### Decisión
Crear constantes en `src/app.js` sección CONSTANTS que reflejen las claves de configuración, con comentarios que indiquen su correspondencia con `constants.rs`.

```javascript
// Configuración - deben coincidir con constants.rs
const CFG_TASA_DOLAR = 'tasa_dolar';
const CFG_TASA_UPDATED_AT = 'tasa_updated_at';
const CFG_CAJA_ABIERTA = 'caja_abierta';
const CFG_TEMA = 'tema';
const CFG_FONT_SIZE = 'font_size';
const CFG_SONIDO_HABILITADO = 'sonido_habilitado';
const CFG_SONIDO_VOLUMEN = 'sonido_volumen';
const CFG_HISTORIAL_LIMPIEZA_DIAS = 'historial_limpieza_dias';
```

### Impacto
- **Archivos a modificar:** `src/app.js`
- **Esfuerzo:** Bajo (1 hora)
- **Riesgo:** Mínimo
- **Beneficio:** Consistencia, facilidad de mantenimiento

---

## ADR-003: Manejo de errores en frontend JavaScript

**ID:** ADR-003  
**Origen:** Auditoría de código - plan_modificaciones.md  
**Fecha:** 2024  
**Estado:** Propuesto  

### Contexto
La norma 5 del proyecto establece: "Toda llamada a invoke() debe tener `.catch(err => showToast(err, 'error'))`. Errores de red/backend deben mostrarse al usuario."

Actualmente hay múltiples bloques try/catch que silencian errores con `console.error()`:
- Línea 381: catch de login
- Línea 409: catch de loadTasa
- Línea 440: catch de loadCategorias
- Línea 923: catch interno

### Alternativas consideradas

1. **Mantener console.error para errores internos**  
   - Pros: No molesta al usuario con errores técnicos
   - Contras: Usuario no sabe cuando algo falla, difícil debugging en producción

2. **Mostrar todos los errores via showToast** ✅  
   - Pros: Usuario informado, consistente con norma 5
   - Contras: Posible sobrecarga de notificaciones

3. **Sistema de logging dual (console + toast según severidad)**  
   - Pros: Balance entre información y UX
   - Contras: Complejidad adicional

### Decisión
Implementar estrategia diferenciada:
- Errores de operaciones iniciadas por usuario → `showToast()`
- Errores internos de inicialización → `console.error()` + `showToast()` solo si afecta funcionalidad visible
- Todas las llamadas `invoke()` directas → `.catch(err => showToast(err, 'error'))`

### Impacto
- **Archivos a modificar:** `src/app.js`
- **Esfuerzo:** Medio (2-3 horas)
- **Riesgo:** Bajo - mejora UX
- **Beneficio:** Mejor experiencia de usuario, adherencia a normas

---

## ADR-004: Función compartida para obtener tasa

**ID:** ADR-004  
**Origen:** Auditoría de código - plan_modificaciones.md  
**Fecha:** 2024  
**Estado:** Propuesto  

### Contexto
Existen dos implementaciones para obtener la tasa del dólar:
- `cashier.rs:obtener_tasa()` - función privada helper
- `sales.rs:get_tasa()` - comando Tauri público

Ambas hacen esencialmente lo mismo: ejecutar `SELECT CAST(valor AS REAL) FROM configuracion WHERE clave = 'tasa_dolar'`.

### Alternativas consideradas

1. **Mantener duplicación**  
   - Pros: Independencia de módulos
   - Contras: Violación DRY, mantenimiento doble

2. **Función compartida en db.rs** ✅  
   - Pros: Single Point of Truth, reutilizable, coherente con SoC
   - Contras: db.rs se convierte en "cajón de sastre"

3. **Función shared en utils.rs (nuevo módulo)**  
   - Pros: Separación clara
   - Contras: Over-engineering para una función

### Decisión
Crear función pública `pub fn get_tasa_from_db(conn: &Connection) -> f64` en `db.rs` y usarla desde ambos módulos. Mantener `get_tasa()` como comando Tauri que internally llama a la función compartida.

### Impacto
- **Archivos a modificar:** `src-tauri/src/db.rs`, `src-tauri/src/cashier.rs`, `src-tauri/src/sales.rs`
- **Esfuerzo:** Medio (2 horas)
- **Riesgo:** Bajo
- **Beneficio:** DRY, mejor mantenibilidad

---

## ADR-005: Color default para categorías sin color

**ID:** ADR-005  
**Origen:** Auditoría de código - plan_modificaciones.md  
**Fecha:** 2024  
**Estado:** Propuesto  

### Contexto
En `app.js:195`, la función `createInventoryRow()` usa `'#CCCCCC'` como color fallback para categorías sin color definido. Este es un número mágico que viola la norma E.

### Alternativas consideradas

1. **Mantener inline**  
   - Pros: Visible en contexto
   - Contras: Viola norma E, difícil de cambiar globalmente

2. **Constante en app.js** ✅  
   - Pros: Simple, SPOT, fácil de cambiar
   - Contras: Ninguno significativo

3. **Obtener de CSS variable**  
   - Pros: Integrado con sistema de temas
   - Contras: Complejidad innecesaria para valor fijo

### Decisión
Definir constante `const COLOR_CATEGORIA_DEFAULT = '#CCCCCC';` en la sección CONSTANTS de `app.js`.

### Impacto
- **Archivos a modificar:** `src/app.js`
- **Esfuerzo:** Bajo (15 minutos)
- **Riesgo:** Mínimo
- **Beneficio:** Adherencia a normas, mantenibilidad

---

*Última actualización: 2024*
*Este archivo debe mantenerse actualizado con cada decisión técnica significativa.*
