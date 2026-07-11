# Decisiones Técnicas (Architecture Decision Records)

Este documento registra las decisiones técnicas importantes tomadas durante el desarrollo del POS InariMarket.

---

## ADR-001: Hashing de contraseñas con SHA-256

**Fecha:** 2024  
**Estado:** Aceptado  
**Autores:** Equipo de desarrollo

### Contexto
El sistema requiere autenticación de usuarios (admin y vendedor). Necesitamos almacenar contraseñas de forma segura sin depender de librerías externas complejas, manteniendo la filosofía 100% offline.

### Alternativas consideradas
1. **bcrypt/scrypt/argon2**: Más seguros pero requieren dependencias adicionales (crates externos)
2. **SHA-256 simple**: Implementable con crate `sha2` ya incluido
3. **Sin hashing**: Descartado por seguridad básica

### Decisión
Usar **SHA-256** para hashear contraseñas antes de almacenarlas en SQLite.

### Justificación
- El crate `sha2` ya es dependencia del proyecto (usado por otros componentes)
- Suficiente para un POS offline de pequeño/mediano comercio
- No requiere configuración adicional ni parámetros de salt/pepper complejos
- Mantiene la filosofía "sin dependencias externas de red"

### Consecuencias
- ✅ Sin dependencias adicionales
- ✅ Implementación simple (~5 líneas de código)
- ⚠️ Menos resistente a ataques de fuerza bruta que bcrypt (mitigado por ser app offline)
- ⚠️ Sin salt incorporado (el username actúa como identificador único)

**Implementación:** `src-tauri/src/auth.rs::hash_password()`

---

## ADR-002: Soft Delete para productos con historial de ventas

**Fecha:** 2024  
**Estado:** Aceptado  
**Autores:** Equipo de desarrollo

### Contexto
Los productos pueden ser eliminados por el administrador, pero algunos ya tienen ventas registradas. Eliminarlos físicamente rompería la integridad referencial y perderíamos información histórica.

### Alternativas consideradas
1. **Hard delete siempre**: Simple pero pierde integridad histórica
2. **Soft delete con flag `activo`**: Mantiene datos pero requiere lógica adicional
3. **Cascade delete**: Elimina ventas asociadas (inaceptable, pierde historial)

### Decisión
Implementar **soft delete** usando columna `activo INTEGER DEFAULT 1`:
- Si el producto tiene ventas: solo se desactiva (`activo = 0`) y stock se pone a 0
- Si no tiene ventas: se elimina físicamente
- Las consultas de productos activos filtran `WHERE activo = 1`

### Justificación
- Preserva integridad referencial de ventas históricas
- Permite reactivar productos accidentalmente desactivados
- Los reportes históricos siguen funcionando correctamente
- El stock se pone a 0 para evitar ventas futuras de productos desactivados

### Consecuencias
- ✅ Integridad de datos preservada
- ✅ Posibilidad de reactivación
- ⚠️ Tabla `productos` crece indefinidamente (mitigar con limpieza periódica si es necesario)
- ⚠️ Queries deben incluir `WHERE activo = 1` (ya implementado en `SQL_BASE_PRODUCTOS`)

**Implementación:** `src-tauri/src/products.rs::delete_product()`

---

## ADR-003: 7 temas predefinidos vía CSS Custom Properties

**Fecha:** 2024  
**Estado:** Aceptado  
**Autores:** Equipo de desarrollo

### Contexto
El sistema debe soportar personalización de apariencia sin complicar el código frontend. Se busca una solución performante que no requiera JavaScript para aplicar colores.

### Alternativas consideradas
1. **Temas con JS inyectando estilos**: Flexible pero más lento y complejo
2. **Múltiples archivos CSS**: Difícil mantenimiento
3. **CSS Custom Properties con data-attributes**: Limpio, performante, nativo

### Decisión
Implementar **7 temas** usando CSS Custom Properties (`--variable`) activados por atributo `data-theme` en `<html>`:
- Temas: oscuro, claro, azul, verde, morado, turquesa, naranja
- JS solo cambia `document.documentElement.dataset.theme`
- Todo el CSS usa `var(--nombre-variable)` para colores

### Justificación
- Cero overhead de JS para renderizado de colores
- Cambios de tema instantáneos (solo cambia atributo)
- Fácil agregar nuevos temas (copiar bloque de variables)
- Mantenible: todos los colores están en :root y selectores `[data-theme]`

### Consecuencias
- ✅ Performance óptima (CSS nativo)
- ✅ Fácil mantenimiento
- ✅ Sin dependencias JS para temas
- ⚠️ Los 7 temas están hardcodeados en CSS (documentado en `constants.rs` para sync)

**Implementación:** `src/style.css` (selectores `[data-theme="..."]`), `src/app.js::loadThemeConfig()`

---

## ADR-004: SQLite WAL Mode + Foreign Keys ON

**Fecha:** 2024  
**Estado:** Aceptado  
**Autores:** Equipo de desarrollo

### Contexto
La base de datos SQLite debe soportar concurrencia básica (lecturas mientras se escriben ventas) y mantener integridad referencial entre tablas relacionadas.

### Alternativas consideradas
1. **DELETE journal mode**: Default de SQLite, bloquea lecturas durante escrituras
2. **WAL (Write-Ahead Logging)**: Permite lecturas concurrentes, más rápido
3. **MEMORY**: Rápido pero pierde datos al cerrar

### Decisión
Usar **WAL mode** + **Foreign Keys ON**:
- `PRAGMA journal_mode=WAL`
- `PRAGMA foreign_keys=ON`
- Archivo DB en raíz del proyecto (`gestor_ventas.db`)

### Justificación
- WAL permite lecturas mientras se procesan ventas (mejor UX)
- Foreign keys previenen datos huérfanos (ej: detalles_ventas sin venta padre)
- WAL crea archivos `-wal` y `-shm` temporales que mejoran performance
- Compatible con backups simples (copiar archivo .db)

### Consecuencias
- ✅ Mejor concurrencia y performance
- ✅ Integridad referencial garantizada
- ⚠️ Archivos adicionales (-wal, -shm) que deben manejarse en backups
- ⚠️ No compatible con sistemas de archivos que no soporten shared memory

**Implementación:** `src-tauri/src/db.rs::init_db()` (líneas 45-46)

---

## ADR-005: Arquitectura modular por dominio en Rust

**Fecha:** 2024  
**Estado:** Aceptado  
**Autores:** Equipo de desarrollo

### Contexto
El backend Rust debe ser mantenible y escalable. Mezclar toda la lógica en un solo archivo dificultaría el crecimiento del proyecto.

### Alternativas consideradas
1. **Todo en lib.rs**: Simple pero inmantenible
2. **Módulos por tipo de operación**: CRUD vs queries (confuso)
3. **Módulos por dominio de negocio**: products, sales, clients, etc.

### Decisión
Organizar módulos por **dominio de negocio**:
- `products.rs`: CRUD productos, import/export
- `sales.rs`: Creación de ventas, validaciones, tasa
- `clients.rs`: Gestión clientes, crédito, abonos
- `cashier.rs`: Apertura/cierre caja, reportes diarios
- `categorias.rs`: Gestión categorías
- `audit.rs`: Historial de acciones
- `auth.rs`: Login, logout, roles
- `config.rs`: Configuración clave-valor
- `db.rs`: Inicialización BD, migraciones
- `models.rs`: Structs serde compartidos
- `constants.rs`: Constantes globales

### Justificación
- Cada módulo tiene responsabilidad única (SRP)
- Fácil encontrar código relacionado con una entidad
- Bajo acoplamiento entre módulos (comunicación vía AppState)
- Escalable: nuevo dominio = nuevo archivo

### Consecuencias
- ✅ Alta cohesión, bajo acoplamiento
- ✅ Fácil onboarding de nuevos desarrolladores
- ✅ Tests unitarios por módulo
- ⚠️ Requiere disciplina para no mezclar dominios

**Implementación:** Estructura de directorios `src-tauri/src/*.rs`

---

## ADR-006: Frontend vanilla JS sin frameworks

**Fecha:** 2024  
**Estado:** Aceptado  
**Autores:** Equipo de desarrollo

### Contexto
El frontend debe ser ligero, rápido y 100% offline. No se requiere la complejidad de un framework moderno para una app de una sola pantalla con modales.

### Alternativas consideradas
1. **React/Vue/Svelte**: Overkill para esta app, requiere build step
2. **jQuery**: Obsoleto, agrega peso innecesario
3. **Vanilla JS moderno (ES6+)**: Nativo, sin dependencias, suficiente

### Decisión
Usar **JavaScript vanilla ES6+** con:
- Arrow functions, template literals, async/await
- Funciones utilitarias propias (`qs`, `qsa`, `showToast`)
- Objeto `SEL` para centralizar selectores DOM
- Web Audio API para sonidos (sin archivos externos)
- Invocaciones a Rust vía `window.__TAURI__.core.invoke()`

### Justificación
- Cero dependencias externas (ni siquiera npm para el frontend)
- Sin build step (no hay webpack, vite, etc.)
- Performance máxima (sin virtual DOM ni overhead)
- Fácil debuggear (código directo en navegador)

### Consecuencias
- ✅ Bundle size mínimo
- ✅ Sin vulnerabilidades de dependencias
- ✅ Sin pasos de build
- ⚠️ Más código boilerplate que con un framework
- ⚠️ Requiere disciplina para mantener organización

**Implementación:** `src/app.js`, `src/index.html`

---

## ADR-007: Font Awesome 6 Free local sin CDN

**Fecha:** 2024  
**Estado:** Aceptado  
**Autores:** Equipo de desarrollo

### Contexto
La app debe funcionar 100% offline. No se puede depender de CDNs externos para iconos.

### Alternativas consideradas
1. **CDN Font Awesome**: Viola restricción offline
2. **SVG inline**: Aumenta tamaño HTML, difícil mantener
3. **Font Awesome local con mapeo custom**: Offline, ligero

### Decisión
Usar **Font Awesome 6 Free local** con mapeo custom via CSS:
- Fonts en `src/fonts/` (woff2 + ttf)
- Mapeo en `src/fa-local.css`: clase `.nf-fa-NOMBRE` → unicode correspondiente
- Uso en HTML: `<i class="nf nf-fa-shopping_cart"></i>`

### Justificación
- 100% offline, sin requests externos
- Iconos consistentes en toda la app
- Fácil agregar nuevos iconos (solo editar fa-local.css)
- Tamaño controlado (solo iconos usados)

### Consecuencias
- ✅ Offline completo
- ✅ Sin latencia de red
- ⚠️ Requiere mantener mapeo manual de iconos
- ⚠️ No se pueden usar iconos nuevos sin descargar font file

**Implementación:** `src/fa-local.css`, `src/fonts/`

---

## ADR-008: Tasa del día actualizable por cualquier usuario

**Fecha:** 2024  
**Estado:** Aceptado  
**Autores:** Equipo de desarrollo

### Contexto
En economías inflacionarias, la tasa de cambio USD/BS cambia frecuentemente. Restringir actualización solo a admins causaría cuellos de botella operativos.

### Alternativas consideradas
1. **Solo admin puede actualizar tasa**: Seguro pero poco práctico
2. **Cualquier usuario puede actualizar**: Ágil pero riesgo de errores
3. **Tasa automática vía API**: Viola restricción offline

### Decisión
**Cualquier usuario autenticado** puede actualizar la tasa:
- Input visible en vista Ventas
- Al cambiar, se guarda en `configuracion` clave `tasa_dolar` + `tasa_updated_at`
- Alerta visual si tasa no se actualizó hoy
- La tasa se aplica a todas las ventas del día

### Justificación
- Operatividad ágil en entorno comercial real
- Responsabilidad compartida del equipo
- Auditoría de quién cambió la tasa (en historial si se agrega log)
- Alerta previene olvido de actualización

### Consecuencias
- ✅ Flexibilidad operativa
- ✅ Sin bloqueos por falta de admin
- ⚠️ Riesgo de error humano (mitigar con capacitación)
- ⚠️ No hay historial de cambios de tasa (podría agregarse)

**Implementación:** `src-tauri/src/sales.rs::set_tasa()`, `src/app.js::handleTasaChange()`

---

## Resumen de decisiones

| ADR   | Tema                          | Estado    | Impacto      |
|-------|-------------------------------|-----------|--------------|
| 001   | Hashing SHA-256               | Aceptado  | Seguridad    |
| 002   | Soft Delete productos         | Aceptado  | Datos        |
| 003   | 7 temas CSS                   | Aceptado  | UI/UX        |
| 004   | SQLite WAL + FK               | Aceptado  | Performance  |
| 005   | Módulos por dominio           | Aceptado  | Arquitectura |
| 006   | Vanilla JS                    | Aceptado  | Frontend     |
| 007   | Font Awesome local            | Aceptado  | Offline      |
| 008   | Tasa actualizable             | Aceptado  | Operación    |

---

*Última actualización: 2024*
