# Changelog

## [1.1.0] - 2026-08-02

### UI móvil rediseñada (≤600px)
- POS táctil: grid de tarjetas de producto (2 columnas) y carrito como bottom-sheet con botón flotante (FAB) y contador
- Búsqueda de productos fija al hacer scroll
- Tablas convertidas en tarjetas en inventario, créditos, ventas del día, auditoría y reportes
- Modal de pago táctil: totales y métodos de pago en dos columnas, botones grandes, pie fijo
- Haptics (vibración), soporte de zonas seguras (safe-area) y unidades `dvh`
- Fix: el FAB del carrito ya no aparece en la interfaz de PC

### Nuevas funciones
- Productos favoritos (toggle con estrella en inventario)
- Nota opcional en la venta, visible en el detalle
- Exportación de reportes a PDF (`export_report_pdf`)
- Historial de precios por producto (`get_precio_historial`)
- Reporte de ventas por vendedor (`get_sales_by_vendor`)
- Retención configurable de backups (`max_backups`, 10 por defecto)
- Atajo rápido de cantidad en el carrito
- Clientes temporales de crédito: marca "Temporal", se crean desde "Registrar Persona" (checkbox) y se eliminan automáticamente al saldar su deuda. Historial de temporales en Crédito → "Historial Temporales" (tabla `clientes_eliminados`). No se suben a Supabase
- Ajuste manual de stock con auditoría: "Ajustar stock" en el dropdown de cada producto (delta +/-, motivo obligatorio), registrado en `ajustes_stock` y en el historial de auditoría
- Backup diario automático al cerrar caja (una vez por día, cifrado AES-256-GCM), aviso en el reporte de cierre

### Pulido UX
- Favoritos y recientes en tablas separadas en el POS (estrella junto al nombre); tarjetas móviles con color en inventario, créditos y caja
- Contadores animados (count-up) en totales del carrito y del dashboard
- Check verde animado al registrar una venta (`showPaymentSuccess`)
- Efecto de presión al tocar botones (scale), scrollbars finas con color del tema y números tabulares
- En móvil: la fly animation del carrito vuela al botón flotante (FAB) y el bottom-sheet queda por encima de la barra de navegación

### Seguridad
- Rate limiting real (helpers `rate_limit_fail`/`rate_limit_success` + guards `admin_guard`/`employee_guard`) en create_sale, set_tasa, void_sale_items, void_sale, pay_debt, add_quick_debt, restore_backup, get_backup_key, clear_audit, y gestión de usuarios/config
- El sync de usuarios ya no sube hashes Argon2 (download fuerza `password_change_required=1`)
- Migraciones a prueba de fallos: no marcan versión aplicada si fallan; 002 idempotente

### Optimización / deuda técnica
- Helpers DRY en Rust: get/set_config_value, add_stock/sub_stock, fallback_total_bs, sumar_ventas_rango, row_to_combo, guards unificados
- Código muerto eliminado en Rust y JS (constantes, structs redundantes, funciones sin uso)
- Helpers compartidos en frontend: bsToUsd, getTasaConFallback, esRefPagoMovilValida, buildReportFilter; migración de selectores a SEL
- CSS deduplicado y reglas faltantes aplicadas
- `PRAGMA busy_timeout=5000` para evitar "database is locked" en sync paralelo
- Contadores reales de upload/download en sync (filas afectadas)
- Eliminados re-renders innecesarios del carrito

### Bugs
- Ventas por vendedor: el filtro de fecha incluye el fin de día (END_OF_DAY_SUFFIX)
- `DetalleVenta.costo` real en historial de clientes (antes hardcodeado a 0)
- Iconos Font Awesome inexistentes en el subset (cloud, arrows, key, clock_rotate_left) y variables CSS indefinidas (`--text-rgb`, `--text-muted`)
- Base `font-size` 16px restaurada (sobrescrita por 14px) y `@keyframes fadeIn` que faltaba
- Toasts ahora por encima de los modales (z-index)

### Consistencia de UI
- Empty states unificados con `emptyState()` en cierres, movimientos, crédito, tasas e historial de productos
- Summary cards con iconos consistentes en caja, crédito y reportes (`.summary-icon`)
- Reportes: nueva columna Acción con botón de detalle por venta (reutiliza `sale-detail-btn`)
- "Agregar Producto" unificado a `btn-primary`; botones de sync con transición
- Confirmaciones con icono de check (helpers `confirmModal`/`promptModal`)
- Nota de venta con estilo propio `.sale-note`, separado del motivo de anulación `.void-note`
- Estado Anulado/Activo como badges (`.badge-danger`/`.badge-success`) en detalle, ventas del día y reportes
- CSS duplicados fusionados (input:focus, col-toggle-btn, mixto-add-row, field-error, chat-header); `--info`/`--warning` definidos

## [1.0.5] - 2026-07-30

### UI/UX
- Producto pesable por kilo: toggle en formulario, labels dinámicos, hover card y detail modal adaptados
- Fly animation carrito: ease-out 0.4s, arco -24px Y, ripple al llegar, toggle sin animaciones (body.no-animations)
- Modal drag en PC: arrastrable con opacidad 75% al mover, toggle en Config → Calidad de vida
- Modal resize en móvil: handle para redimensionar, clamp 250px-92vh
- Cart divider en PC: 8px vertical, cursor col-resize, clamp 20%-60%
- Hover card con delay de 300ms
- Productos recientes integrados en tabla de búsqueda (sin sección separada)
- Botones de inventario en línea con la barra de búsqueda: Agregar Producto, Inari, Tasa, Más acciones
- Icono de acciones (⋮) corregido: usa Font Awesome nf-fa-ellipsis_v en vez de entidad HTML no estándar
- Barra de tasa más compacta en móvil (input 65px, botones reducidos)
- Botón de calculadora oculto en móvil

### Bugs
- Inari: ahora chequea día válido (Jueves-Domingo) en manual toggle, auto-view y applyInariConfig
- FAB drag: bottomMargin 100px para evitar que quede detrás de la barra de navegación

### Rendimiento
- Tasa BCV timeout aumentado a 15s con mensaje de error más limpio

## [1.0.4] - 2026-07-29

### Seguridad
- XSS: escapeHtml() añadido a modales de cierre de caja, historial y recent-chip
- Path traversal: sanitize_backup_path() en backup_database y restore_backup
- Rate limiting en create_sale, void_sale_items, set_tasa, pay_debt, add_quick_debt, restore_backup, get_backup_key, clear_audit
- Timing attack: constant_time_eq() para legacy SHA-256
- hash_password() devuelve Result en vez de panic
- Admin reset crea usuarios con password_change_required=1

### Estabilidad
- Transacciones SQL en delete_product, create_sale, void_sale, change_password
- Race condition corregida en restore_backup (wal_checkpoint + fs::copy bajo el mismo lock)
- list_sales con paginación (page/page_size → PaginatedResult)

### Deuda técnica
- SQL JOINs consolidados (SQL_SELECT_VENTAS compartido entre sales.rs/cashier.rs)
- Helper renderPagination() en utils.js, refactorizado en inventory-view.js
- app.js partido en shortcuts.js + fab.js (1742 → 1585 líneas)
- Globales mutables migrados a store.js
- Funciones Rust no usadas eliminadas (increment/clear_action_rate_limit)

### UI/UX
- Search bar se estira en desktop, botón × reposicionado
- Botón Inari movido a dropdown "Más acciones"
- list_categorias expuesto como comando Tauri

### Sync
- Fase 4: upload/download clientes con UUID y updated_at
- Fase 8: tabla conflictos + resolución last-write-wins

## [1.0.3] - 2026-07-??

- Animación vuelo carrito, compact toggle, filtro categoría POS, tarjeta saludo login, hover card producto, búsqueda global Ctrl+K

## [1.0.2] - 2026-07-??

- (not available)

## [1.0.1] - 2026-07-??

- (not available)

## [1.0.0] - 2026-07-??

- Versión inicial
