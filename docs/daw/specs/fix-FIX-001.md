# Fix-plan FIX-001: Pendientes de FEAT-001

| Field | Value |
|-------|-------|
| Ticket | FIX-001 |
| Tier | FIX |
| RCA | docs/daw/specs/rca-FIX-001.md |
| PRD | docs/daw/prd/prd-FEAT-001a.md (PRD loops 5: FR-44, FR-45, AC-70, AC-71, AC-72) |
| Date | 2026-10-28 |
| Spec loops | 0 |

## Problem

Seis pendientes de los reportes de verificación de FEAT-001 (detalle en el RCA):

1. Si la base devuelve un monto, un saldo, un tipo o una fecha con formato inesperado, la sección
   Cuenta (y el formulario de edición, con la fecha o el tipo) queda en blanco.
2. Al aceptar un error cuyo elemento de origen ya no está en pantalla, el foco queda en `<body>`.
3. Un clic en el fondo o en el texto de `MensajeError` saca el foco del diálogo, y Tab sale del
   modal.
4. La prueba `src/paginas/SeccionCuenta.test.jsx:882` falla de forma intermitente (1 de 13).
5. La lógica de la eliminación está mezclada con la carga en `SeccionCuenta`.
6. `ObtenerPaginaMovimientos` no valida el número de página.

## Root cause

Resumen de `docs/daw/specs/rca-FIX-001.md`:

1. Los datos de la base se validan recién al dibujarlos, con formateadores que lanzan
   (`FormatearMonto`, `FormatearMontoConSigno`, `FormatearSaldo`, `FormatearFecha`,
   `ConvertirTextoAFecha`), y no hay nada que capture el error.
2. `ManejarAceptarError` solo enfoca `elementoFoco` si `isConnected` y no tiene un destino de
   reserva.
3. `MensajeError` no cancela el `mousedown`; el atrapado de Tab vive en el `onKeyDown` del diálogo.
4. (Hipótesis) El foco inicial de `MensajeError` usa `useEffect`, que es diferido: un clic que llega
   antes de ese efecto termina con el foco en `<body>`. `ConfirmacionEliminarMovimiento` y
   `MenuMovimiento` tienen la misma forma.
5. FEAT-001c sumó la eliminación dentro de `SeccionCuenta`.
6. El servicio no valida su parámetro, a diferencia de `ObtenerMovimiento` y `EliminarMovimiento`.

## Coverage: PRD → steps

El fix-plan solo cubre lo que FIX-001 agregó o afecta del PRD; el resto de `prd-FEAT-001a.md` ya
está implementado y verificado (`docs/daw/reports/verify-FEAT-001a.md`).

| Requirement | Covered by |
|---|---|
| FR-45 (formato inesperado) | Pasos 1, 2 y 3 |
| FR-44 (foco de reserva) | Paso 4 |
| FR-44 (clic en el fondo o el texto) | Paso 5 |
| NFR-06 (mensajes sin detalles internos) | Pasos 1 a 3: se reutiliza `mensajeErrorCargaMovimientos` |
| NFR-07 (teclado y foco visible) | Pasos 4, 5 y 6 |
| AC-70 | Paso 2 (servicios) y paso 3 (integración en Cuenta) |
| AC-71 | Paso 4 |
| AC-72 | Paso 5 |

Los pasos 7 (refactor del hook) y 8 (página ≤ 0) no tienen un FR: son el punto 5 y el supuesto del
punto 6 del RCA, aprobados en DEFINE.

## Solution — steps

### Paso 1 — Predicados de validación (`src/utilidades/`)

- `src/utilidades/montos.js` (modified): exportar `EsMontoApiValido(texto)`: `true` si `texto` es un
  string que coincide con `expresionMontoApi` (`^-?\d+(\.\d{1,2})?$`); `false` para cualquier otro
  valor (número, `null`, `undefined`, `"abc"`, `"1,5"`, `"1.555"`). No cambia ningún formateador.
- `src/utilidades/fechas.js` (modified): exportar `EsFechaValida(texto)`: `true` si es un string
  `AAAA-MM-DD` con un día que existe (reutiliza `SepararFecha`; `"2026-02-30"` → `false`), sin
  lanzar nunca.
- `src/utilidades/movimientos.js`: **no** se crea. El chequeo del tipo (`'GASTO' | 'INGRESO'`) y el
  del monto no negativo de un movimiento viven en `src/servicios/movimientos.js` (paso 2), junto a
  la única función que los usa.

### Paso 2 — Validación en los servicios (FR-45)

- `src/servicios/cuenta.js` (modified): `ObtenerCuenta` devuelve `{ ok: false }` si
  `!EsMontoApiValido(data[0].saldo)`. El saldo puede ser negativo.
- `src/servicios/movimientos.js` (modified):
  - Función local `EsMovimientoValido(movimiento)`: `tipo` es `'GASTO'` o `'INGRESO'`, `monto` pasa
    `EsMontoApiValido` y no empieza con `-`, y `fecha` pasa `EsFechaValida`.
  - `ObtenerPaginaMovimientos` devuelve `{ ok: false }` si alguna fila no es válida (una sola fila
    mala invalida la página: la lista y el saldo no pueden quedar desparejos).
  - `ObtenerMovimiento` devuelve `{ ok: false }` si el movimiento no es válido (aprobado por el
    usuario el 2026-10-28; mismo comportamiento que E4-4 de FEAT-001b).
- `src/paginas/FormularioMovimiento.jsx` (modified): se quita el `try/catch` alrededor de
  `FormatearMonto` (líneas 102-106), que deja de ser necesario porque `ObtenerMovimiento` ya filtra el
  monto. El camino `!resultado.ok` → `MostrarError(mensajeErrorCargaMovimientos, { alAceptar:
  VolverACuenta })` no cambia.

### Paso 3 — Integración en Cuenta (AC-70)

- Sin cambios de código en `SeccionCuenta.jsx`: el `{ ok: false }` del paso 2 ya muestra
  `mensajeErrorCargaMovimientos` y "Aceptar" reintenta (FR-45). Solo se agregan pruebas.

### Paso 4 — Foco de reserva al aceptar un error (FR-44, AC-71)

- `src/mensajes/ProveedorMensajes.jsx` (modified): en `ManejarAceptarError`, si
  `errorActual.elementoFoco` no está conectado (o no hay), enfocar el primer control enfocable de
  la pantalla actual, obtenido con `ObtenerPrimerControlEnfocable` (abajo).
- `src/utilidades/foco.js` (new): `ObtenerPrimerControlEnfocable(raiz, excluir)`: devuelve el primer
  elemento dentro de `raiz` que coincide con
  `a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])`,
  que no está dentro de `excluir` y que no está dentro de un `fieldset` deshabilitado; `null` si no
  hay. `ProveedorMensajes` lo llama con `raiz = document.querySelector('main')` (o `document.body`
  si no hay `<main>`) y `excluir` = el fondo del mensaje de error que se está cerrando
  (`.fondo-mensaje-error`), antes de desmontarlo.
- En "Añadir Gasto" el primer control es la flecha para volver atrás (`FlechaVolver`, primer hijo del
  encabezado del formulario); en Cuenta, "Añadir Gasto".
- `ManejarCancelarEliminacion` (que pasa al hook en el paso 7) **no** recibe reserva: la confirmación
  está montada dentro de Cuenta, así que mientras está abierta la fila no puede desconectarse.

### Paso 5 — `MensajeError` retiene el foco ante un clic (FR-44, AC-72)

- `src/mensajes/MensajeError.jsx` (modified): `onMouseDown` en `.fondo-mensaje-error` que llama
  `evento.preventDefault()` si el destino no está dentro de `button:not(:disabled)`, como
  `ManejarPresion` de `ConfirmacionEliminarMovimiento.jsx` (4ba2de8). Lo hereda
  `src/sesion/ErrorSesionAnonima.jsx`, que reutiliza `MensajeError`.

### Paso 6 — Foco inicial sin ventana (prueba inestable, punto 4)

- Primero, una prueba determinista que reproduzca la falla (ver "Tests"); si no se consigue
  reproducir, se informa y se documenta la hipótesis como no confirmada antes de seguir.
- `src/mensajes/MensajeError.jsx`, `src/componentes/ConfirmacionEliminarMovimiento.jsx` y
  `src/componentes/MenuMovimiento.jsx` (modified): el efecto que pone el foco inicial pasa de
  `useEffect` a `useLayoutEffect`, que se ejecuta en el mismo commit, antes de que el navegador o la
  prueba puedan disparar otro evento. El efecto `[eliminando]` de la confirmación, también.
- `src/componentes/Paginacion.jsx` ya usa `useLayoutEffect`; `SelectorFecha.jsx` no pone foco al
  montarse. No se tocan.

### Paso 7 — Extraer `useEliminacionMovimiento` (refactor, sin cambio de comportamiento)

- `src/paginas/useEliminacionMovimiento.js` (new): hook con `confirmacion`, `eliminando`, los refs
  `eliminacionEnCurso`, `montado` y `focoEliminacionPendiente`, y las funciones
  `AbrirConfirmacion(idMovimiento, elementoBotonFila)`, `CancelarEliminacion()` y
  `ConfirmarEliminacion()`. Recibe `{ pagina, seccion, botonGasto, alEliminado }`: `alEliminado` es
  la recarga de la página 1 que hoy hace `SeccionCuenta` (`EstablecerCargando(true)`,
  `EstablecerNumeroPagina(1)`, `EstablecerIntentoCarga`), y el efecto de foco tras eliminar
  (`[pagina]`) vive en el hook.
- `src/paginas/SeccionCuenta.jsx` (modified): usa el hook; se quitan de la página esos estados,
  refs y manejadores. Ningún texto, orden de foco ni llamada cambia.
- Ubicación: junto a su único consumidor, como `useMensajes` y `useSesion` viven junto a sus
  proveedores; no hay barrels.

### Paso 8 — Página inválida en `ObtenerPaginaMovimientos`

- `src/servicios/movimientos.js` (modified): antes del `try`, si
  `!Number.isInteger(numeroPagina) || numeroPagina < 1` → `{ ok: false }` sin llamar a
  `ObtenerCliente` (cubre `0`, `-1`, `1.5`, `NaN`, `"1"`, `undefined`).

## Dependencies between steps

- Paso 2 depende del paso 1 (usa los predicados). Paso 3 depende del paso 2.
- Paso 4 depende de `src/utilidades/foco.js`, que se crea en el mismo paso.
- Paso 6 va **antes** del paso 7: la prueba determinista de `SeccionCuenta` tiene que existir y
  pasar antes del refactor, para que el refactor corra sobre una suite estable.
- Paso 7 va después de los pasos 4, 5 y 6, y sin cambiar ninguna prueba existente de
  `SeccionCuenta.test.jsx`: esa suite es su red de seguridad.
- Paso 8 es independiente, pero toca el mismo archivo que el paso 2: conviene hacerlo con él.
- Orden de commits propuesto: (1+2+3+8) datos inválidos → (4) foco de reserva → (5) mousedown →
  (6) foco inicial → (7) refactor.

## Error handling

| Error | Dónde | Cómo se maneja |
|---|---|---|
| Saldo con formato inesperado | `ObtenerCuenta` | `{ ok: false }` → `mensajeErrorCargaMovimientos` con "Aceptar" para reintentar |
| Monto, tipo o fecha inesperados en una fila de la lista | `ObtenerPaginaMovimientos` | `{ ok: false }` → el mismo mensaje y reintento; no se dibuja ninguna fila |
| Monto, tipo o fecha inesperados al abrir la edición | `ObtenerMovimiento` | `{ ok: false }` → `mensajeErrorCargaMovimientos`, "Aceptar" vuelve a Cuenta (E4-4) |
| Página no entera o menor a 1 | `ObtenerPaginaMovimientos` | `{ ok: false }` sin consultar |
| `elementoFoco` desconectado o ausente al aceptar un error | `ManejarAceptarError` | Foco al primer control enfocable de `<main>` fuera del mensaje |
| No hay ningún control enfocable | `ManejarAceptarError` | No se enfoca nada (no lanza); el foco queda donde lo deje el navegador |
| Clic en el fondo o en el texto del error | `MensajeError` | Se cancela el `mousedown`; el foco sigue en "Aceptar" |
| Clic en "Aceptar" antes del efecto de foco inicial | `MensajeError`, confirmación, menú | El foco inicial se pone en el commit (`useLayoutEffect`), así que no hay efecto pendiente |

Ningún mensaje nuevo: NFR-06 se cumple con los textos existentes de `src/mensajes/textos.js`.

## Tests

**Regresión (fallan ANTES del fix, pasan DESPUÉS):**

- [ ] **(regresión 1, AC-70)** `src/paginas/SeccionCuenta.test.jsx`: con un movimiento de monto `"abc"`
  la sección muestra "No se pudieron cargar sus movimientos. Vuelva a intentarlo." con "Aceptar" en
  lugar de quedar vacía; al aceptar con datos válidos muestra la lista y el saldo.
- [ ] **(regresión 1, AC-70)** ídem con la cuenta con saldo `"abc"`.
- [ ] **(regresión 1, edición)** `src/paginas/FormularioMovimiento.test.jsx`: al abrir la edición de
  un movimiento con fecha `"2026-02-30"` y con tipo `"OTRO"` se muestra el error de carga y "Aceptar"
  vuelve a Cuenta, en lugar de quedar vacía.
- [ ] **(regresión 2, AC-71)** `src/paginas/SeccionCuenta.test.jsx` (con un arnés que tenga
  "Añadir Gasto" como entrada anterior del historial): eliminar, volver con Atrás mientras el RPC está
  retenido, liberar el rechazo, presionar "Aceptar" → el foco queda en la flecha para volver atrás
  de "Añadir Gasto".
- [ ] **(regresión 2, unidad)** `src/mensajes/ProveedorMensajes.test.jsx`: `MostrarError` con un
  `elementoFoco` que se quita del DOM antes de "Aceptar" → el foco queda en el primer botón de la
  pantalla, no en `<body>` ni en el mensaje.
- [ ] **(regresión 3, AC-72)** `src/mensajes/MensajeError.test.jsx`: `mousedown` sobre el fondo y
  sobre el texto queda cancelado (`defaultPrevented`); sobre "Aceptar", no.
- [ ] **(regresión 3, AC-72)** `pruebas-navegador/accesibilidad.spec.js`: con "No se pudieron
  cargar sus movimientos." en pantalla, clic en el fondo y Tab, y clic en el texto y Tab → el foco
  sigue en "Aceptar" (Chrome real).
- [ ] **(regresión 4)** `src/mensajes/ProveedorMensajes.test.jsx` (o `MensajeError.test.jsx`): una
  prueba determinista que haga clic en "Aceptar" antes de que corran los efectos pasivos del montaje
  y compruebe que el foco queda en el elemento de origen. Debe fallar con `useEffect` y pasar con
  `useLayoutEffect`.
- [ ] **(regresión 6)** `src/servicios/movimientos.test.js`: `ObtenerPaginaMovimientos(0)`, `(-1)`,
  `(1.5)`, `(NaN)` y `("1")` devuelven `{ ok: false }` sin llamar a Supabase; `(1)` consulta el
  rango `0…49`.

**Unidad y casos de error:**

- [ ] `src/utilidades/montos.test.js`: `EsMontoApiValido` acepta `"0.00"`, `"10"`, `"-5.5"`,
  `"1500.50"` y rechaza `"abc"`, `"1,5"`, `"1.555"`, `""`, `10`, `null`, `undefined`.
- [ ] `src/utilidades/fechas.test.js`: `EsFechaValida` acepta `"2026-10-28"`, `"2024-02-29"` y
  rechaza `"2026-02-30"`, `"2026-13-01"`, `"28/10/2026"`, `""`, `null`, sin lanzar.
- [ ] `src/servicios/cuenta.test.js`: saldo `"abc"` → `{ ok: false }`; saldo `"-1000.00"` →
  `{ ok: true }`.
- [ ] `src/servicios/movimientos.test.js`: `ObtenerPaginaMovimientos` con una fila de monto
  `"abc"`, de monto `"-10.00"`, de tipo `"OTRO"` y de fecha `"2026-02-30"` → `{ ok: false }`; con
  todas válidas → `{ ok: true }` con las filas sin cambios.
- [ ] `src/servicios/movimientos.test.js`: `ObtenerMovimiento` con monto, tipo o fecha inválidos →
  `{ ok: false }`.
- [ ] `src/mensajes/ProveedorMensajes.test.jsx`: sin ningún control enfocable fuera del mensaje,
  "Aceptar" cierra el error sin lanzar.
- [ ] `src/utilidades/foco.test.js` (new): `ObtenerPrimerControlEnfocable` salta botones
  deshabilitados, controles con `tabindex="-1"`, los de un `fieldset` deshabilitado y los que están
  dentro de `excluir`; devuelve `null` si no hay.
- [ ] `src/paginas/SeccionCuenta.test.jsx:882` (E3-1): después del paso 6, 20 corridas seguidas de
  `npx vitest run src` sin fallas.

**Regresión de lo existente (deben seguir pasando sin cambios):**

- [ ] `src/paginas/SeccionCuenta.test.jsx` completo, sin modificar las pruebas existentes (red del
  refactor del paso 7).
- [ ] `src/componentes/ConfirmacionEliminarMovimiento.test.jsx`, `MenuMovimiento.test.jsx`,
  `src/mensajes/MensajeError.test.jsx`, `src/sesion/ProveedorSesion.test.jsx` (líneas 90-131,
  `ErrorSesionAnonima`).
- [ ] `src/paginas/FormularioMovimiento.test.jsx:1416` (E4-4, monto con formato inesperado).
- [ ] `src/servicios/obtenerCliente.test.js`, `pruebas/` contra Supabase y `pruebas-navegador/`
  completos.
- [ ] `npm run lint` sin errores.

## Regression risk

**Medio.**

- La validación nueva de los servicios rechazaría datos válidos si el predicado es más estricto que
  lo que devuelve la base. Mitigación: la base devuelve `numeric` con 2 decimales (`"10.00"`) y
  `date` (`"2026-10-02"`); las pruebas contra Supabase de `pruebas/` lo comprueban con datos reales.
- `useLayoutEffect` cambia el momento del foco inicial en tres componentes. Mitigación: sus pruebas
  y las de teclado del navegador (`accesibilidad.spec.js`) corren completas.
- El refactor del paso 7 puede alterar el orden de foco o de recarga tras eliminar. Mitigación: la
  suite de `SeccionCuenta.test.jsx` no se modifica y `pruebas-navegador/` cubre la eliminación con
  teclado y los cuatro anchos.
- No hay migraciones, cambios de esquema ni de API.

## Rollback plan *(mandatory)*

- **Pasos:** el fix no toca la base: revertir los commits de la rama (`git revert` del merge del PR,
  o de los commits del paso afectado; el orden de commits permite revertir cada punto por separado).
  No hay datos que restaurar.
- **Indicadores:**
  - La sección Cuenta muestra "No se pudieron cargar sus movimientos." con datos que antes se
    veían (predicado demasiado estricto) → revertir el commit de datos inválidos.
  - El foco inicial no llega a "Aceptar", "Cancelar" o la primera opción del menú, o la navegación
    con teclado de `pruebas-navegador/` falla → revertir el commit del foco inicial.
  - Cambia algo del flujo de eliminación (foco, recarga, mensajes) → revertir el commit del
    refactor.

## Final verification

- `npm test` (src + `pruebas/` contra Supabase) y `npm run test:navegador` completos en verde.
- `npm run lint` sin errores.
- 20 corridas de `npx vitest run src` sin fallas de `SeccionCuenta.test.jsx:882`.
- `grep -rn "useEffect" src/mensajes/MensajeError.jsx src/componentes/ConfirmacionEliminarMovimiento.jsx`
  no devuelve el efecto de foco inicial.
- Con `npm run dev`: un clic en el fondo de un mensaje de error y Tab dejan el foco en "Aceptar".
