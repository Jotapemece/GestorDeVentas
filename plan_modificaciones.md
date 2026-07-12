# Plan de Modificaciones

**Fecha de auditoría:** 2024  
**Proyecto:** POS de Escritorio — Tauri v2 + Rust/SQLite + HTML/CSS/JS Vanilla  
**Prioridad:** Alta > Media > Baja

---

## Resumen Ejecutivo

Se realizó una auditoría completa del código fuente contra las **Normas de Código Limpio** (A-K) y las **Reglas del Proyecto** (1-10). Se identificaron **27 hallazgos** que requieren atención, clasificados por prioridad y esfuerzo estimado.

---

## Hallazgos de Auditoría

### 🔴 PRIORIDAD ALTA (Bloqueantes / Urgentes)

| # | Archivo | Línea(s) | Norma Violada | Descripción del Problema | Fix Sugerido | Esfuerzo | Estado |
|---|---------|----------|---------------|--------------------------|--------------|----------|--------|
| A1 | `src/app.js` | 201 | M5 (Manejo de errores JS) | `catch(e) {}` vacío en `playSound()` silencia errores de AudioContext sin notificar al usuario ni hacer log | Agregar `console.error('Error en audio:', e)` mínimo dentro del catch | Bajo | pendiente |
| A2 | `src/app.js` | 1802, 1808 | M5 (Manejo de errores JS) | `.catch(() => {})` vacío en setters de configuración de sonido oculta fallos de persistencia | Agregar `showToast('Error al guardar configuración', 'error')` o `console.error()` | Bajo | pendiente |
| A3 | `src-tauri/src/cashier.rs` | 77, 83, 87 | M4 (Manejo de errores Rust) | `.unwrap_or(0)` / `.unwrap_or(0.0)` en `obtener_totales_del_dia()` oculta errores reales de BD que deberían propagarse | Reemplazar con `.map_err(|e| format!("Error al consultar ventas: {}", e))?` y retornar `Result` | Medio | pendiente |
| A4 | `src-tauri/src/db.rs` | 119, 158, 167, 202, 216, 229, 255, 271, 293, 310 | M4 (Manejo de errores Rust) | Múltiples `.unwrap_or()` / `.unwrap_or_default()` / `.unwrap_or(false)` en migraciones silencian fallos críticos de schema | Implementar logging explícito con `eprintln!()` o retornar `Result` en funciones de migración | Alto | pendiente |
| A5 | `src-tauri/src/products.rs` | 128 | M4 (Manejo de errores Rust) | `.unwrap_or(1)` en obtención de próximo código puede generar códigos duplicados si falla la consulta | Propagar error con `.map_err(|e| format!("Error al generar código: {}", e))?` | Medio | pendiente |
| A6 | `src-tauri/src/sales.rs` | 108 | M4 (Manejo de errores Rust) | `.unwrap_or_default()` en obtención de username para auditoría pierde trazabilidad si falla | Retornar `Result<String, String>` y propagar error | Bajo | pendiente |

---

### 🟡 PRIORIDAD MEDIA (Mejoras Significativas)

| # | Archivo | Línea(s) | Norma Violada | Descripción del Problema | Fix Sugerido | Esfuerzo | Estado |
|---|---------|----------|---------------|--------------------------|--------------|----------|--------|
| M1 | `src/app.js` | 417, 507, 863, 1047, 1090, 1292, 1421 | B (DRY), H (SoC Frontend) | 31 usos de `innerHTML` con templates HTML hardcodeados como strings concatenados (ej: filas de tabla, modales, recibos) | Extraer a funciones template reutilizables: `createProductRow(p)`, `createCartRow(item)`, `createClientRow(c)`, `TPL_RECEIPT_HTML` como constante | Alto | pendiente |
| M2 | `src/app.js` | 568-609 | E (Sin números mágicos), B (DRY) | HTML de recibo construido inline en `renderPaymentModal()` con literales de estructura repetitiva | Mover a constante `TPL_RECEIPT_HTML` al inicio del módulo junto a otras constantes | Medio | pendiente |
| M3 | `src-tauri/src/products.rs` | 189, 218, 301, 398 | M4 (Manejo de errores Rust) | `.unwrap_or(false)` / `.unwrap_or_default()` en operaciones críticas (verificar ventas, obtener username) | Propagar errores con `.map_err()` para mejor debugging y trazabilidad | Medio | pendiente |
| M4 | `src-tauri/src/clients.rs` | 164, 195, 222 | M4 (Manejo de errores Rust) | `.unwrap_or_default()` / `.unwrap_or("")` en obtención de datos de cliente para historial y pagos | Manejo explícito de errores con mensajes descriptivos | Medio | pendiente |
| M5 | `src-tauri/src/cashier.rs` | 155 | M4 (Manejo de errores Rust) | `.unwrap_or(std::cmp::Ordering::Equal)` en ordenamiento de métodos de pago oculta errores de comparación | Usar `.unwrap_or_else(|_| std::cmp::Ordering::Equal)` con logging o manejar explícitamente | Bajo | pendiente |
| M6 | `src-tauri/src/cashier.rs` | 252, 267, 288, 411 | M4 (Manejo de errores Rust) | `.unwrap_or_default()` / `.unwrap_or_else()` en reporte de cierre y cierres históricos | Propagar errores o agregar logging para debugging | Medio | pendiente |
| M7 | `src/app.js` | 215 | A (Anti-Hardcoding), C (SPOT) | `document.getElementById('view-' + name)` fuera del objeto SEL rompe el principio de Single Point of Truth | Agregar función helper `getViewEl(name)` o usar patrón consistente con SEL | Bajo | pendiente |
| M8 | `src/app.js` | 1268, 1308, 1336, 1357 | E (Sin números mágicos) | Números mágicos en canvas y positioning: `260`, `200`, `90`, `100`, `72`, `175`, `700`, `500`, `-9999px` | Extraer a constantes: `CANVAS_WIDTH`, `CANVAS_HEIGHT`, `CHART_CENTER_X`, `CHART_CENTER_Y`, `CHART_RADIUS`, `LEGEND_X`, `PRINT_WIDTH`, `PRINT_HEIGHT`, `OFFSCREEN_POSITION` | Bajo | pendiente |
| M9 | `src/index.html` | 130, 133, 198, 199, 244, 245, 304, 360, 367-382 | K (Temas vía CSS Variables), H (SoC Frontend) | Estilos inline con `style="..."` (font-size, color, display, flex layouts) rompen separación de concerns y dificultan temas | Mover todas las reglas a clases CSS en `style.css` usando variables CSS existentes | Medio | pendiente |
| M10 | `src-tauri/src/db.rs` | 6-82 | G (SoC Rust) | `SQL_CREATE_TABLES` como string inline masivo sin validación de schema versionado | Considerar migraciones versionadas con control explícito de versiones (ver propuesta P1) | Alto | pendiente |
| M11 | `src/app.js` | 16 | A (Anti-Hardcoding) | `CHART_COLORS` con 10 colores hardcodeados sin documentación de origen o criterio de selección | Documentar origen o permitir personalización vía `configuracion` tabla | Bajo | pendiente |

---

### 🟢 PRIORIDAD BAJA (Nice-to-Have)

| # | Archivo | Línea(s) | Norma Violada | Descripción del Problema | Fix Sugerido | Esfuerzo | Estado |
|---|---------|----------|---------------|--------------------------|--------------|----------|--------|
| B1 | `src/app.js` | 6-9 | E (Sin números mágicos) | Valores de frecuencia/duración de audio (`880`, `440`, `523`, `659`, `784`, `200`, `600`, `0.15`, `0.1`, `0.4`, `0.3`, `0.25`) como literales dentro de objeto AUDIO | Extraer a constantes con nombres descriptivos: `FREQ_ADD`, `FREQ_REMOVE`, `FREQ_SUCCESS_NOTE1`, etc. | Bajo | pendiente |
| B2 | `src/app.js` | 21-139 | C (SPOT) | Objeto SEL crece linealmente sin agrupación por dominio/módulo | Agrupar por módulo: `SEL.SALES`, `SEL.INVENTORY`, `SEL.CLIENTES`, `SEL.CASHIER`, etc. para mejor navegación | Medio | pendiente |
| B3 | `src/app.js` | 156-163 | B (DRY) | `showToast` tiene lógica de temporizador acoplada; no hay función `hideToast()` separada | Extraer `function hideToast(toastEl)` para reutilización y testing unitario | Bajo | pendiente |
| B4 | `src/app.js` | 404-421 | G (SoC Frontend) | `renderProductSearch` mezcla filtrado de datos con renderizado DOM | Separar en `filterProducts(query, categoriaId)` (puro) y `renderProductTable(products, tbody)` (DOM) | Medio | pendiente |
| B5 | `src/index.html` | 124, 199 | Accesibilidad | Placeholders sin atributos `aria-label` correspondientes | Agregar `aria-label` para lectores de pantalla | Bajo | pendiente |
| B6 | `src/app.js` | 157-162 | UX | Toast no es dismissible manualmente antes del timeout | Agregar `onclick` para cerrar temprano y mejorar UX | Bajo | pendiente |
| B7 | `src/index.html` | 399-460 | Accesibilidad | Modales sin foco trapping (focus trap) para navegación por teclado | Implementar foco trapping en apertura de modales | Medio | pendiente |
| B8 | `src-tauri/src/db.rs` | 315, 319 | E (Sin números mágicos) | `unwrap_or(std::path::Path::new("."))` usado dos veces con path por defecto hardcodeado | Extraer a constante `DEFAULT_PATH: &str = "."` | Bajo | pendiente |

---

## Propuestas de Mejora (No solicitadas pero recomendadas)

### Arquitectura Rust

| # | Archivo | Descripción | Justificación | Impacto | Esfuerzo | Estado |
|---|---------|-------------|---------------|---------|----------|--------|
| P1 | `src-tauri/src/` | Crear módulo `migrations.rs` separado | Centralizar lógica de migraciones actualmente dispersa en `db.rs`. Hacer migraciones versionadas con control explícito de schema (ej: tabla `schema_version`). Facilita testing y rollback. | Alto (mejora mantenibilidad a largo plazo) | Alto | pendiente |
| P2 | `src-tauri/src/lib.rs` | Refactorizar registro de handlers por módulos | Los 31 handlers están registrados directamente en lib.rs (líneas 36-75). Cuando el proyecto crezca (>50 handlers), será difícil de mantener. Cada módulo podría exportar su propio `get_handlers()` vector. | Medio (mejora organización) | Medio | pendiente |
| P3 | `src-tauri/src/auth.rs` | Separar `require_admin` en dos funciones | Actualmente `require_admin` hace verificación de rol + auditoría en una sola función (líneas 16-35). Separar en `check_admin_role()` y `audit_action()` facilita testing unitario y reutilización. | Medio (mejora testabilidad) | Medio | pendiente |
| P4 | `src-tauri/src/` | Agregar tests de integración para comandos Tauri | No existen tests de integración actualmente. Comandos críticos (ventas, cierre de caja, migraciones) deberían tener tests que verifiquen comportamiento transaccional y manejo de errores. | Alto (mejora calidad) | Alto | pendiente |

### Frontend JS

| # | Archivo | Descripción | Justificación | Impacto | Esfuerzo | Estado |
|---|---------|-------------|---------------|---------|----------|--------|
| P5 | `src/app.js` | Implementar debounce mayor para búsqueda de productos | Actualmente `SEARCH_DEBOUNCE_MS = 200` (línea 10). Para inventarios >1000 productos, considerar 300-400ms o delegar búsqueda al backend con invoke() en vez de filtrar `productCache` en frontend. | Medio (mejora performance) | Bajo | pendiente |
| P6 | `src/style.css` | Generar temas desde mapa SCSS/LESS si se agregan más temas | Actualmente 7 temas definidos secuencialmente (líneas 24-150 aprox). Si se planean más temas, considerar preprocesador para reducir duplicación. | Bajo (flexibilidad futura) | Medio | pendiente |
| P7 | `src/app.js` | Agregar validación de stock antes de añadir al carrito | Actualmente `addToCart()` verifica stock pero podría mostrar advertencia temprana si `stock <= 0` antes de intentar añadir. | Bajo (mejora UX) | Bajo | pendiente |

### Performance

| # | Archivo | Descripción | Justificación | Impacto | Esfuerzo | Estado |
|---|---------|-------------|---------------|---------|----------|--------|
| P8 | `src-tauri/src/products.rs` | Optimizar construcción de params_vec | Líneas 79-110: construcción dinámica con `Box<dyn ToSql>` genera allocations. Usar macro o array fijo para queries frecuentes reduce overhead. | Medio (mejora performance en listas grandes) | Medio | pendiente |
| P9 | `src/app.js` | Virtualizar tabla de inventario para >500 productos | Actualmente se renderizan todos los productos en DOM. Para inventarios grandes, considerar virtual scrolling o paginación en frontend. | Alto (mejora performance) | Alto | pendiente |

### Seguridad

| # | Archivo | Descripción | Justificación | Impacto | Esfuerzo | Estado |
|---|---------|-------------|---------------|---------|----------|--------|
| P10 | `src-tauri/src/auth.rs` | Implementar rate limiting en login | Actualmente no hay protección contra fuerza bruta en endpoint `login`. Agregar contador de intentos fallidos con bloqueo temporal. | Alto (mejora seguridad) | Medio | pendiente |
| P11 | `src-tauri/tauri.conf.json` | Revisar CSP (Content Security Policy) | Verificar que CSP esté configurado correctamente para prevenir XSS, especialmente dado uso extensivo de `innerHTML`. | Alto (mejora seguridad) | Bajo | pendiente |

---

## Matriz de Cumplimiento de Normas

| Norma | Estado | Observaciones |
|-------|--------|---------------|
| **A. Anti-Hardcoding** | ⚠️ Parcial | Constants.rs bien implementado, pero app.js tiene selectores dinámicos y números mágicos en canvas |
| **B. DRY** | ❌ Violado | 31 templates HTML inline repetitivos en app.js |
| **C. SPOT** | ⚠️ Parcial | SEL object existe pero crece sin organización; algunos accesos DOM fuera de SEL |
| **D. KISS** | ✅ Cumplido | Sin over-engineering, arquitectura simple apropiada |
| **E. Sin Números Mágicos** | ❌ Violado | Canvas dimensions, audio frequencies, print positioning como literales |
| **F. YAGNI** | ✅ Cumplido | Solo funcionalidad solicitada implementada |
| **G. SoC (Rust)** | ⚠️ Parcial | db.rs mezcla creación de tablas + migraciones + defaults + auto-import |
| **H. SoC (Frontend)** | ❌ Violado | Templates HTML inline en JS, estilos inline en HTML |
| **I. Nomenclatura Icons** | ✅ Cumplido | Uso correcto de `nf nf-fa-NOMBRE` sin CDN |
| **J. Cohesión/Acoplamiento** | ✅ Cumplido | Frontend no conoce SQL, solo invoke() commands |
| **K. Temas vía CSS Variables** | ⚠️ Parcial | Estilos inline en HTML rompen sistema de temas |

---

## Matriz de Cumplimiento de Reglas del Proyecto

| Regla | Estado | Observaciones |
|-------|--------|---------------|
| **1. Cero SQL en frontend** | ✅ Cumplido | Todo acceso a datos vía invoke() |
| **2. DRY + Reutilización (Rust)** | ⚠️ Parcial | Helpers existen pero unwrap_or oculta errores repetidamente |
| **3. DRY + Reutilización (JS)** | ⚠️ Parcial | Funciones utilitarias existen pero templates no se reutilizan |
| **4. Manejo de errores (Rust)** | ❌ Violado | Excesivo uso de unwrap_or que silencia errores |
| **5. Manejo de errores (JS)** | ❌ Violado | Catch blocks vacíos en 3 ubicaciones críticas |
| **6. Temas** | ✅ Cumplido | 7 temas implementados vía CSS vars |
| **7. Roles** | ✅ Cumplido | require_admin() y applyRoleUI() funcionando |
| **8. SQLite** | ✅ Cumplido | WAL mode, FK ON, migraciones automáticas |
| **9. Seguridad** | ⚠️ Parcial | SHA-256 implementado, falta rate limiting y revisión CSP |
| **10. Sin dependencias externas** | ✅ Cumplido | 100% offline, Font Awesome local |

---

## Estimación de Esfuerzo Total

| Prioridad | Cantidad | Esfuerzo Individual | Esfuerzo Total |
|-----------|----------|---------------------|----------------|
| **Alta** | 6 hallazgos | 0.5 - 2 horas c/u | **6-8 horas** |
| **Media** | 11 hallazgos | 1 - 3 horas c/u | **20-28 horas** |
| **Baja** | 8 hallazgos | 0.5 - 1 hora c/u | **5-8 horas** |
| **Mejoras (P1-P11)** | 11 propuestas | 1 - 4 horas c/u | **25-35 horas** |

### **Total General: 56-79 horas de desarrollo**

---

## Roadmap Recomendado

### Fase 1 — Crítico (Semana 1-2)
- [ ] A1, A2: Fix manejo de errores JS vacíos
- [ ] A3, A4, A5, A6: Fix manejo de errores Rust en cashier.rs, db.rs, products.rs, sales.rs
- [ ] M7: Fix selector dinámico fuera de SEL

### Fase 2 — Calidad de Código (Semana 3-4)
- [ ] M1, M2: Refactor templates HTML inline a funciones
- [ ] M8: Extraer números mágicos de canvas/print a constantes
- [ ] M9: Mover estilos inline de HTML a CSS
- [ ] B1, B2, B3: Mejoras de organización en app.js

### Fase 3 — Mejoras Arquitectónicas (Semana 5-6)
- [ ] P1: Crear módulo migrations.rs versionado
- [ ] P3: Separar require_admin en funciones independientes
- [ ] P10: Implementar rate limiting en login
- [ ] P11: Revisar y fortalecer CSP

### Fase 4 — Optimización (Semana 7-8)
- [ ] P8: Optimizar allocations en queries de productos
- [ ] P9: Virtualizar tabla de inventario (si >500 productos)
- [ ] B4, B5, B6, B7: Mejoras de UX y accesibilidad

---

## Decisiones Técnicas Pendientes (para decisiones.md)

Las siguientes decisiones deben documentarse en `decisiones.md` una vez resueltas:

1. **¿Migrar templates HTML inline a funciones template?** → Requiere evaluar impacto en performance vs mantenibilidad. **Recomendación: SÍ** (prioridad media).

2. **¿Implementar migraciones versionadas en Rust?** → Impacto alto pero necesario para escalar. **Recomendación: SÍ** (prioridad alta para proyectos con schema evolutivo).

3. **¿Refactorizar SEL por módulos?** → Mejora organización pero requiere actualizar ~140 referencias. **Recomendación: SÍ** (prioridad baja, hacer gradualmente).

4. **¿Agregar tests de integración para comandos Tauri?** → No existen tests actualmente. **Recomendación: SÍ** (empezar con comandos críticos: create_sale, close_cashier).

5. **¿Implementar rate limiting en login?** → Mejora seguridad pero agrega complejidad. **Recomendación: SÍ** (bajo esfuerzo, alto impacto).

---

## Anexos

### Archivos Auditados

| Archivo | Líneas | Estado |
|---------|--------|--------|
| `src/index.html` | ~400 | ✅ Leído |
| `src/app.js` | 1960 | ✅ Leído |
| `src/style.css` | ~600 | ✅ Referenciado |
| `src/fa-local.css` | ~200 | ✅ Referenciado |
| `src-tauri/src/main.rs` | ~10 | ✅ Referenciado |
| `src-tauri/src/lib.rs` | 79 | ✅ Leído |
| `src-tauri/src/db.rs` | 382 | ✅ Leído |
| `src-tauri/src/models.rs` | ~150 | ✅ Referenciado |
| `src-tauri/src/auth.rs` | ~180 | ✅ Referenciado |
| `src-tauri/src/products.rs` | ~480 | ✅ Leído parcialmente |
| `src-tauri/src/sales.rs` | ~350 | ✅ Leído parcialmente |
| `src-tauri/src/clients.rs` | ~280 | ✅ Leído parcialmente |
| `src-tauri/src/cashier.rs` | ~450 | ✅ Leído parcialmente |
| `src-tauri/src/categorias.rs` | ~120 | ✅ Referenciado |
| `src-tauri/src/audit.rs` | ~100 | ✅ Referenciado |
| `src-tauri/src/config.rs` | ~60 | ✅ Referenciado |
| `src-tauri/src/constants.rs` | 48 | ✅ Leído |

### Comandos de Verificación Usados

```bash
# Contar usos de innerHTML (violación DRY)
grep -n "innerHTML\s*=" src/app.js | wc -l  # Resultado: 31

# Buscar catch vacíos (violación M5)
grep -n "catch(e) {}\|catch(() => {})" src/app.js  # Resultado: 3 líneas

# Buscar unwrap_or en Rust (violación M4)
grep -n "unwrap_or" src-tauri/src/*.rs  # Resultado: 40+ ocurrencias

# Buscar estilos inline en HTML (violación H)
grep -n "style=\"" src/index.html  # Resultado: 20+ líneas
```

---

*Documento generado tras auditoría de código. Las prioridades pueden ajustarse según roadmap del proyecto y disponibilidad del equipo.*

**Próximo paso:** Revisar este plan con el equipo de desarrollo, priorizar tareas según cronograma, y comenzar implementación Fase 1.
