# Changelog

## [1.2.1] - 2026-08-13

### Permisos por rol (Fase A)
- Al iniciar sesión se valida que la última vista abierta pertenezca al rol del usuario (un vendedor no queda dentro de una sección solo de administradores)
- Los vendedores ya no pueden anular ventas ni ítems (solo administradores). En su lugar pueden **"Solicitar anulación"**: el admin aprueba/rechaza desde un modal con badge, y la anulación viaja por sync (`anulado_delta` restaura stock en todos los dispositivos)
- Vendedores no ven el historial de precios de productos, los cierres anteriores, la configuración de la IA ni el ajuste de efectivo; la lista de usuarios solo se carga para administradores (se elimina el error "solo el administrador puede entrar")
- `void_sale`/`void_sale_items` pasan de `employee_guard` a `admin_guard`; botones "Anular" ocultos para no-admin

### Caja y crédito (Fase B)
- Los abonos/pagos de deuda se muestran en la caja con el método usado: "Abono deuda - Cliente #X - Crédito (Biopago)" o "... - Pago Móvil: 7890" (los 4 dígitos con dos puntos)
- El fiado no cuenta en el saldo de caja; los abonos suben la caja y aparecen en el listado de movimientos y gráficos (`neto_movimientos` en barras/ganancias/pastel)
- **Clientes temporales eliminados (Fase G)**: migración que convierte los temporales existentes a normales; se quitan el checkbox "Cliente temporal", el badge, "Historial Temporales", `list_clientes_eliminados`, la exclusión de temporales en sync y el historial de la guía

### Sincronización (Fase C)
- Las categorías viajan con sus productos: `categoria_nombre` se sube en el upload y se re-mapea al id local por nombre al descargar (requiere `ALTER TABLE productos ADD COLUMN categoria_nombre TEXT DEFAULT ''` en Supabase)
- Las solicitudes de anulación se sincronizan entre dispositivos (tabla `solicitudes_anulacion`, watermark LWW por `sync_id` + `dispositivo_origen`; etapa propia en upload/download/sync_all)

### Recuperación ante corte de energía (Fase D)
- Si la app se cerró sin hacer el cierre de caja: al abrir descarga las ventas de otros dispositivos y muestra un modal "Cierre pendiente" que lleva directo a la zona de Caja (`get_pendiente_cierre` detecta caja abierta con ventas del día anterior sin cierre)
- Android: botón "Exportar BD y borrar datos" en Configuración (dos pasos: backup cifrado a Descargas → limpiar datos)

### Fechas y calendarios (Fase E)
- Las fechas/horas se muestran en formato local limpio sin "+00:00"/Z en historial, cierres, ventas, alertas y sync (`formatDateTime`)
- Calendario personalizado reutilizable para el rango de fechas de Reportes (reutiliza el de historial de tasas; cierra con clic fuera)
- El detalle de una venta vieja muestra la tasa aplicada ese día (`tasa_aplicada`)
- El calendario de tasas del inventario vuelve a mostrar "Hoy" al seleccionar la fecha actual

### Tablas y gráficos (Fase F)
- Al restaurar una columna, su botón de ojo vuelve al estado normal (ya no queda tachado)
- El orden de las tablas se persiste en localStorage por tabla (`sort-<tableId>`) y se re-aplica al volver a abrir sesión
- Los gráficos del dashboard ya no se dibujan colapsados al entrar (guard de ancho en bar/pie/line) y se redibujan al expandir la tarjeta
- Drill-down Hoy/7 días/Mes sin doble carga: ya no queda el cuadro morado con el círculo girando

### Alertas de crédito
- Badge + panel de alertas para el admin: notifican ventas a crédito, abonos, deudas rápidas y anulaciones que revierten deuda hechas por VENDEDORES, con sincronización multi-dispositivo vía Supabase (tabla `alertas_credito`)

## [1.2.0] - 2026-08-06

### Bugs (fix crítico en 1.2.1)
- **Fix de bloqueo (app colgada) al restaurar columnas**: `sortRows` en `initTableSorting` (utils.js) re-movía siempre las filas aunque ya estuvieran ordenadas, lo que disparaba el `MutationObserver` en bucle infinito (cuelgues al restaurar columnas, recargar con orden guardado y persistía al reiniciar). Ahora no se muta el DOM si el orden no cambió y el observer se desconecta durante el sort. +2 tests vitest

### Lógica de caja
- Las ventas a crédito (fiado) ya no cuentan en el saldo de caja (`get_saldo_caja` excluye `metodo_pago = 'credito'`): el dinero que no entra a la caja no suma. Las ventas totales (incl. crédito) siguen visibles como cuentas por cobrar
- Los pagos/abonos de deuda se registran como ingreso de caja (`pay_debt` inserta un movimiento tipo `ingreso`) con el método de pago en el concepto ("Abono deuda - Cliente #X - Método: ... - Ref: ..."). Suben el saldo y aparecen en el listado de movimientos
- Los movimientos de caja (ingresos/egresos) afectan los gráficos de reportes:
  - Barras del dashboard: nueva métrica "Caja" = ventas + neto de movimientos; cards con fila "Mov. neto" por período
  - Ganancias (línea): el resultado del día incorpora el neto de movimientos (días con solo movimientos también aparecen) y se muestra en el tooltip
  - Pastel: porción "Ingresos caja" con el neto de movimientos del período

### Seguridad
- `create_sale` deriva el vendedor y el flag `es_inari` de la BD/sesión (no del request): no se puede saltar el control de stock ni forjar autoría
- `register_movimiento` usa la sesión (no `usuario_id`/`username` del request) y valida tipo y montos
- Guards de rol añadidos: `set_tasa`, `pay_debt`, `add_quick_debt`, mutaciones de sync (`upload/download_all`, `upload_*`, `resolve_conflicto`), `apply_download`
- `get_config_value`/`get_user_config_value` exigen sesión y bloquean `CFG_BACKUP_KEY` (la clave maestra de cifrado solo sale por `get_backup_key`, admin-only)
- OpenRouter: la API key ya no viaja por IPC a la webview — se lee desde `configuracion` en el backend (`chat_with_ai`, `generate_purchase_suggestion`)
- Nuevo comando `save_exported_file` con auth de empleado, cap de 200 MB y nombre sanitizado; reemplaza a `save_to_path` (sin auth) en escritorio; `allow-save-to-path` quitado del permiso default del plugin
- `change_password` disponible para empleados (no solo admin); `admin_change_password` valida longitud mínima
- Chat IA con auth + rate limit; `generate_purchase_suggestion` libera el lock durante el HTTP
- Argon2 fuera del lock de DB en login/creación de usuarios; lockout no se activa con usernames inexistentes
- XSS: `escapeHtml` escapa comillas simples; escapado `producto_nombre`/`cantidad` en detalle de deuda y `data-codigo` en inventario
- Backups: `wal_checkpoint(TRUNCATE)` antes de copiar la BD (no se pierden transacciones del `-wal`)

### Correctitud dinero / stock
- **Combos vendibles**: códigos `COMBO-N` se resuelven contra `combos`/`combo_productos` (precio real + descuento de stock de componentes no-inari). Migración que recrea `detalles_ventas` sin FK a `productos` y con `cantidad REAL`
- `void_sale` restaura stock una sola vez (solo ítems no anulados y no-inari) y restaura componentes de combos
- `void_sale_items` revierte la deuda a crédito al anular todos los ítems (incluye abonos previos → crédito a favor, saldo negativo)
- Cantidades fraccionarias (pesables) sin truncar a entero en anulaciones y sync
- Validación de `total_bs_ingresado`: no se puede subreportar el total en Bs.; pagar de más (vuelto) sí se acepta
- `validate_sale_request` rechaza cantidades negativas/cero/NaN por línea (una cantidad negativa AÑADÍA stock)
- Reportes y conteos por vendedor excluyen ventas anuladas; `get_saldo_caja` convierte movimientos solo-Bs. con la tasa; las pérdidas ya no se aplanan a 0
- `get_profit_series` sin fan-out (revenue en `ventas` puro + costo por subquery)
- Combos en el carrito con nombre/precio reales (antes mostraban $0)

### Sync / multi-dispositivo
- Timestamps `updated_at` en UTC ISO (migración 031): las comparaciones con watermark funcionan (antes filas naive nunca pasaban el filtro)
- Las anulaciones remotas se propagan (download actualiza ventas existentes, transición idempotente de stock)
- Upload incremental: solo lo modificado desde el último watermark, incluye tombstones (`activo=0`) de productos y clientes; categorías solo las cambiadas
- El watermark NO avanza si falla un UPDATE/INSERT (rollback de la transacción)
- No se re-descarga lo que subió este dispositivo (`dispositivo_origen` filtrado en descargas de productos/clientes/ventas)
- Clientes soft-delete (`activo`): el borrado viaja como tombstone y conserva las ventas
- Deudas con last-write-wins por fecha (no se sobrescriben); conflictos dentro de ventana de 5 min
- Auto-sync para vendedores (antes admin-only) con intervalo configurable (10 min por defecto) y toggle de activación
- Badge de pendientes de sync en el sidebar (`updated_at > watermark`)
- `upload_usuarios_inner` sube solo lo modificado y sin hashes Argon2
- El sync no mantiene la BD bloqueada durante las llamadas HTTP (transacciones cortas por etapa)
- `stock_minimo`/stock bumpan `updated_at` para viajar en el upload
- **Modal de descarga selectiva**: "Descargar todo" ahora muestra un preview con diff campo a campo, checkboxes por ítem, y checkbox "Forzar reemplazo" (el remoto siempre gana para corregir datos obsoletos)

### Android
- Botón "atrás" del sistema: cierra modales o retrocede en la navegación (stack propio), integrado con `MainActivity`
- Guardado en Descargas para Android <10 con permiso en runtime (`WRITE_EXTERNAL_STORAGE` solo hasta API 28)
- Teclado numérico (`inputmode="decimal"`/`numeric"`), `navigator.share` real para recibos con fallback a clipboard
- Safe-area/notch: edge-to-edge, bars transparentes, orientación portrait fija
- Firma sin credenciales hardcodeadas (lee `keystore.properties` o variables de entorno)

### Frontend / UX
- Dropdowns por fila (ventas del día, reporte, usuarios, cierres) y por sección (Caja, Créditos, Reportes); botón "Ver" restaurado en el reporte de ventas
- Dropdown items con icono alineado y toolbars uniformes
- Búsqueda global de clientes (Ctrl+K) arreglada: usaba un comando no registrado
- Modales protegidos (pago, producto, cliente, abono, combo, deuda rápida, ajuste de stock) piden confirmación antes de cerrarse con Escape o clic fuera
- Toggle de auto-sync en Configuración → Sincronización con badge de estado
- 3 glifos de Font Awesome añadidos al subset (image, chart_line, rotate_left, minus, user_plus)
- Snake ASCII (solo PC) accesible desde la Guía rápida

### Bugs
- `get_sales_by_vendor` contaba ventas anuladas; `get_daily_summary` listaba anuladas junto a totales que las excluyen
- PDF con acentos en mojibake (fuente WinAnsi escribía UTF-8): codificación Latin-1 correcta y `/Length` ajustado
- `register_movimiento` aceptaba montos negativos y autoría falsificable
- Combos no vendibles ("Producto no encontrado"); `es_inari` del request saltaba el control de stock
- Anulaciones remotas perdidas (INSERT OR IGNORE sin UPDATE); timestamps naive rotos
- Upload de productos sobrescribía a ciegas y no subía borrados
- Saldo de caja ignoraba movimientos solo en Bs.; ganancias negativas aplanadas a 0
- LWW asimétrico en productos (la remota vieja ganaba); clientes con timestamps inflados omitidos en el preview
- Límite de tiempo de Argon2 bajo el lock (DoS por latencia); lockout abusable con usernames inventados

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
