# Gestor de Ventas — POS de Escritorio

Sistema de punto de venta (POS) 100% offline construido con **Tauri v2**, **Rust** + **SQLite** en backend y **HTML/CSS/JS vanilla** en frontend.

---

## Requisitos del Sistema

- **Node.js** 18+
- **Rust** stable (edition 2021)
- **Dependencias del sistema** (Linux):
  ```bash
  sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev patchelf libglib2.0-dev libssl-dev
  ```

---

## Inicio Rápido

```bash
cd gestor_ventas
npm install
npm run dev
```

> La primera vez que se ejecuta, la app crea `gestor_ventas.db` en el mismo directorio del ejecutable. Usuarios por defecto: `admin`/`admin` y `jota`/`1234`.

Para poblar el inventario con datos de prueba:
```bash
# Copia el archivo 'productos' junto al ejecutable, luego:
# Ve a Inventario → Importar
```

---

## Arquitectura

```
gestor_ventas/
├── src/                    # Frontend (HTML/CSS/JS)
│   ├── index.html          # Todas las vistas y modales
│   ├── app.js              # Lógica del frontend (~930 líneas)
│   ├── style.css           # Estilos (6 temas pastel, responsive)
│   ├── fa-local.css        # Mapeo de iconos Font Awesome local
│   └── fonts/              # Archivos de iconos (woff2, ttf)
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         # Punto de entrada
│   │   ├── lib.rs          # Builder Tauri + registro de comandos
│   │   ├── db.rs           # Inicialización SQLite, migraciones, índices
│   │   ├── models.rs       # Structs compartidos (Producto, Venta, Cliente...)
│   │   ├── auth.rs         # Login/logout, gestión de usuarios
│   │   ├── products.rs     # CRUD productos, importar/exportar XLSX
│   │   ├── sales.rs        # Ventas transaccionales, detalle, tasa
│   │   ├── clients.rs      # CRUD clientes, historial optimizado, pagos
│   │   ├── cashier.rs      # Apertura/cierre de caja, resumen diario
│   │   ├── audit.rs        # Historial de acciones con paginación SQL
│   │   └── config.rs       # Configuración clave-valor (tema, sonido, etc.)
│   ├── capabilities/       # Permisos Tauri v2
│   └── Cargo.toml
├── package.json            # Scripts npm (dev, build)
└── productos               # Archivo de importación (312 items, TSV)
```

### Tecnologías

| Capa         | Tecnología                        |
|-------------|-----------------------------------|
| Shell       | Tauri v2 (Rust)                  |
| Frontend    | HTML5, CSS3, JavaScript (ES6+)   |
| Backend     | Rust con rusqlite (bundled)      |
| BD          | SQLite (fichero local, WAL mode) |
| Iconos      | Font Awesome 6 Free (local, offline) |
| XLSX        | rust_xlsxwriter (exportaciones)  |
| Sonido      | Web Audio API (osciladores)      |

---

## Módulos

### 1. Ventas (`view-sales`)
- Búsqueda instantánea de productos desde **caché en frontend** (sin invocar Rust en cada tecla)
- Carrito con cantidades editables, totales en USD y Bs.
- Cobro con métodos: Efectivo, Pago Móvil, Punto, Biopago, Crédito
- Clientes con crédito: la venta se registra como deuda
- Cancelación de venta, ocultación automática del carrito vacío
- Tasa del día editable, recalcula precios en Bs. en tiempo real
- Botón **Imprimir Recibo** tras cobrar (genera HTML en iframe oculto)

### 2. Inventario (`view-inventory`)
- Lista completa de productos con precios (USD + Bs.)
- Búsqueda con debounce de 250ms
- Menú de acciones por fila (⋮): Detalles, Editar
- Modal de detalle con información de auditoría (creado en)
- Modal de edición (nombre, precio, stock)
- Crear nuevo producto
- Importar desde archivo TSV con **reporte detallado de errores** por línea
- Exportar a Excel (.xlsx)

### 3. Crédito (`view-creditos`)
- Lista de clientes con deuda actual (USD)
- Modal "Ver Detalles": historial completo de ventas a crédito con desglose de productos (cargado con **1 sola consulta SQL**)
- Modal "Abonar / Pagar": formulario con monto, método de pago, saldo restante en tiempo real
- Actualiza saldo deudor en SQLite, registra en auditoría

### 4. Caja (`view-cashier`)
- Apertura y cierre de jornada
- Resumen diario: total de ventas, USD, Bs., tasa aplicada
- Reporte de cierre con desglose

### 5. Historial (`view-audit`)
- Registro cronológico de todas las acciones en el sistema
- **Paginación** con botón "Cargar más" (50 registros por página, OFFSET nativo SQL)

### 6. Configuración (`view-config`)
- **6 temas de color**: Pastel, Oscuro, Claro, Azul, Verde, Morado
- **Pantalla completa** (Fullscreen API)
- **Sonidos** con volumen ajustable (Web Audio API, 5 tipos: add, remove, success, error, cancel)
- Información del sistema

---

## Base de Datos

Archivo: `gestor_ventas.db` (junto al ejecutable), modo WAL.

### Tablas
| Tabla | Columnas clave |
|-------|----------------|
| `productos` | código (PK), nombre, precio_usd, stock, **stock_minimo**, created_at |
| `clientes` | id (PK), nombre, credito_activo, saldo_deuda_usd |
| `ventas` | id, fecha_hora, usuario_id, método_pago, referencia, cliente_id, total_usd, tasa_aplicada |
| `detalles_ventas` | id, venta_id (FK), producto_código (FK), cantidad, precio_usd_unitario |
| `usuarios` | id, username (UNIQUE), password (SHA-256), rol |
| `configuracion` | clave (PK), valor |
| `historial_acciones` | id, fecha_hora, usuario, accion |
| `cierres_caja` | id, fecha_hora, usuario_id, total_ventas, total_usd |

### Índices
- `idx_ventas_fecha` ON ventas(fecha_hora)
- `idx_ventas_cliente` ON ventas(cliente_id)
- `idx_detalles_venta` ON detalles_ventas(venta_id)
- `idx_historial_fecha` ON historial_acciones(fecha_hora)

### Seguridad
- Transacciones SQL en todas las operaciones de escritura múltiple (ventas)
- Lock ordering: `current_user` siempre se extrae **antes** de adquirir `db` (sin deadlocks)

---

## Comandos Tauri (Backend)

### Productos
| Comando | Args | Retorna |
|---------|------|---------|
| `list_products` | `search?: string` | `Producto[]` |
| `create_product` | `codigo, nombre, precio_usd, stock` | mensaje |
| `update_product` | `codigo, nombre, precio_usd, stock` | mensaje |
| `delete_product` | `codigo` | mensaje |
| `export_products_xlsx` | `tasa` | ruta del archivo |
| `import_products_from_file` | `filePath` | mensaje (con detalle de errores) |

### Ventas
| Comando | Args | Retorna |
|---------|------|---------|
| `create_sale` | `request: CreateSaleRequest` | `Venta` |
| `list_sales` | `limit?: i64` | `Venta[]` |
| `get_sale_detail` | `venta_id` | `DetalleVenta[]` |
| `get_tasa` | — | `f64` |
| `set_tasa` | `tasa` | — |

### Clientes / Crédito
| Comando | Args | Retorna |
|---------|------|---------|
| `list_clientes` | — | `Cliente[]` |
| `create_cliente` | `nombre` | mensaje |
| `toggle_cliente_credito` | `cliente_id, activo` | mensaje |
| `get_cliente_history` | `clienteId` | `ClienteHistory` |
| `pay_debt` | `request: PayDebtRequest` | mensaje |

### Caja
| Comando | Args | Retorna |
|---------|------|---------|
| `get_daily_summary` | — | `DailySummary` |
| `abrir_caja` | — | mensaje |
| `close_cashier` | — | `CloseReport` |
| `get_caja_abierta` | — | `bool` |

### Auth / Config / Audit
| Comando | Args | Retorna |
|---------|------|---------|
| `login` | `username, password` | `LoginResponse` |
| `logout` | — | `bool` |
| `get_current_user` | — | `Option<Usuario>` |
| `create_usuario` | `username, password, rol` | mensaje |
| `list_usuarios` | — | `Usuario[]` |
| `get_audit_logs` | `limit?: i64, offset?: i64` | `HistorialAccion[]` |
| `get_cierres` | `limit?: i64` | `HistorialAccion[]` |
| `get_config_value` | `key` | valor |
| `set_config_value` | `key, value` | — |
| `list_theme_names` | — | `String[]` (6 temas) |

---

## Atajos de Teclado

| Tecla     | Acción                          |
|-----------|--------------------------------|
| `F1`      | Abrir vista de Ventas           |
| `F2`      | Abrir vista de Inventario       |
| `F3`      | Abrir vista de Crédito          |
| `F4`      | Abrir vista de Caja              |
| `F5`      | Abrir vista de Historial         |
| `F6`      | Abrir vista de Configuración     |
| `F8`      | Enfocar campo de búsqueda        |
| `F12`     | Abrir modal de cobro (si hay items en carrito) |
| `Esc`     | Cerrar cualquier modal abierto  |
| `Ctrl+N`  | Nuevo producto (en vista Inventario) |

---

## Funcionalidades Implementadas

### UX
- **6 temas de color** (Pastel, Oscuro, Claro, Azul, Verde, Morado)
- **Pantalla completa** toggle desde configuración
- **Sonidos** configurables (5 tipos, con control de volumen)
- **Animaciones sutiles** (fadeIn en modales, slideIn en toast)
- **Atajos de teclado** (F1-F6, F8, F12, Esc, Ctrl+N)
- **Documentación de atajos** en README.md
- **Pantalla de login** con "Recordar usuario" (localStorage)
- **Impresión de recibos** tras cobrar (HTML + iframe print)

### Rendimiento / Técnica
- **Caché de productos en frontend** (búsqueda instantánea sin invocar Rust)
- **Paginación en historial** (50 registros por lote, OFFSET nativo SQL)
- **Debounce** en búsquedas de inventario y ventas
- **Transacciones SQL** en creación de ventas
- **Consulta única** para historial de cliente ( JOIN vs O(n) queries)
- **Índices SQL** en tablas más consultadas
- **AudioContext global** reutilizable (no crear N contextos)
- **CSP configurada** (Content-Security-Policy)
- **Sin warnings clippy** (0 warnings)

### Calidad
- **Sin deadlocks**: lock ordering `current_user` → `db`
- **Importación con reporte detallado** de errores por línea
- **TOAST con white-space: pre-line** para mensajes multilínea
- **0 issues de auditoría** (27 hallazgos corregidos)

---

## Mejoras Propuestas (no implementadas)

### Funcionales
1. **Devoluciones / notas de crédito** — Revertir ventas, devolver stock
2. **Reportes avanzados** — Ventas por período, producto, vendedor con gráficos
3. **Escáner de código de barras** — Entrada rápida vía teclado
4. **Múltiples precios** — Por mayor, por presentación
5. **Notificaciones de stock bajo** — Alerta visual al iniciar sesión
6. **Backup automático de BD** — Copia al iniciar la app
7. **Sincronización multidispositivo** — Exportación/importación o servidor embebido

### UX
8. **Personalización de columnas** — Ocultar/mostrar columnas en tablas

### Técnicas
9. **Pruebas automatizadas** — Tests unitarios Rust + e2e JS
10. **Logs estructurados** — Sistema de logging con niveles
11. **Internacionalización (i18n)** — Archivos JSON de traducción
12. **Actualización automática** — tauri-plugin-updater
13. **Compilación cross-platform** — CI/CD para Windows, macOS, Linux
14. **Modo multi-sucursal** — sucursal_id en tablas principales

---

## Licencia

Uso interno.
