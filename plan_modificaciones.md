# Plan de Modificaciones

**Prioridad:** Alta > Media > Baja

---

## Hallazgos de auditoría

### [ALTA] Violación Norma A (Anti-Hardcoding) - Strings SQL en línea dentro de funciones Rust

| Archivo | Línea | Descripción del problema | Fix sugerido | Esfuerzo | Estado |
|---------|-------|--------------------------|--------------|----------|--------|
| `src-tauri/src/products.rs` | 35, 107, 116, 122, 143, 159, 168, 175, 190, 255, 322, 340 | Múltiples queries SQL hardcodeados directamente en las funciones en lugar de constantes | Extraer todos los strings SQL a constantes privadas al inicio del módulo (ej: `const SQL_LISTAR_PRODUCTOS: &str = "SELECT ..."`). Actualizar todas las referencias. | Medio | pendiente |
| `src-tauri/src/sales.rs` | 52, 76, 95, 102, 108, 126, 134, 176-180, 214-218, 248, 261, 266 | Queries SQL inline en `create_sale`, `list_sales`, `get_sale_detail`, `get_tasa`, `set_tasa` | Definir constantes SQL al inicio del módulo para cada operación. Refactorizar funciones para usarlas. | Medio | pendiente |
| `src-tauri/src/cashier.rs` | 10-11, 18-20, 26-28, 36, 84-90, 108-113, 152-154, 160-162, 168, 176-181, 220, 227, 240, 262, 280, 288, 296, 309, 316, 322, 332, 366-369, 400, 407, 414 | Numerosas consultas SQL distribuidas en múltiples funciones sin abstracción | Crear constantes SQL modulares. Considerar helper functions para queries repetidos (ej: query de total_usd por rango de fechas se repite). | Alto | pendiente |
| `src-tauri/src/auth.rs` | 18, 37, 66, 101, 107, 129 | SQL inline en login, logout, create_usuario, list_usuarios | Definir constantes SQL privadas. La lógica de hash está bien separada. | Bajo | pendiente |
| `src-tauri/src/clients.rs` | 13, 38, 52, 66, 82-88, 185, 200, 212, 219 | Queries SQL dispersos en el módulo | Consolidar en constantes. El patrón `WHERE v.cliente_id = ?1 AND v.metodo_pago = 'credito'` podría reutilizarse. | Medio | pendiente |
| `src-tauri/src/categorias.rs` | 10, 31, 50, 68, 70 | SQL inline aunque el módulo es pequeño | Agregar constantes para consistencia con el resto del proyecto. | Bajo | pendiente |
| `src-tauri/src/audit.rs` | 13, 39 | Queries SQL inline | Definir constantes SQL. | Bajo | pendiente |
| `src-tauri/src/config.rs` | 10, 23 | SQL inline en get/set_config_value | Agregar constantes SQL. | Bajo | pendiente |
| `src-tauri/src/db.rs` | 25, 34, 36, 49-130, 141-145, 158, 163, 169-188, 201, 216, 230, 239, 251, 262, 270, 276, 283, 292, 297, 306, 318, 359, 367, 372, 377 | Migraciones y creación de tablas con SQL embebido. Algunos usan `.expect()` que viola norma de manejo de errores. | Para migraciones, mantener inline pero documentar. Reemplazar `.expect()` con `.map_err()` o `.ok()` según corresponda. Extraer queries de configuración a constantes. | Medio | pendiente |

### [ALTA] Violación Norma E (Sin Números Mágicos) - Literales numéricos en lógica de negocio

| Archivo | Línea | Descripción del problema | Fix sugerido | Esfuerzo | Estado |
|---------|-------|--------------------------|--------------|----------|--------|
| `src-tauri/src/sales.rs` | 15, 35 | Literal `4` para longitud de referencia Pago Móvil | Definir `const PAGO_MOVIL_REF_LEN: usize = 4;` y usarla en validaciones. | Bajo | pendiente |
| `src-tauri/src/sales.rs` | 20, 171 | Literal `0.01` para tolerancia de comparación de montos | Definir `const MONTO_TOLERANCIA: f64 = 0.01;` | Bajo | pendiente |
| `src-tauri/src/clients.rs` | 150, 166, 171 | Mismos literales `4` y `0.01` duplicados | Usar las mismas constantes definidas en sales.rs o crear módulo compartido `constants.rs`. | Bajo | pendiente |
| `src-tauri/src/cashier.rs` | 147, 274, 355 | Literal `"9999-12-31"` como fecha futura máxima | Definir `const FECHA_MAXIMA: &str = "9999-12-31";` | Bajo | pendiente |
| `src/app.js` | 4, 10-15 | Constantes ya definidas correctamente (TOAST_DURATION, SEARCH_DEBOUNCE_MS, etc.) ✅ | Ninguna acción requerida - buen ejemplo de aplicación de norma. | - | N/A |

### [MEDIA] Violación Norma DRY (Don't Repeat Yourself) - Código duplicado entre módulos Rust

| Archivo | Línea | Descripción del problema | Fix sugerido | Esfuerzo | Estado |
|---------|-------|--------------------------|--------------|----------|--------|
| `src-tauri/src/products.rs` | 190 vs 35 | Query SELECT de productos duplicado entre `list_products` y `export_products_xlsx` | Crear función privada `fn obtener_productos_activos(db: &Connection, ...) -> Result<Vec<Producto>>` compartida. | Medio | pendiente |
| `src-tauri/src/cashier.rs` | 144-148, 272-275, 353-356 | Lógica de cálculo de `tomorrow` duplicada 3 veces | Crear helper `fn siguiente_dia(fecha: &str) -> String` o usar directamente chrono. | Bajo | pendiente |
| `src-tauri/src/cashier.rs` | 150-156, 158-164, 278-284, 286-292 | Queries de COUNT(*) y SUM(total_usd) duplicados múltiples veces | Crear función `fn obtener_totales_del_dia(db: &Connection) -> Result<(i64, f64)>` | Medio | pendiente |
| `src-tauri/src/cashier.rs` | 24, 166, 294 | Query de `tasa_dolar` duplicado 3 veces | Crear helper `fn obtener_tasa(db: &Connection) -> Result<f64>` | Bajo | pendiente |
| `src-tauri/src/auth.rs` | 87-90, 119-122 | Patrón de verificación `is_admin` duplicado en `create_usuario` y `list_usuarios` | Ya existe `require_admin` en products.rs pero no se usa aquí. Unificar usando esa función o crear `auth::check_admin_role(state)`. | Bajo | pendiente |
| `src-tauri/src/clients.rs` | 156-177 | Validación de pago mixto duplicada respecto a `sales.rs::validar_pago_detalle` | Mover `validar_pago_detalle` a módulo compartido o importar desde sales.rs. Actualmente está como private en sales.rs. | Medio | pendiente |

### [MEDIA] Violación Norma de Manejo de Errores (Rust) - Uso de `.unwrap()` y `.expect()` en comandos Tauri

| Archivo | Línea | Descripción del problema | Fix sugerido | Esfuerzo | Estado |
|---------|-------|--------------------------|--------------|----------|--------|
| `src-tauri/src/products.rs` | 33, 104, 139, 153 | `.lock().unwrap()` en AppState | Cambiar a `.lock().map_err(|e| format!("Error interno: {}", e))?` para propagar errores de lock correctamente. | Bajo | pendiente |
| `src-tauri/src/sales.rs` | 28 | `.lock().unwrap()` | Igual que arriba. | Bajo | pendiente |
| `src-tauri/src/cashier.rs` | 142, 217, 218, 237, 251, 258, 351, 363, 396 | Múltiples `.lock().unwrap()` y `.unwrap_or()` | Reemplazar con manejo de errores apropiado usando `.map_err()`. Los `.unwrap_or()` en queries están bien si tienen fallback válido. | Medio | pendiente |
| `src-tauri/src/auth.rs` | 14, 31, 34, 58, 63, 76, 88, 95, 120, 127 | `.lock().unwrap()` repetido | Refactorizar a manejo de errores consistente. | Medio | pendiente |
| `src-tauri/src/categorias.rs` | 8, 28, 47, 66 | `.lock().unwrap()` | Igual que arriba. | Bajo | pendiente |
| `src-tauri/src/clients.rs` | 11, 35, 48, 62, 179, 181 | `.lock().unwrap()` | Igual que arriba. | Bajo | pendiente |
| `src-tauri/src/audit.rs` | 8, 34 | `.lock().unwrap()` | Igual que arriba. | Bajo | pendiente |
| `src-tauri/src/config.rs` | 7, 14, 20 | `.lock().unwrap()` y `.unwrap_or_default()` | Igual que arriba. En `get_config_value`, el `.unwrap_or_default()` es aceptable como fallback. | Bajo | pendiente |
| `src-tauri/src/db.rs` | 32, 43, 132, 156, 164, 189, 199, 214, 228, 255, 271, 293, 307, 313, 318, 355 | Múltiples `.unwrap_or()`, `.expect()` en inicialización | En `init_db()` los `.expect()` son aceptables porque son fallos críticos de inicio. Sin embargo, `.unwrap_or(false)` en migrations puede silenciar errores. Considerar logging. | Bajo | pendiente |

### [BAJA] Violación Norma H (SoC Frontend) - Selectores DOM hardcodeados en HTML en lugar de constantes JS

| Archivo | Línea | Descripción del problema | Fix sugerido | Esfuerzo | Estado |
|---------|-------|--------------------------|--------------|----------|--------|
| `src/index.html` | 383-389, 527-532 | Clases de métodos de pago (`data-method="efectivo_bs"`, etc.) hardcodeadas en HTML | Las constantes ya existen en app.js (`METODO_LABELS`), pero los valores de `data-method` deberían estar en una constante `METHODS` en app.js y generarse dinámicamente o al menos documentarse como SPOT. | Bajo | pendiente |
| `src/app.js` | 545-547 | `METODO_LABELS` definido tarde en el archivo (línea 545) | Mover al inicio del archivo junto a otras constantes (línea 4-16) para mejor descubribilidad. | Bajo | pendiente |

### [BAJA] Violación Norma K (Temas vía CSS Variables) - Posible hardcoded de colores

| Archivo | Línea | Descripción del problema | Fix sugerido | Esfuerzo | Estado |
|---------|-------|--------------------------|--------------|----------|--------|
| `src/app.js` | 16 | `CHART_COLORS` array de colores hex hardcodeados | Esto es aceptable pues son colores específicos para gráficos. Verificar que no haya otros colores hex en JS fuera de este array. | - | N/A (aceptable) |
| `src/index.html` | 17-26 | Colores SVG inline en logo (#D47A4A, #C06030, #2D1B0E) | Aceptable para logo corporativo. No cambiar. | - | N/A (aceptable) |

---

## Propuestas de mejora

### [MEDIA] Centralizar constantes de métodos de pago

| Archivo | Línea | Descripción del problema | Fix sugerido | Esfuerzo | Estado |
|---------|-------|--------------------------|--------------|----------|--------|
| `src-tauri/src/sales.rs`, `clients.rs`, `cashier.rs` | Varias | Strings de métodos de pago (`"efectivo_bs"`, `"pago_movil"`, etc.) duplicados en 3 módulos | Crear módulo `constants.rs` o `types.rs` con enum/string constants: `pub const METODO_EFECTIVO_BS: &str = "efectivo_bs";` Importar en todos los módulos. Beneficio: Si cambia un nombre, solo se actualiza en un lugar. | Medio | pendiente |

### [MEDIA] Crear módulo helper para operaciones comunes de DB

| Archivo | N/A | No existe módulo helper | Crear `src-tauri/src/helpers.rs` o `src-tauri/src/utils.rs` con funciones: `fn count_ventas_en_rango(db: &Connection, start: &str, end: &str) -> Result<i64>`, `fn sum_ventas_en_rango(...)`, `fn get_tasa_actual(db: &Connection) -> Result<f64>`. Reduce duplicación en cashier.rs principalmente. | Alto | pendiente |

### [BAJA] Mejorar consistencia en nombres de funciones Rust

| Archivo | Varias | Funciones con nombres en snake_case pero algunos muy largos | Establecer convención clara: verbos cortos + sustantivo (ej: `list_products` ✅, `compute_report_data_range` → `build_report_for_range`). No urgente pero mejora legibilidad. | Bajo | pendiente |

### [BAJA] Documentar decisiones de diseño en decisiones.md

| Archivo | N/A | No existe archivo de decisiones arquitectónicas | Crear `decisiones.md` en raíz con formato ADR (Architectural Decision Record) para registrar: por qué se eligió rusqlite sobre sql.js, por qué 7 temas específicos, por qué SHA-256 en lugar de bcrypt, etc. Facilita onboarding y mantenimiento futuro. | Bajo | pendiente |

### [BAJA] Unificar manejo de errores en frontend JS

| Archivo | `src/app.js` | Varias | Algunos catch muestran `console.error(e)` sin showToast (líneas 278, 798, 1077) | Estandarizar: todo error debe mostrar toast al usuario. `console.error` solo para debugging adicional, nunca como único manejo. | Bajo | pendiente |

---

## Resumen de esfuerzos estimados

| Prioridad | Cantidad de tareas | Esfuerzo total estimado |
|-----------|-------------------|------------------------|
| Alta | 10 | ~6-8 horas |
| Media | 6 | ~4-6 horas |
| Baja | 5 | ~2-3 horas |
| **Total** | **21** | **~12-17 horas** |

---

## Recomendaciones de implementación

1. **Comenzar por normas de Anti-Hardcoding (Alta)**: Extraer constantes SQL primero, ya que esto facilita refactorizaciones posteriores y mejora mantenibilidad inmediatamente.

2. **Luego atacar DRY (Media)**: Una vez que las constantes SQL estén en lugar, identificar duplicación real y crear helpers compartidos.

3. **Manejo de errores (Alta/Media)**: Paralelamente, reemplazar `.unwrap()` con manejo de errores apropiado. Esto es crítico para estabilidad en producción.

4. **Finalmente mejoras de baja prioridad**: Consistencia de nombres, documentación ADR, etc.

5. **Testing recomendado post-modificación**: 
   - Verificar que todos los comandos Tauri retornan `Result<T, String>` correctamente
   - Ejecutar flujos completos: login → venta → cierre de caja → auditoría
   - Validar que errores de BD se propagan con mensajes claros al frontend
