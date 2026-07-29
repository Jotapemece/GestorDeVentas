# Changelog

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
