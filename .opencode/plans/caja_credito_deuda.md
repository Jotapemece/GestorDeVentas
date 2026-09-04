# Plan aprobado — Caja/crédito: deuda editable (admin) + crédito fuera de caja y gráficos

## Comportamiento actual (verificado)
- `get_saldo_caja` (cashier.rs:886) YA excluye `metodo_pago='credito'`. El saldo real es correcto.
- `get_daily_summary` → `SQL_SUM_VENTAS_RANGE` (cashier.rs:8) SÍ suma el crédito en la tarjeta "Ventas del día" (origen de la confusión).
- Abonos: ya suman en la caja (`pay_debt_inner` inserta `movimientos_caja` ingreso, clients.rs:389) pero NO aparecen en "Ventas del día".
- Gráficos (barras/pastel/línea) usan queries sin filtrar crédito → lo incluyen.
- Editar deuda NO existe; `update_cliente` (clients.rs:436) ya tiene `require_admin`.

## Decisiones del usuario
1. Abonos en "Ventas del día": **sección aparte "Abonos de hoy"**; tarjeta total = Cobrado + Abonos.
2. Excluir crédito de **todos** los gráficos de Reportes + tarjeta "Ventas" del dashboard.
3. Editar deuda: **monto nuevo directo + auditoría**, solo admin.

## Backend (Rust)

### cashier.rs
- `SQL_SUM_VENTAS_RANGE` (línea 8-10): añadir `AND metodo_pago != ?3` y pasar `constants::METODO_CREDITO`.
- `sumar_ventas_rango` (46-55): nuevo param `metodo_excluido: &str`; `params![start, end, metodo_excluido]`.
- Callers: `obtener_totales_del_dia` (106) y `period` en `get_dashboard_summary` (712) → pasar `constants::METODO_CREDITO`.
- `SQL_VENTAS_RANGE` (11-13): añadir `AND metodo_pago != ?3`.
- `compute_report_data_range` (156-164): `query_map(params![start, end, constants::METODO_CREDITO], ...)`.
- `get_profit_series` (748-757): añadir `AND v.metodo_pago != ?3` y `params![start, end, constants::METODO_CREDITO]`.
- `get_daily_summary` (213-241): tras construir `ventas`, consultar abonos de hoy:
  ```sql
  SELECT m.id, m.usuario_id, COALESCE(m.cliente_id,0), COALESCE(c.nombre,''),
         m.monto_usd, m.monto_bs, m.concepto, m.created_at
  FROM movimientos_caja m LEFT JOIN clientes c ON m.cliente_id = c.id
  WHERE m.tipo='ingreso' AND m.concepto LIKE 'Abono%'
    AND date(m.created_at) = date('now','localtime') ORDER BY m.id DESC
  ```
  Devolver `abonos: Vec<AbonoRow>`, `abonos_usd`, `abonos_bs` (sumas).

### models.rs
- `DailySummary` (154): añadir `pub abonos: Vec<AbonoRow>`, `pub abonos_usd: f64`, `pub abonos_bs: f64`.
- Nueva struct `AbonoRow { id, cliente_id, cliente_nombre, monto_usd, monto_bs, metodo_pago, concepto, fecha_hora }`.

### migrations.rs
- Nueva migración `042_add_movimientos_cliente_id`: `ALTER TABLE movimientos_caja ADD COLUMN cliente_id INTEGER;` (idempotente con `column_exists`).
- Registrar en el array `MIGRATIONS` (línea 135-136).

### clients.rs
- `pay_debt_inner` (389-394): insertar con `cliente_id` (nueva constante `SQL_INSERT_ABONO_MOVIMIENTO` con 7 columnas incl. `cliente_id`); pasar `request.cliente_id`.
- `update_cliente` (436): nuevo param `saldo_deuda_usd: Option<f64>`. Si `Some(v)`: validar finito y `>=0`, leer deuda actual, añadir al SET y auditar `"Editó deuda cliente #X: $old → $new"`. Ya es admin-only (`require_admin`).

## Frontend (JS)

### index.html
- En `#cliente-modal` (1431): añadir
  `<div class="form-group admin-only"><label>Deuda actual ($)</label><input type="number" id="client-deuda-usd" step="0.01" min="0"></div>`.

### constants.js
- Añadir `clientDeudaUsd: '#client-deuda-usd'`.

### clients-view.js
- `openCreditoModal` (54): si `currentUser.rol === ROL_ADMIN`, poblar `qs(SEL.clientDeudaUsd).value = cliente ? cliente.saldo_deuda_usd : 0`. (`applyRoleUI` ya oculta `.admin-only` para no-admins.)
- `saveClient` (77-101): si admin, leer valor y enviar `saldo_deuda_usd: Number(...) || 0` a `update_cliente` (si no admin, enviar `null`).

### cashier-view.js
- `loadDailySummary` (~1361): la tarjeta usa `summary.total_usd` (ahora solo cobrado). Renderizar sub-sección **"Abonos de hoy"** con `summary.abonos` (filas: hora · cliente · concepto/método · monto) y mostrar total de abonos. Las ventas a crédito siguen listadas en la tabla pero fuera del total.

## Verificación
- `cd src-tauri && cargo test --lib` (tests nuevos: `sumar_ventas_rango` excluye crédito; `get_dashboard_payment_methods` sin porción crédito; `get_profit_series` excluye crédito; `update_cliente` setea deuda + audita; abono aparece en `get_daily_summary`).
- `cargo check`.
- `node --check src/*.js && node scripts/minify.mjs`.
- Prueba móvil: vender a crédito → no sube "Ventas del día"; abonar → aparece en "Abonos de hoy" y suma en Saldo Caja; pastel/barras/ganancias sin crédito; admin edita deuda y queda en auditoría.
