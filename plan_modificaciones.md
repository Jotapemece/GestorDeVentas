# Plan de Modificaciones — Corregido

**Fecha de generación:** 2025-07-18
**Proyecto:** POS de Escritorio — Tauri v2 + Rust/SQLite + HTML/CSS/JS Vanilla

Prioridad: Alta > Media > Baja

---

## Cambios ya implementados (Jul 18)

### constants.rs — Centralización de constantes
- Añadido `SQL_DATETIME_NOW` (reemplaza 4 ocurrencias inline de `datetime('now','localtime')` en db.rs, sync.rs)
- Añadidas 12 claves de configuración (`CFG_TASA_DOLAR`, `CFG_CAJA_ABIERTA`, `CFG_ULTIMO_UPLOAD`, `CFG_DISPOSITIVO_ID`, etc.)
- Añadidos `PAGE_SIZE_DEFAULT` (200), `PAGE_SIZE_MAX` (500)
- Añadido `ROUNDING_FACTOR` (100.0) para redondeo de montos
- Mantenidas las constantes existentes (`METODO_*`, `SQL_TASA`, `TEMAS_DISPONIBLES`, etc.)

### db.rs — SQL y config keys a constantes
- `datetime('now','localtime')` inline → `SQL_DATETIME_NOW` vía `format!()`
- `'tasa_dolar'`, `'caja_abierta'`, `'historial_limpieza_dias'` → constantes `CFG_*`
- `'historial_limpieza_dias'` en `cleanup_old_history()` → `CFG_HISTORIAL_LIMPIEZA_DIAS`

### products.rs — Page size e import a constantes
- `200`/`500` mágicos → `PAGE_SIZE_DEFAULT`/`PAGE_SIZE_MAX`
- Inline SQL en import function (`INSERT OR IGNORE INTO productos`) → `SQL_IMPORT_PRODUCTO`
- `SQL_IMPORT_PRODUCTO` actualizado a `INSERT OR IGNORE` con `?5` para `stock_minimo` (6 params)
- Callers actualizados: `create_product` y `insert_products_from_json` pasan `0` como stock_minimo

### sales.rs — Rounding factor
- `100.0` mágico → `ROUNDING_FACTOR`
- `SQL_UPDATE_TASA` y `SQL_UPSERT_TASA_UPDATED` reemplazadas por `format!()` con `CFG_TASA_DOLAR`/`CFG_TASA_UPDATED_AT`

### sync.rs — Config keys y SQL a constantes
- 14 config keys inline → constantes `CFG_*` (todos los `ultimo_*`, `dispositivo_id`, `supabase_url`, `supabase_key`)
- `datetime('now','localtime')` en download_products → `SQL_DATETIME_NOW`
- `gc()` calls en `get_sync_stats` → constantes `CFG_*`

### app.js — Selectores sync a SEL
- Añadidos 18 selectores nuevos a `const SEL` (sync, conflict, tasa, cambio)
- Migrados ~15 `getElementById()` calls a `qs(SEL.xxx)`

---

## Hallazgos de auditoría restantes (no implementados, priorizados)

### [Alta] Selectores DOM no centralizados (~85 restantes)
- **Archivo:** `src/app.js`
- **Descripción:** ~85 `document.getElementById()` calls aún no migrados a `SEL` (users, reportes, dashboard, historial, etc.)
- **Fix sugerido:** Migración incremental usando el patrón existente
- **Esfuerzo:** Alto (incremental)
- **Estado:** pendiente

### [Media] Config keys hardcodeadas en frontend JS
- **Archivo:** `src/app.js`
- **Descripción:** `invoke('get_config_value', { clave: '...' })` con strings hardcodeados (tasa_dolar, tema, font_size, etc.)
- **Fix sugerido:** Crear objeto `CFG = { ... }` en app.js con todas las claves
- **Esfuerzo:** Bajo
- **Estado:** pendiente

### [Media] Constantes de UI dispersas en app.js
- **Archivo:** `src/app.js`
- **Descripción:** `CHART_COLORS`, `CANVAS_WIDTH`, etc. definidas sueltas. Mejor agruparlas en objetos semánticos (`CHART`, `PRINT`, etc.)
- **Fix sugerido:** Reorganizar en objetos temáticos
- **Esfuerzo:** Bajo
- **Estado:** pendiente

### [Baja] Doc comments en funciones Rust públicas
- **Archivo:** `src-tauri/src/*.rs`
- **Descripción:** Comandos `#[tauri::command]` sin documentación (`///`)
- **Fix sugerido:** Agregar doc comments estándar
- **Esfuerzo:** Alto (incremental)
- **Estado:** pendiente

### [Baja] Agregar más tests unitarios
- **Archivo:** `src-tauri/src/*.rs`
- **Descripción:** Existen 36 tests (auth, config, cashier, sales, sync). Módulos sin tests: products, clients, db, migrations
- **Fix sugerido:** Agregar tests para módulos faltantes siguiendo el patrón existente
- **Esfuerzo:** Alto
- **Estado:** pendiente

---

## Correcciones al plan original

| Hallazgo original | Corrección |
|---|---|
| Finding 4 citaba `querySelector` como `getElementById` (9 de 21 líneas) | Eliminadas líneas incorrectas; se actualizaron los ~15 más críticos; ~85 restantes son migración incremental |
| Sugería crear `db_constants.rs` | Ya existe `constants.rs` expandido, no hace falta módulo nuevo |
| "No hay evidencia de tests" (falso) | Se corrigió: 36 tests existentes, se agregó hallazgo de tests faltantes en su lugar |
| Prioridad de `.unwrap_or()` como Alta | Se baja a Media: son mayormente defaults opcionales válidos, no bugs |

---

## Resumen de esfuerzos restantes

| Prioridad | Cantidad | Esfuerzo total estimado |
|-----------|----------|------------------------|
| Alta      | 1        | ~2-3 días (incremental) |
| Media     | 2        | ~1 día                  |
| Baja      | 2        | ~2-3 días (incremental) |

**Total estimado:** 5-7 días de trabajo

---

*Nota: Los hallazgos de hardcodeo SQL, números mágicos, datetime repetition, y config keys en backend han sido corregidos en esta sesión.*
