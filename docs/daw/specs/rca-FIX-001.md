# RCA — FIX-001: Pendientes de FEAT-001

- **Fecha:** 2026-10-28
- **Rama:** `fix/FIX-001-pendientes-feat-001` (desde `main` en 045b1a5)
- **PRD relacionado:** `docs/daw/prd/prd-FEAT-001a.md` (actualizado a PRD loops 5: FR-44, FR-45,
  AC-70 a AC-72). También toca lo construido en FEAT-001c (`prd-FEAT-001c.md`, FR-10).
- **Origen de los pendientes:** reportes de verificación de FEAT-001a, FEAT-001b y FEAT-001c
  (`docs/daw/reports/verify-FEAT-001*.md`).

El ticket agrupa seis puntos. Cada uno tiene su causa raíz, el componente afectado y si reveló un
hueco en el PRD.

## 1. La sección Cuenta queda en blanco ante un monto o un saldo con formato inesperado

- **Síntoma:** si la base devuelve un movimiento con `monto` que no tiene la forma `N.NN` (o un
  saldo así), la pantalla queda en blanco.
- **Cadena de eventos:**
  1. `ObtenerPaginaMovimientos` (`src/servicios/movimientos.js`) y `ObtenerCuenta`
     (`src/servicios/cuenta.js`) devuelven los datos tal como llegan, sin validar el formato de los
     montos.
  2. `ListaMovimientos.jsx:94` llama a `FormatearMontoConSigno` y `EncabezadoCuenta.jsx:10` a
     `FormatearSaldo` **durante el render**.
  3. `FormatearMonto` (`src/utilidades/montos.js`) lanza `Error('Monto inválido')` si el texto no
     coincide con `^-?\d+(\.\d{1,2})?$`.
  4. No hay ningún error boundary en la app (`grep ErrorBoundary src` → 0): React desmonta todo el
     árbol y no queda nada en pantalla.
- **Causa raíz:** los datos de la base se validan recién al dibujarlos, en funciones que lanzan,
  sin nada que capture el error. El formulario de edición ya lo resuelve atrapando la excepción de
  `FormatearMonto` y tratándola como error de carga (`FormularioMovimiento.jsx:103-105`); la sección
  Cuenta no.
- **Componente:** `src/servicios/` (cuenta y movimientos), `SeccionCuenta`, `ListaMovimientos`,
  `EncabezadoCuenta`.
- **Hueco en el PRD:** sí. FR-45 no cubría datos con formato inesperado. **Decisión del usuario
  (2026-10-28):** tratarlo como error de carga, con "No se pudieron cargar sus movimientos. Vuelva a
  intentarlo." y "Aceptar" para reintentar (FR-45, AC-70).

## 2. El foco queda en `<body>` al aceptar un error cuyo elemento de origen ya no existe

- **Síntoma:** el usuario confirma una eliminación, vuelve con Atrás antes de que termine, la
  eliminación falla y, al presionar "Aceptar", el foco no queda en ningún control visible.
- **Cadena de eventos:**
  1. `ManejarConfirmarEliminacion` (`SeccionCuenta.jsx`) llama a `MostrarError` con
     `elementoFoco: elementoBotonFila` aunque Cuenta ya se haya desmontado (E3-5 de FEAT-001c pide
     mostrar el mensaje igual).
  2. `ManejarAceptarError` (`ProveedorMensajes.jsx:71-77`) solo enfoca `elementoFoco` si
     `isConnected`. El botón de la fila ya no está en el DOM, así que no enfoca nada.
  3. Al desmontarse el diálogo que tenía el foco, el navegador lo deja en `<body>`.
- **Causa raíz:** `ManejarAceptarError` no tiene un destino de reserva cuando el elemento de origen
  desapareció. Afecta a cualquier error cuyo elemento de origen se desmonte, no solo a la
  eliminación.
- **Componente:** `src/mensajes/ProveedorMensajes.jsx`.
- **Hueco en el PRD:** sí. FR-44 no decía adónde va el foco en ese caso, y NFR-07 pide el foco
  visible en todo momento. **Decisión del usuario (2026-10-28):** al primer control enfocable de la
  pantalla actual (FR-44, AC-71).

## 3. Un clic en el fondo o en el texto de `MensajeError` saca el foco del diálogo

- **Síntoma:** con un error en pantalla, un clic en el fondo o en el texto y después Tab llevan el
  foco fuera del diálogo modal.
- **Cadena de eventos:**
  1. `MensajeError.jsx` no maneja `mousedown`: el navegador mueve el foco al punto del clic, que no
     es enfocable, y lo deja en `<body>`.
  2. El atrapado de Tab está en el `onKeyDown` del diálogo; con el foco en `<body>`, la tecla no
     llega al diálogo y Tab recorre la página que quedó detrás.
- **Causa raíz:** el mismo defecto que se corrigió en `ConfirmacionEliminarMovimiento` con
  `4ba2de8` (cancelar el `mousedown` que no cae en un botón habilitado), sin aplicar a
  `MensajeError`.
- **Componente:** `src/mensajes/MensajeError.jsx`.
- **Hueco en el PRD:** sí, menor: FR-44 no decía que el clic no saca el foco. Se agregó a FR-44 y
  AC-72, en la misma decisión del punto 2.

## 4. Prueba inestable `SeccionCuenta.test.jsx:882` (W-1 de verify-FEAT-001c)

- **Síntoma:** "(error E3-1) con el RPC rechazado…" falló 1 vez en 13 corridas, solo con la suite
  completa en paralelo. Tras "Aceptar", el foco no estaba en la fila (línea 904).
- **Cadena de eventos (hipótesis, a confirmar en CODE con una prueba determinista):**
  1. `MensajeError` pone el foco en "Aceptar" con `useEffect`, que React ejecuta de forma diferida
     después de pintar.
  2. La prueba encuentra el diálogo con `findByRole` y hace `fireEvent.click` en "Aceptar". Bajo
     carga, ese clic puede llegar **antes** de que corra el efecto pendiente.
  3. `ManejarAceptarError` enfoca la fila y pide cerrar el error. Para procesar esa actualización,
     React primero ejecuta los efectos pendientes: el de `MensajeError` devuelve el foco a
     "Aceptar".
  4. React quita el diálogo, el elemento con foco desaparece y el foco termina en `<body>`.
- **Causa raíz (hipótesis):** el foco inicial de `MensajeError` depende de un efecto diferido, que
  puede ejecutarse después de que el usuario o la prueba ya actuaron sobre el diálogo. En un
  navegador real es casi imposible hacer clic tan rápido, pero el orden no está garantizado. La
  misma forma aparece en `ConfirmacionEliminarMovimiento`.
- **Componente:** `src/mensajes/MensajeError.jsx` (y la misma forma en
  `ConfirmacionEliminarMovimiento.jsx`).
- **Hueco en el PRD:** no. Es un defecto de implementación.

## 5. La lógica de la eliminación está mezclada con la carga en `SeccionCuenta`

- **Situación:** `SeccionCuenta.jsx` contiene, además de la carga y la paginación, el estado de la
  confirmación, el bloqueo del doble envío (`eliminacionEnCurso`), la guardia `montado` y el foco
  pendiente tras eliminar (`focoEliminacionPendiente`).
- **Causa raíz:** FEAT-001c sumó la eliminación dentro del componente existente. No es un defecto:
  es deuda que el verificador señaló para extraer en un hook `useEliminacionMovimiento`, sin cambiar
  el comportamiento.
- **Componente:** `src/paginas/SeccionCuenta.jsx`.
- **Hueco en el PRD:** no.

## 6. `ObtenerPaginaMovimientos` con página ≤ 0 no tiene un comportamiento fijado

- **Situación:** con `numeroPagina = 0` calcula el rango `-50…-1` y lo manda a Supabase, que lo
  rechaza; con valores no enteros arma rangos sin sentido. Ninguna prueba lo fija (observación del
  VERIFY de FEAT-001a). Hoy ningún llamador lo hace: `Paginacion` nunca baja de 1.
- **Causa raíz:** el servicio no valida su parámetro, a diferencia de `ObtenerMovimiento` y
  `EliminarMovimiento`, que validan el id antes de consultar.
- **Componente:** `src/servicios/movimientos.js`.
- **Hueco en el PRD:** no. **Supuesto** (comunicado al usuario el 2026-10-28): con una página que
  no sea un entero ≥ 1, el servicio devuelve `{ ok: false }` sin consultar.

## Fuera de este ticket

- **Fecha mínima en el servidor:** el calendario empieza en 1900 y la base no tiene mínimo. Cambiarlo
  requiere una migración, una validación nueva y una decisión de producto (FR-23 dice "sin una fecha
  mínima"). Queda para una feature aparte.
