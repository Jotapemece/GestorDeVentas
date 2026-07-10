# InariMarket — POS de Escritorio

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

La primera vez crea `gestor_ventas.db` en la raíz del proyecto. Si existe un `productos` (TSV) al lado, lo importa automáticamente (312 items).

Usuarios por defecto:

| Usuario   | Contraseña | Rol      |
|-----------|-----------|----------|
| `admin`   | `admin`   | admin    |
| `jota`    | `1234`    | admin    |
| `vendedor`| `1234`    | vendedor |

---

## Build para Windows (x86_64)

```bash
rustup target add x86_64-pc-windows-msvc
cargo tauri build --target x86_64-pc-windows-msvc
```

Para 32 bits (requiere WebView2 en 32 bits):
```bash
rustup target add i686-pc-windows-msvc
cargo tauri build --target i686-pc-windows-msvc
```

---

## Arquitectura

```
gestor_ventas/
├── src/                    # Frontend (HTML/CSS/JS)
│   ├── index.html          # Todas las vistas y modales
│   ├── app.js              # Lógica del frontend
│   ├── style.css           # Estilos (7 temas, responsive)
│   ├── fa-local.css        # Mapeo de iconos Font Awesome local
│   └── fonts/              # Archivos de iconos (woff2)
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         # Punto de entrada
│   │   ├── lib.rs          # Builder Tauri + registro de comandos
│   │   ├── db.rs           # Inicialización SQLite, migraciones
│   │   ├── models.rs       # Structs compartidos
│   │   ├── auth.rs         # Login/logout, gestión de usuarios
│   │   ├── products.rs     # CRUD productos, importar/exportar XLSX
│   │   ├── sales.rs        # Ventas transaccionales, detalle, tasa
│   │   ├── clients.rs      # CRUD clientes, historial, pagos
│   │   ├── cashier.rs      # Apertura/cierre de caja, resumen diario
│   │   ├── categorias.rs   # CRUD categorías
│   │   ├── audit.rs        # Historial de acciones con paginación
│   │   └── config.rs       # Configuración clave-valor
│   ├── capabilities/       # Permisos Tauri v2
│   └── Cargo.toml
├── package.json
├── productos               # Archivo de importación (TSV)
└── gestor_ventas.db        # Base de datos SQLite (auto-creada)
```

### Tecnologías

| Capa         | Tecnología                        |
|-------------|-----------------------------------|
| Shell       | Tauri v2 (Rust)                  |
| Frontend    | HTML5, CSS3, JavaScript (ES6+)   |
| Backend     | Rust con rusqlite (bundled)      |
| BD          | SQLite (fichero local, WAL mode) |
| Iconos      | Font Awesome 6 Free (local)      |
| XLSX        | rust_xlsxwriter (exportaciones)  |
| Sonido      | Web Audio API (osciladores)      |

---

## Base de Datos

Archivo: `gestor_ventas.db` (raíz del proyecto o junto al ejecutable).

### Tablas

| Tabla | Columnas clave |
|-------|---------------|
| `productos` | codigo (PK auto), nombre, precio_usd, stock, categoria_id |
| `categorias` | id, nombre, color |
| `clientes` | id, nombre, credito_activo, saldo_deuda_usd |
| `ventas` | id, fecha_hora, usuario_id, metodo_pago, referencia_pago_movil, pago_detalle, cliente_id, total_usd, tasa_aplicada |
| `detalles_ventas` | id, venta_id, producto_codigo, cantidad, precio_usd_unitario |
| `usuarios` | id, username, password (SHA-256), rol |
| `configuracion` | clave (PK), valor |
| `historial_acciones` | id, fecha_hora, usuario, accion |
| `cierres_caja` / `cierres_detalle` | id, fecha_hora, usuario_id, total_ventas, total_usd, detalle_json |

---

## Módulos

### 1. Ventas
- Búsqueda con filtro por categoría. Nombres subrayados con color de categoría.
- Carrito con cantidades editables, totales USD y Bs.
- Cobro: Efectivo (Bs./$), Pago Móvil (con referencia de 4 dígitos), Biopago, Punto, Crédito, Mixto.
- Tasa del día: alarma si no se ha actualizado hoy. Cualquier usuario puede cambiarla.
- Recibo imprimible tras cobrar.

### 2. Inventario
- Tabla con nombre, categoría (badge de color), precios, stock.
- Búsqueda con debounce + filtro por categoría.
- Menú ⋮ por fila (Detalles, Editar) con detección de desbordamiento.
- Modal de edición sin código (se auto-genera).
- Importar desde TSV con reporte de errores por línea.
- Exportar a XLSX.

### 3. Crédito
- Clientes con deuda en USD.
- Historial completo por cliente (1 consulta SQL).
- Abono con método de pago y referencia.

### 4. Caja
- Apertura/cierre de jornada.
- Resumen diario con referencias de Pago Móvil.
- Reporte de cierre con desglose por método, productos vendidos y clientes a crédito.
- Exportar PDF del cierre.
- Historial de cierres anteriores.

### 5. Historial
- Auditoría cronológica con paginación (50 por página).
- Limpieza automática configurable (1-365 días, desde Config).

### 6. Configuración
- **7 temas**: Oscuro, Claro, Azul, Verde, Morado, Turquesa, Naranja.
- Tamaño de fuente (rem).
- Pantalla completa.
- Sonidos con volumen.
- Categorías (admin-only): crear, renombrar color, eliminar.
- Limpieza automática del historial.

---

## Roles y Permisos

| Acción | Admin | Vendedor |
|--------|-------|----------|
| Vender / Cobrar | ✓ | ✓ |
| Ver inventario | ✓ | ✓ |
| Ver crédito | ✓ | ✓ |
| Exportar XLSX | ✓ | ✓ |
| Abrir/cerrar caja | ✓ | ✓ |
| Cambiar tasa | ✓ | ✓ |
| Cambiar tema/sonido/fuente | ✓ | ✓ |
| Crear/editar/eliminar productos | ✓ | ✗ |
| Importar productos | ✓ | ✗ |
| Gestionar categorías | ✓ | ✗ |
| Gestionar clientes | ✓ | ✗ |
| Crear usuarios | ✓ | ✗ |
| Config (todo) | ✓ | ✗ |

---

## Comandos Tauri

### Productos
| Comando | Args | Retorna |
|---------|------|---------|
| `list_products` | `search?, categoria_id?` | `Producto[]` |
| `create_product` | `codigo, nombre, precioUsd, stock, categoriaId?` | mensaje |
| `update_product` | `codigo, nombre, precioUsd, stock, categoriaId?` | mensaje |
| `delete_product` | `codigo` | mensaje |
| `export_products_xlsx` | `tasa` | ruta archivo |
| `import_products_from_file` | `filePath` | mensaje |

### Categorías
| Comando | Args | Retorna |
|---------|------|---------|
| `list_categorias` | — | `Categoria[]` |
| `create_categoria` | `nombre, color` | mensaje |
| `update_categoria` | `id, nombre, color` | mensaje |
| `delete_categoria` | `id` | mensaje |

### Ventas
| Comando | Args | Retorna |
|---------|------|---------|
| `create_sale` | `request` | `Venta` |
| `list_sales` | `limit?` | `Venta[]` |
| `get_sale_detail` | `ventaId` | `DetalleVenta[]` |
| `get_tasa` | — | `f64` |
| `set_tasa` | `tasa` | — |

### Clientes
| Comando | Args | Retorna |
|---------|------|---------|
| `list_clientes` | — | `Cliente[]` |
| `create_cliente` | `nombre` | mensaje |
| `toggle_cliente_credito` | `clienteId, activo` | mensaje |
| `get_cliente_history` | `clienteId` | `ClienteHistory` |
| `pay_debt` | `request` | mensaje |

### Caja
| Comando | Args | Retorna |
|---------|------|---------|
| `get_daily_summary` | — | `DailySummary` |
| `abrir_caja` | — | mensaje |
| `close_cashier` | — | `CloseReport` |
| `get_close_report_data` | — | `CloseReportData` |
| `get_caja_abierta` | — | `bool` |
| `list_cierres` | — | `CierreListItem[]` |
| `get_cierre_detalle` | `cierreId` | `CierreDetalle` |

### Auth / Config / Audit
| Comando | Args | Retorna |
|---------|------|---------|
| `login` | `username, password` | `LoginResponse` |
| `logout` | — | `bool` |
| `get_current_user` | — | `Option<Usuario>` |
| `create_usuario` | `username, password, rol` | mensaje |
| `list_usuarios` | — | `Usuario[]` |
| `get_audit_logs` | `limit?, offset?` | `HistorialAccion[]` |
| `get_config_value` | `key` | valor |
| `set_config_value` | `key, value` | — |
| `list_theme_names` | — | `String[]` (7 temas) |

> Los parámetros individuales se pasan en **camelCase** desde JS (`precioUsd`, `categoriaId`). Los structs (`request`) usan snake_case por defecto de serde.

---

## Atajos de Teclado

| Tecla     | Acción                          |
|-----------|--------------------------------|
| `F1`-`F6`| Navegar entre vistas           |
| `F8`     | Enfocar búsqueda               |
| `F12`    | Cobrar (si hay items)          |
| `Esc`    | Cerrar modal                   |
| `Ctrl+N` | Nuevo producto (Inventario)    |

---

## Funcionalidades Implementadas

### UX
- 7 temas de color con inline-CSS vars sin fugas
- Login con "Recordar usuario"
- InariMarket branding + animaciones sutiles
- Toast con sonidos configurables
- Atajos de teclado F1-F12
- Filtro por categoría en ventas e inventario
- Dropdown posicionado con `position: fixed` (no se corta)
- Alarma de tasa no actualizada al login

### Técnica
- Caché de productos en frontend (búsqueda instantánea)
- Paginación nativa SQL (OFFSET)
- Transacciones SQL en ventas
- Sin deadlocks (lock ordering)
- Auto-import de productos al iniciar con BD vacía
- Migraciones automáticas (columnas nuevas, CHECK constraints)
- Limpieza programada del historial
- DB ubicada fuera de `target/` para no perderse al rebuild

### Seguridad
- Roles: admin/vendedor con verificación en cada comando
- UI oculta elementos `.admin-only` según el rol
- Contraseñas hasheadas con SHA-256
- CSP configurada

---

## Mejoras Propuestas

1. Devoluciones / notas de crédito
2. Reportes avanzados por período/producto/vendedor
3. Escáner de código de barras
4. Múltiples precios (por mayor, presentación)
5. Notificaciones de stock bajo
6. Backup automático de BD
7. Sincronización multidispositivo
8. Pruebas automatizadas (Rust + e2e)
9. Logs estructurados
10. i18n
11. Actualización automática (tauri-plugin-updater)
12. Multi-sucursal

---

## Licencia

Uso interno.
