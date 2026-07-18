# Contexto: POS de Escritorio — Tauri v2 + Rust/SQLite + HTML/CSS/JS Vanilla

App POS 100% offline-first con Tauri v2, Rust backend con SQLite via rusqlite (bundled), y frontend vanilla HTML/CSS/JS con Font Awesome 6 Free local. Sin CDN, sin dependencias externas de red. Sin Tailwind, sin Electron, sin sql.js.

Sincronización opcional con Supabase (Fases 4-6 implementadas: upload/download clientes, productos, ventas; sync_all con progreso; vista sync con estadísticas, prueba de conexión, conflictos). Sin CDN, todo local.

---

## ⚠️ RESTRICCIONES DE ENTORNO

No ejecutes ni compiles. Todo se maneja desde la raíz del proyecto con `npm run dev` (desktop) o `npx tauri android build` (Android).

*IMPORTANTE — LECTURA DE ARCHIVOS:*
- ✅ LEE: `src/index.html`, `src/app.js`, `src/style.css`, `src/fa-local.css`, `src-tauri/src/*.rs`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `package.json`, `AGENTS.md`
- ❌ NO LEAS: Archivos dentro de `node_modules/`, `target/`, `gen/` (build outputs)
- La UI está en `src/`. El backend Rust en `src-tauri/src/`. La configuración y documentación está en `AGENTS.md`.

---

## Rol

Eres un auditor/planificador. Lees el código fuente completo y generas un archivo `plan_modificaciones.md` con las tareas a implementar, priorizadas y detalladas.

*Filosofía:* Si una implementación requiere más trabajo pero es más robusta, mantenible y escalable, proponla. Estamos en etapa de mejora interna del código, no en parches rápidos.

---

## ENTREGABLE 1: plan_modificaciones.md

Genera un archivo `plan_modificaciones.md` en la raíz del proyecto con:

```markdown
# Plan de Modificaciones

Prioridad: Alta > Media > Baja

---

## Hallazgos de auditoría
[Violaciones a reglas encontradas en el código, priorizadas]

## Propuestas de mejora
[Mejoras no solicitadas pero que valen la pena, con justificación]
```

Cada entrada debe incluir:
- Archivo: ruta relativa
- Línea: número aproximado
- Descripción del problema: claro y específico
- Fix sugerido: acción concreta implementable
- Esfuerzo: Bajo | Medio | Alto
- Estado: pendiente

Al terminar, NO ejecutes ningún comando, solo genera el contenido del archivo y preséntalo al usuario.

---

## NORMAS DE CÓDIGO LIMPIO (auditar contra estas reglas)

### A. Anti-Hardcoding (Rust y JS)
Queda prohibido escribir valores fijos (nombres de tabla/columna SQL, mensajes de error, literales CSS, selectores DOM, claves de configuración) dentro de funciones de lógica. Todo valor variable debe ir en constantes al inicio del módulo.

**Mal** (Rust): `conn.execute("SELECT * FROM productos WHERE activo = 1", ...)`
**Bien** (Rust): `const SQL_LISTAR_PRODUCTOS: &str = "SELECT ...";`

**Mal** (JS): `document.getElementById('sales-category-filter')`
**Bien** (JS): `const SEL = { CATEGORY_FILTER: '#sales-category-filter' }; qs(SEL.CATEGORY_FILTER)`

### B. DRY (Don't Repeat Yourself)
Si la misma lógica JS, patrón SQL o bloque CSS aparece más de dos veces, abstraer en función utilitaria (JS) o función helper (Rust: `fn` privada).

### C. SPOT — Single Point of Truth
Un dato o lógica debe existir en un solo lugar. Si cambia, se actualiza en ese único punto. Los structs `models.rs` son el SPOT de las entidades. Las constantes SQL deben estar en su módulo respectivo. Los selectores DOM importantes deben estar en `const SEL = { ... }` al inicio de `app.js`.

### D. KISS — Keep It Simple, Stupid
La solución más simple que cumpla el requerimiento. Sin over-engineering. Un solo archivo HTML (`index.html`) con modales. Sin SPA routing. Sin frameworks JS. Sin librerías externas.

### E. Sin Números/Textos Mágicos
Cero literales numéricos o strings dentro de funciones de lógica. Todo debe ser una constante con nombre: `const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024;` en Rust, `const TOAST_DURATION = 3000;` en JS.

### F. YAGNI — You Aren't Gonna Need It
Resolver única y exclusivamente lo solicitado. No agregar funcionalidades "por si acaso" (filtros avanzados, reportes extra, exportaciones múltiples que no se pidieron).

### G. SoC — Separation of Concerns (Rust)
Separar módulos Rust por dominio: `products.rs` solo maneja productos, `sales.rs` solo ventas, etc. Ningún módulo debe mezclar lógica de otro dominio. Las consultas SQL van en el módulo correspondiente, no en `lib.rs`.

Módulos actuales: `db.rs`, `models.rs`, `auth.rs`, `products.rs`, `sales.rs`, `clients.rs`, `cashier.rs`, `categorias.rs`, `config.rs`, `sync.rs`, `tasa_bcv.rs`, `audit.rs`, `migrations.rs`, `constants.rs`.

### H. SoC Frontend
`app.js` maneja toda la lógica JS. `index.html` solo tiene estructura HTML y carga de recursos. `style.css` tiene todos los estilos incluyendo 7 temas vía CSS custom properties. No mezclar lógica en HTML (`onclick`, etc.). Los event listeners se asignan en `app.js`.

### I. Nomenclatura Iconos
Los iconos Font Awesome se usan con clase `nf nf-fa-NOMBRE` (ej: `nf nf-fa-shopping_cart`). El mapeo `nf-fa-NOMBRE` → unicode está en `fa-local.css`. No usar clases `fa` ni `fas`. No cargar Font Awesome desde CDN.

### J. Cohesión Alta, Acoplamiento Bajo
Las funciones Rust deben cooperar para el mismo fin. Si cambia la estructura de DB, solo debe afectar al módulo Rust correspondiente + `models.rs`. El frontend JS no conoce SQL; solo llama a `invoke('comando', args)` y recibe datos JSON.

### K. Temas vía CSS Variables
Los 7 temas se implementan con `[data-theme="..."]` selectores en CSS que redefinen las variables `:root`. No hay JS para aplicar estilos de color. Solo se cambia `document.documentElement.dataset.theme`. Todas las referencias de color en HTML/CSS deben usar `var(--variable)`.

---

## REGLAS DEL PROYECTO (priorizadas)

### 1. Cero SQL en frontend
No debe haber strings SQL en `app.js` ni `index.html`. Todo el acceso a datos es vía `window.__TAURI__.core.invoke('comando_rust', args)`. Los comandos Rust se definen en cada módulo y se registran en `lib.rs`. La estructura de tablas solo existe en Rust y SQLite.

### 2. DRY + Reutilización (Rust)
Cada módulo Rust tiene funciones privadas helper reutilizables. No copiar consultas SQL idénticas entre módulos. Si dos módulos necesitan la misma consulta, crear una función compartida en `db.rs` o en un módulo helper.

Funciones compartidas ya existentes (usar, no duplicar):
- `db::init_db()` — inicializa BD, migraciones, defaults
- Los structs en `models.rs` — compartidos entre módulos
- `auth::hash_password()` — hashing SHA-256
- `auth::require_admin()` — verificación de rol admin
- `emit_progress()` en `sync.rs` — emite eventos de progreso

### 3. DRY + Reutilización (JS)
Funciones utilitarias ya existentes en `app.js` (usar, no duplicar):
- `qs(sel)` / `qsa(sel)` — querySelector shorthand
- `showToast(msg, type)` — notificaciones toast
- `formatUSD(v)` / `formatBS(v)` — formateo de moneda
- `playSound(type)` — sonidos Web Audio API
- `applyRoleUI()` — oculta `.admin-only` según rol
- `loadProductCache()` — cache de productos en frontend
- `loadTasa()` — obtiene tasa actual
- `toggleDropdown(btn, menuId)` — dropdown con `position: fixed`
- `escapeHtml(str)` — sanitización XSS
- `showModal(el)` — muestra modal
- `confirmModal(text, title, confirmLabel)` — confirmación async
- `emptyState(icon, title, desc, container)` — estado vacío
- `isBsMethod(method)` — detecta métodos de pago en Bs
- `toggleColumns(cols, container)` — column picker

### 4. Manejo de errores (Rust)
Todos los comandos Tauri deben retornar `Result<T, String>`. Errores de BD deben propagarse con mensajes claros. Usar `.map_err(|e| format!("...: {}", e))`. No usar `.unwrap()` ni `.expect()` en comandos.

### 5. Manejo de errores (JS)
Toda llamada a `invoke()` debe tener `.catch(err => showToast(err, 'error'))`. Errores de red/backend deben mostrarse al usuario. No silenciar errores con `catch(e => {})`.

### 6. Temas
7 temas predefinidos via CSS variables: oscuro, claro, azul, verde, morado, turquesa, naranja. Se almacenan en `configuracion` clave `tema`. Al cargar, se aplica `document.documentElement.dataset.theme = valor`. El frontend obtiene los nombres via `invoke('list_theme_names')` (retorna los 7 strings).

### 7. Roles
Admin y Vendedor. Los comandos Rust llaman `require_admin(app_state)` si son admin-only. El frontend llama `applyRoleUI()` tras login para ocultar elementos `.admin-only`. Vendedor no puede: crear/editar/eliminar productos, gestionar categorías, crear usuarios, gestionar clientes.

### 8. SQLite
DB en archivo. WAL mode. Foreign keys ON. Migraciones automáticas en `migrations.rs` via `PRAGMA table_info`. Bound parameters siempre (nunca interpolación). JOINs en vez de subqueries.

### 9. Seguridad
Contraseñas hasheadas con SHA-256 (`auth.rs`). CSP configurado en `tauri.conf.json`. Verificación de rol en cada comando del backend. Sin exponer datos sensibles al frontend que no correspondan al rol.

### 10. Sin dependencias externas
100% offline-first. Font Awesome 6 Free local en `src/fonts/` + `src/fa-local.css`. Sin CDN, sin Google Fonts, sin librerías externas JS. Todo el CSS propio en `style.css`. Supabase sync es opcional.

---

## SCHEMA SQLite

| Tabla | Columnas clave |
|---|---|
| `productos` | `codigo` (PK TEXT auto-generado P####), `nombre`, `precio_usd`, `stock`, `stock_minimo`, `activo` (default 1), `categoria_id` (FK), `created_at`, `updated_at`, `sync_id` (TEXT UNIQUE) |
| `categorias` | `id` (PK), `nombre` (UNIQUE), `color` |
| `clientes` | `id` (PK), `nombre`, `credito_activo` (0/1), `saldo_deuda_usd`, `sync_id` (TEXT UNIQUE), `updated_at` |
| `ventas` | `id` (PK), `fecha_hora`, `usuario_id`, `metodo_pago`, `referencia_pago_movil`, `pago_detalle`, `cliente_id`, `total_usd`, `tasa_aplicada`, `anulada` (0/1), `sync_id` (TEXT UNIQUE), `dispositivo_origen` (TEXT), `updated_at` |
| `detalles_ventas` | `id`, `venta_id`, `producto_codigo`, `cantidad`, `precio_usd_unitario`, `anulado` (0/1), `sync_id` (TEXT UNIQUE), `updated_at` |
| `usuarios` | `id`, `username` (UNIQUE), `password`, `rol` (CHECK admin/vendedor) |
| `configuracion` | `clave` (PK), `valor` |
| `historial_acciones` | `id`, `fecha_hora`, `usuario`, `accion` |
| `cierres_caja` | `id`, `fecha_hora`, `usuario_id`, `total_ventas`, `total_usd`, `tasa_cierre` |
| `cierres_detalle` | `cierre_id` (PK), `detalle_json` |
| `ajustes_stock` | `id`, `producto_codigo`, `cantidad_anterior`, `cantidad_nueva`, `motivo`, `usuario_id`, `fecha_hora` |
| `conflictos` | `id` (PK), `tabla`, `registro_id_local`, `local_json`, `remote_json`, `resuelto` (0/1) |

Migraciones: 001→016 en `migrations.rs`.

---

## ESTRUCTURA DEL PROYECTO

```
gestor_ventas/
├── src/                          # Frontend
│   ├── index.html                # UI completa (sin build step)
│   ├── app.js                    # Lógica frontend (~3450 líneas, eventos, invoke, render, sync)
│   ├── style.css                 # 7 temas via CSS vars, layout, componentes, responsive
│   ├── fa-local.css              # Mapeo nf-fa-* → unicode Font Awesome
│   └── fonts/                    # woff2 + ttf de Font Awesome Free
├── src-tauri/
│   ├── src/
│   │   ├── main.rs               # Entry point + mobile_entry_point
│   │   ├── lib.rs                # tauri::Builder, setup, register handlers
│   │   ├── db.rs                 # init_db(), AppState, backup
│   │   ├── models.rs             # Structs serde (Producto, Venta, etc.)
│   │   ├── migrations.rs         # Migraciones 001→016
│   │   ├── auth.rs               # Login/logout, hash, require_admin, cambio password
│   │   ├── products.rs           # CRUD productos, import/export XLSX, paginación
│   │   ├── sales.rs              # Ventas transaccionales, tasa, anulación, reportes, export XLSX
│   │   ├── clients.rs            # CRUD clientes, crédito, abonos, historial
│   │   ├── cashier.rs            # Apertura/cierre caja, resumen diario, dashboard summary
│   │   ├── categorias.rs         # CRUD categorías
│   │   ├── config.rs             # Config clave-valor (tasa, sonido, temas, sync timestamps)
│   │   ├── sync.rs               # Supabase sync (upload/download productos, ventas, clientes; sync_all; conflictos)
│   │   ├── tasa_bcv.rs           # Fetch BCV desde API externa, check_tasa_update
│   │   ├── audit.rs              # Historial de acciones
│   │   └── constants.rs          # Constantes (métodos de pago, config keys)
│   ├── tauri.conf.json           # Config Tauri (identifier, CSP, ventana 1200x800)
│   └── Cargo.toml                # Dependencias Rust (rusqlite bundled, serde, reqwest, etc.)
├── package.json                  # Scripts npm (tauri dev/build)
├── AGENTS.md                     # Documentación completa del proyecto
├── prompt_auditoria.md           # Este archivo
└── gestor_ventas.db              # SQLite DB (auto-creada)
```

---

## FUNCIONALIDAD YA IMPLEMENTADA

- **Login** con 3 usuarios default (admin/admin, jota/1234, vendedor/1234), cambio password
- **Sidebar** con 7 vistas: Ventas, Inventario, Crédito, Caja, Historial, Config, Sync
- **Ventas**: búsqueda + filtro categoría, carrito, cobro (7 métodos + mixto + vuelto), recibo imprimible, anulación total/parcial con restauración de stock
- **Inventario**: tabla con búsqueda + paginación (50/page), menú ⋮, modal edición (sin código), import TSV, export XLSX
- **Crédito**: clientes con deuda, historial, abonos con método de pago
- **Caja**: apertura/cierre, resumen diario, dashboard summary, toggle barras/pastel
- **Historial**: auditoría paginada (50), limpieza automática configurable
- **Config**: 7 temas, tamaño fuente, pantalla completa, sonidos, categorías, limpieza, backup DB, gestión usuarios
- **Productos**: auto-código P####, soft delete, reactivación, caché frontend, stock mínimo
- **Tasa del día**: cualquiera puede actualizar, alarma si no se actualizó hoy, fetch BCV automático
- **Pago Móvil**: referencia 4 dígitos, se muestra en resúmenes y PDF
- **Sync (Fases 4-6)**: upload/download productos/clientes/ventas a Supabase; sync_all con progreso; test conexión; stats; conflictos con tabla e interfaz de resolución
- **100% offline-first**, sin CDN, sin frameworks JS, Font Awesome 6 Free local

---

## INSTRUCCIONES FINALES

1. **Auditar**: detectar violaciones a las normas (hardcodeo, DRY, SoC, números mágicos, SQL en frontend, etc.)
2. **Priorizar**: Alta (bloqueante/urgente, crasheo) > Media (mejora significativa) > Baja (nice-to-have)
3. **No ejecutar nada**: solo generar contenido de `plan_modificaciones.md`, presentarlo
4. **Registrar decisiones**: mantener cronológicamente en un archivo `decisiones.md` en la raíz con formato ADR (ID, Origen, Contexto, Alternativas, Impacto) para cada decisión técnica nueva
