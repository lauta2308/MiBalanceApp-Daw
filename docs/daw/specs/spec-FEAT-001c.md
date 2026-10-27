# Spec FEAT-001c: Eliminación de Movimientos

| Field | Value |
|-------|-------|
| Ticket | FEAT-001c |
| PRD | docs/daw/prd/prd-FEAT-001c.md |
| Tier | FEATURE |
| Date | 2026-10-27 |
| Spec loops | 0 |

## Summary

La eliminación reutiliza la arquitectura de FEAT-001a y FEAT-001b. En la base de datos, una nueva
función atómica `BASP_ELIMINAR_MOVIMIENTO` (RPC, `SECURITY DEFINER`) bloquea primero la cuenta y
después el movimiento, como el alta y la edición; borra el movimiento y le quita su efecto al saldo
en una sola transacción. En el frontend, el menú de la fila suma la opción "Eliminar", que abre en la
sección Cuenta un diálogo de confirmación; al confirmar, Cuenta llama al RPC, vuelve a la página 1 y
recarga la cuenta y la lista. No hay navegación ni ruta nueva.

Decisiones de diseño acordadas en PLAN:
- D1 — La eliminación ocurre en la sección Cuenta, sin navegar. "Eliminar" abre
  `ConfirmacionEliminarMovimiento` (`src/componentes/`), un diálogo modal (`role="alertdialog"`,
  `aria-modal="true"`) con el foco atrapado entre "Cancelar" y "Confirmar". Toma sus textos de
  `src/mensajes/textos.js`. El estado de la confirmación vive en `SeccionCuenta`, que ya es dueña de
  la carga, de los mensajes y del foco de retorno; `ListaMovimientos` sigue siendo presentacional.
- D2 — Al abrirse la confirmación el foco va a "Cancelar", la opción no destructiva (patrón APG de
  alertdialog). Escape equivale a "Cancelar", salvo mientras se elimina.
- D3 — "Cancelar" o Escape cierran la confirmación y devuelven el foco al botón de la fila (si sigue
  en el DOM). Ante un error (FR-10), la confirmación se cierra primero y después se muestra el error
  con "Aceptar" (`MostrarError` existente); al aceptar, el foco vuelve al botón de la fila.
- D4 — Ante el éxito: `MostrarExito("Movimiento eliminado con éxito.")`, `numeroPagina` = 1,
  `intentoCarga` + 1 (si ya se estaba en la página 1, cambiar solo el número no recarga) y
  `cargando` = `true`. Un ref `focoEliminacionPendiente` se aplica cuando llega la página 1
  recargada: el foco va a la primera fila o, si la lista quedó vacía (FR-09), al botón "Añadir
  Gasto". Si esa recarga falla, el pendiente se conserva hasta la siguiente recarga exitosa.
- D5 — Mientras se elimina, "Confirmar" muestra "Eliminando…" con `aria-disabled="true"` y conserva
  el foco (se le hace `focus()` al iniciar); un segundo clic se ignora por el ref
  `eliminacionEnCurso`. "Cancelar" lleva `disabled`, la trampa de Tab queda fija en "Eliminando…" y
  Escape se ignora. Es el patrón de "Guardando…" de `FormularioMovimiento` (`disabled` sobre un
  botón con foco lo manda a `<body>`).
- D6 — AC-11 (falla simulada) muestra el mensaje de FR-10.
- D7 — Deuda de FEAT-001b (W-1 de `docs/daw/reports/verify-FEAT-001b.md`): se agrega la prueba de
  navegador del clic afuera del menú sobre un control enfocable, que comprueba que el foco queda en
  ese control.
- D8 — Las pruebas de navegador usan los usuarios que ya prepara `configuracionGlobal.js`
  (accesibilidad, anchos y rendimiento): no se agregan nombres ni inicios anónimos.

Terminología: la del PRD y el glosario de `AGENTS.md` — movimiento, ingreso, gasto, cuenta, saldo,
categoría. Nunca "egreso".

## Coverage: PRD → blocks

| Requirement | Covered by |
|---|---|
| FR-01 | Block 3 |
| FR-02 | Block 2 (texto), Block 3 |
| FR-03 | Block 1, Block 2, Block 3 |
| FR-04 | Block 3 |
| FR-05 | Block 1 |
| FR-06 | Block 2 (texto), Block 3 |
| FR-07 | Block 2 (texto), Block 3 |
| FR-08 | Block 3 |
| FR-09 | Block 3 |
| FR-10 | Block 2 (`{ ok: false }` y texto), Block 3 |
| FR-11 | Block 1 |
| NFR-01 | Strategy: una sola llamada RPC por eliminación, que bloquea solo la cuenta propia y un movimiento por su clave primaria, y una sola recarga de la página 1 con la consulta ya cubierta por `BAIX_MOVIMIENTOS_CUENTA_FECHA`; medido en Block 4 |
| NFR-02 | Strategy: cuenta tomada de `auth.uid()` y movimiento buscado con `id_cuenta = v_id_cuenta`; `authenticated` sin DELETE ni UPDATE directos; probado en Block 1 |
| NFR-03 | Strategy: todo dentro de una función (una transacción) con la falla simulada `ELIMINAR_MOVIMIENTO` entre el borrado y el cambio del saldo (ADR-002); probado en Block 1 |
| NFR-04 | Strategy: menú con `role="menu"` y flechas, diálogo con foco atrapado, Escape y foco retenido en "Eliminando…", foco visible de `estilos.css`; probado en Block 3 y Block 4 |
| NFR-05 | Strategy: diálogo con ancho relativo y botones que pasan a columna en anchos chicos, sin anchos fijos mayores a 320px; probado en Block 4 |
| NFR-06 | Strategy: los colores ya validados en FEAT-001a para texto y botones; probado con axe-core en Block 4 |

## Dependencies between blocks

- Block 1 no depende de ninguno.
- Block 2 depende de Block 1 (RPC `basp_eliminar_movimiento`).
- Block 3 depende de Block 2.
- Block 4 depende de Block 1 y Block 3.

Orden de ejecución: 1 → 2 → 3 → 4.

## Block 1 — Base de datos: eliminación atómica

**Files**
- `supabase/migrations/20261028000100_eliminacion_movimientos.sql` (new) — función y punto de falla.
- `supabase/scripts/revertir_eliminacion_movimientos.sql` (new) — reversión de esta migración.
- `pruebas/eliminacion.test.js` (new) — pruebas contra Supabase.
- `pruebas/seguridad.test.js` (modified) — EXECUTE de la función nueva para `anon`, `authenticated` y `service_role`.

**API contract**
- Método + ruta: `POST /rest/v1/rpc/basp_eliminar_movimiento` (supabase-js: `rpc('basp_eliminar_movimiento', …)`).
- Request: `p_id_movimiento uuid`.
- Response: `uuid` — el id del movimiento eliminado.
- Error codes: `BA401` sin sesión; `BA404` el usuario no tiene cuenta, o el movimiento no existe o es de otra cuenta (mismo código, no revela si existe); `BA400` falta el id; `BA500` falla simulada.
- Auth: JWT de Supabase con rol `authenticated`. `EXECUTE` revocado a `PUBLIC`, `anon`, `authenticated` y `service_role`, y concedido solo a `authenticated`. Dueño `postgres`, `SECURITY DEFINER`, `SET search_path = ''`.

**Data model**
- Sin tablas ni columnas nuevas. Se borra una fila de `BAT_MOVIMIENTOS` y se actualiza `BAT_CUENTAS.saldo`.
- `pruebas.BAT_FALLAS_SIMULADAS`: `BACK_FALLAS_SIMULADAS_PUNTO` pasa a `CHECK (punto IN ('AGREGAR_MOVIMIENTO', 'EDITAR_MOVIMIENTO', 'ELIMINAR_MOVIMIENTO'))` (DROP + ADD CONSTRAINT).
- Índices: ninguno nuevo; la búsqueda del movimiento usa `BAPK_MOVIMIENTOS`.
- Permisos de tablas sin cambios: `authenticated` conserva solo SELECT; `service_role` conserva el DELETE sobre `BAT_MOVIMIENTOS` que usan las pruebas para limpiar.

**Logic**
`BASP_ELIMINAR_MOVIMIENTO(p_id_movimiento uuid) RETURNS uuid`, `LANGUAGE plpgsql`, en este orden:
1. `v_id_usuario := auth.uid()`; nulo → `BA401`.
2. Cuenta del usuario con `FOR UPDATE` → `v_id_cuenta`; sin cuenta → `BA404`. Mismo orden de bloqueo que el alta y la edición: primero la cuenta, después el movimiento, para no generar deadlocks.
3. `p_id_movimiento` nulo → `BA400`.
4. `SELECT tipo, monto INTO v_tipo, v_monto FROM public.BAT_MOVIMIENTOS WHERE id = p_id_movimiento AND id_cuenta = v_id_cuenta FOR UPDATE`; sin fila → `BA404`.
5. `DELETE FROM public.BAT_MOVIMIENTOS WHERE id = p_id_movimiento`.
6. Falla simulada `ELIMINAR_MOVIMIENTO` (ADR-002) → `BA500`.
7. `v_efecto := CASE WHEN v_tipo = 'INGRESO' THEN v_monto ELSE -v_monto END` (`numeric`) y un solo `UPDATE public.BAT_CUENTAS SET saldo = saldo - v_efecto WHERE id = v_id_cuenta`. Sin piso: el saldo puede quedar negativo.
8. `RETURN p_id_movimiento`.

Permisos: `ALTER FUNCTION … OWNER TO postgres`, `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated,
service_role` y `GRANT EXECUTE … TO authenticated`, como en las migraciones anteriores.

Reversión (`revertir_eliminacion_movimientos.sql`), dentro de `BEGIN/COMMIT`:
1. `DELETE FROM pruebas.BAT_FALLAS_SIMULADAS WHERE punto = 'ELIMINAR_MOVIMIENTO'`.
2. Restaurar `BACK_FALLAS_SIMULADAS_PUNTO` a `IN ('AGREGAR_MOVIMIENTO', 'EDITAR_MOVIMIENTO')`.
3. `DROP FUNCTION public.BASP_ELIMINAR_MOVIMIENTO(uuid)`.
4. Encabezado: qué deshace, que no borra datos de usuarios, la instrucción `npx supabase migration repair --status reverted 20261028000100`, que se ejecuta **antes** que `revertir_edicion_movimientos.sql` (esa reversión rehace la restricción solo con `AGREGAR_MOVIMIENTO`) y que no toca la reversión de FEAT-001a, que nunca se ejecuta en esta base (borra cuentas reales).

**Input validation**
- `p_id_movimiento`: uuid no nulo; debe pertenecer a la cuenta de la sesión.

**Error handling**
- E1-1 — Sin sesión → `BA401`.
- E1-2 — Movimiento inexistente o de otra cuenta → `BA404`; nada cambia.
- E1-3 — Id nulo → `BA400`; nada cambia.
- E1-4 — Falla simulada entre el borrado y el cambio del saldo → `BA500` y se revierte la transacción entera.
- E1-5 — Cambio directo del saldo o DELETE directo de un movimiento desde la API con la sesión del usuario → rechazado por falta de permisos (FR-11).
- E1-6 — Llamada al RPC como `anon` o `service_role` → rechazada por falta de EXECUTE.

**Required tests**
Todas en `pruebas/eliminacion.test.js` salvo indicación; usuarios anónimos marcados con `es_prueba`.
- [ ] eliminar por RPC un ingreso de 1.000 (saldo 5.000) borra la fila y deja el saldo en 4.000; el RPC devuelve el id — validates AC-03 (API), FR-05.
- [ ] eliminar el único movimiento, un gasto de 500 (saldo -500), deja 0 movimientos y el saldo en 0 — validates AC-07 (API).
- [ ] (error E1-2) el usuario A elimina por su id un movimiento del usuario B: rechazado, el movimiento y el saldo de B sin cambios — validates AC-10, NFR-02.
- [ ] (error E1-2) un id inexistente devuelve el mismo código que un id ajeno.
- [ ] (error E1-4) con la falla `ELIMINAR_MOVIMIENTO` activa, eliminar un gasto de 3.000 (saldo 10.000) falla con `BA500`, el gasto sigue con monto 3000.00 y el saldo en 10.000 — validates AC-11 (API), NFR-03.
- [ ] secuencia fija de 20 altas, 20 ediciones (10 con cambio de tipo) y 10 eliminaciones intercaladas desde saldo 0: después de cada operación, saldo = suma de ingresos − suma de gastos, calculado con BigInt — validates AC-12.
- [ ] (error E1-5) después de eliminar un gasto de 3.000 (saldo 10.000 → 13.000), un UPDATE directo del saldo a 1000000 con la sesión del usuario es rechazado (42501) y el saldo sigue en 13.000 — validates AC-16, FR-11.
- [ ] (error E1-3) llamar al RPC con `p_id_movimiento` nulo: rechazado con `BA400`.
- [ ] (error E1-1) llamar al RPC sin sesión: rechazado.
- [ ] (error E1-6, en `seguridad.test.js`) `anon` y `service_role` no tienen EXECUTE sobre `basp_eliminar_movimiento(uuid)` y `authenticated` sí; por API, `anon` y `service_role` reciben 42501.

**Completion criterion**
La migración se aplica con `npx supabase db push`; `npx vitest run pruebas/eliminacion.test.js
pruebas/seguridad.test.js` pasa contra el proyecto de Supabase.

## Block 2 — Servicios y textos

**Files**
- `src/servicios/movimientos.js` (modified) — `EliminarMovimiento(idMovimiento)`; el comentario de cabecera (`:1-3`) y el de `expresionUuid` se generalizan (el id ahora también llega de la lista).
- `src/servicios/movimientos.test.js` (modified) — pruebas de `EliminarMovimiento`.
- `src/servicios/obtenerCliente.test.js` (modified) — `EliminarMovimiento` cuando `clienteSupabase.js` lanza al cargarse.
- `src/mensajes/textos.js` (modified) — textos de la eliminación.
- `src/mensajes/textos.test.js` (modified) — los textos nuevos.

**Logic**
`EliminarMovimiento(idMovimiento)`: si `idMovimiento` no es texto con forma de UUID (reusa
`expresionUuid`) devuelve `{ ok: false }` sin llamar a Supabase; si no, una sola llamada
`rpc('basp_eliminar_movimiento', { p_id_movimiento: idMovimiento })`. Con `error` o sin `data`
devuelve `{ ok: false }`; si no, `{ ok: true }`. Cualquier excepción (incluida la de
`ObtenerCliente`) da `{ ok: false }`. Nunca expone el error de Supabase.

Textos nuevos en `textos.js`:
- `mensajeMovimientoEliminado = 'Movimiento eliminado con éxito.'` (FR-07)
- `mensajeErrorEliminarMovimiento = 'No se pudo eliminar el movimiento. Vuelva a intentarlo.'` (FR-10)
- `textoConfirmarEliminacion = '¿Está seguro que desea eliminar este movimiento?'` (FR-02)
- `textoBotonConfirmar = 'Confirmar'`, `textoBotonCancelar = 'Cancelar'` (FR-02)
- `textoEliminando = 'Eliminando…'` (FR-06)

El "Cancelar" literal de `FormularioMovimiento.jsx:239` queda como está (fuera de alcance).

**Input validation**
- `idMovimiento`: string con forma de UUID; cualquier otro valor da `{ ok: false }` sin llamar a Supabase.

**Error handling**
- E2-1 — Id mal formado → `{ ok: false }`, sin consulta.
- E2-2 — Rechazo del RPC (`BA404`, `BA500`, otro) o respuesta sin `data` → `{ ok: false }`.
- E2-3 — Excepción de red o de `ObtenerCliente` → `{ ok: false }`.

**Required tests**
- [ ] con un id válido llama una sola vez a `basp_eliminar_movimiento` con `{ p_id_movimiento }` y devuelve `{ ok: true }` — validates FR-03.
- [ ] (error E2-1) con ids `'abc'`, `''`, `undefined`, un UUID con un carácter de más y un UUID sin guiones devuelve `{ ok: false }` sin llamar a Supabase.
- [ ] (error E2-2, E2-3) ante `BA500`, `BA404`, respuesta sin `data` y una excepción devuelve exactamente `{ ok: false }`, sin el texto del error — validates FR-10.
- [ ] (error E2-3, en `obtenerCliente.test.js`) si `clienteSupabase.js` lanza al cargarse, `EliminarMovimiento` devuelve `{ ok: false }`.
- [ ] los textos nuevos tienen exactamente los valores del PRD (FR-02, FR-06, FR-07, FR-10).

**Completion criterion**
`npx vitest run src/servicios src/mensajes` pasa.

## Block 3 — Interfaz: opción "Eliminar" y confirmación

**Files**
- `src/componentes/MenuMovimiento.jsx` (modified) — segunda opción "Eliminar" (prop `alEliminar`); se actualiza el comentario de `:25-26`.
- `src/componentes/MenuMovimiento.test.jsx` (modified) — las pruebas que esperan una sola opción (`:35-43`, `:45-49`, `:117-124`) pasan a esperar "Editar" y "Eliminar".
- `src/componentes/ListaMovimientos.jsx` (modified) — prop `alEliminar(idMovimiento, elementoBotonFila)`; comentario `:9-12`.
- `src/componentes/ListaMovimientos.test.jsx` (modified) — la prueba de `:141` espera las dos opciones; "Eliminar" llama a `alEliminar` con el id y el botón de la fila.
- `src/componentes/ConfirmacionEliminarMovimiento.jsx` (new) — diálogo de confirmación.
- `src/componentes/ConfirmacionEliminarMovimiento.test.jsx` (new).
- `src/paginas/SeccionCuenta.jsx` (modified) — estado de la confirmación, eliminación, recarga y foco; comentario `:10-19`.
- `src/paginas/SeccionCuenta.test.jsx` (modified) — el cliente simulado (`:14-42`) suma `rpc`; pruebas de la eliminación.
- `src/paginas/FormularioMovimiento.test.jsx` (modified) — la prueba AC-27 de FEAT-001b (`:1531-1537`) deja de presionar `{ArrowDown}` dentro del menú (el foco ya está en "Editar" al abrirlo; con "Eliminar" como segunda opción la flecha lo movería).
- `src/estilos.css` (modified) — clases propias del diálogo.

**Logic**
- `MenuMovimiento`: `<li role="none">` con un segundo `button role="menuitem"` "Eliminar" que llama a `alEliminar`. Las flechas, Inicio y Fin ya recorren todas las opciones.
- `ListaMovimientos`: `alEliminar={() => { CerrarMenu(); alEliminar(movimiento.id, botonFila.current); }}` desde `FilaMovimiento`, simétrico a `alEditar`. Su único estado sigue siendo `idMenuAbierto`.
- `ConfirmacionEliminarMovimiento({ eliminando, alConfirmar, alCancelar })`: fondo `fondo-confirmacion` y caja `confirmacion-eliminar` con `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` al párrafo con `textoConfirmarEliminacion`. Botones en `botones-confirmacion`: "Cancelar" (`disabled` mientras `eliminando`) y "Confirmar" (texto `textoEliminando` y `aria-disabled="true"` mientras `eliminando`). Al montarse, foco en "Cancelar" (D2). Tab y Mayús+Tab alternan entre los dos botones; con `eliminando`, quedan en "Eliminando…". Escape llama a `alCancelar` salvo con `eliminando`. Al pasar `eliminando` a `true`, `focus()` en "Confirmar" (D5).
- `SeccionCuenta`:
  - Estado `confirmacion` (`{ idMovimiento, elementoBotonFila } | null`) y `eliminando`; refs `eliminacionEnCurso`, `focoEliminacionPendiente` y `montado`.
  - `ManejarEliminar(idMovimiento, elementoBotonFila)` → abre la confirmación.
  - `ManejarCancelarEliminacion()` → cierra y, si `elementoBotonFila.isConnected`, le devuelve el foco (D3).
  - `ManejarConfirmarEliminacion()` → si `eliminacionEnCurso` ya es `true`, no hace nada; si no, lo marca, `EstablecerEliminando(true)` y llama a `EliminarMovimiento`. Con `{ ok: true }`: `MostrarExito(mensajeMovimientoEliminado)` siempre; si sigue montado, cierra la confirmación, marca `focoEliminacionPendiente`, `EstablecerCargando(true)`, `EstablecerNumeroPagina(1)` y `EstablecerIntentoCarga(+1)` (D4). Con `{ ok: false }`: cierra la confirmación y `MostrarError(mensajeErrorEliminarMovimiento, { elementoFoco: elementoBotonFila })` (D3, D6). En ambos casos libera `eliminacionEnCurso` y `eliminando`.
  - Un efecto sobre `pagina`: si `focoEliminacionPendiente` y la página 1 llegó, enfoca la primera fila (`[data-id-movimiento]`) o, si no hay, `botonGasto`, y limpia el pendiente. Si la recarga falla, el pendiente se conserva (D4).
  - Renderiza `ConfirmacionEliminarMovimiento` cuando `confirmacion` no es nulo; pasa `alEliminar={ManejarEliminar}` a `ListaMovimientos`.
- `estilos.css`: `.fondo-confirmacion` (fijo, cubre la pantalla, `z-index` 20 como `.fondo-mensaje-error`; nunca coinciden porque la confirmación se cierra antes de mostrar el error), `.confirmacion-eliminar` (ancho relativo, máximo el de `.mensaje`), `.botones-confirmacion` (en fila; en columna por debajo de 360px). Sin colores nuevos.

**Input validation**
- No hay campos: el id llega del movimiento de la lista y lo valida `EliminarMovimiento` (Block 2).

**Error handling**
- E3-1 — `EliminarMovimiento` devuelve `{ ok: false }` (falla, rechazo o falla simulada) → se cierra la confirmación, se muestra `mensajeErrorEliminarMovimiento` con "Aceptar", el movimiento y el saldo siguen en pantalla sin cambios y al aceptar el foco vuelve a la fila — FR-10, AC-08, AC-11.
- E3-2 — Doble clic o doble Enter en "Confirmar" → una sola llamada a `EliminarMovimiento` — FR-06, AC-05.
- E3-3 — Escape o clic en "Cancelar" mientras se elimina → ignorados.
- E3-4 — La recarga posterior al éxito falla → el error de carga de FEAT-001a (`mensajeErrorCargaMovimientos`, "Aceptar" reintenta); el foco pendiente se aplica en la recarga exitosa.
- E3-5 — El usuario sale de Cuenta (Atrás) durante la eliminación → no se actualiza estado desmontado; el mensaje de éxito se muestra igual.

**Required tests**
- [ ] el menú de la fila muestra "Editar" y "Eliminar", y las flechas, Inicio y Fin recorren ambas — validates AC-01 (unidad).
- [ ] "Eliminar" llama a `alEliminar` con el id del movimiento y el botón de su fila.
- [ ] elegir "Eliminar" muestra "¿Está seguro que desea eliminar este movimiento?" con "Confirmar" y "Cancelar", y el foco en "Cancelar" — validates AC-02.
- [ ] con saldo 5.000 que incluye un ingreso de 1.000, "Eliminar" → "Confirmar" llama al RPC una vez, recarga, quita la fila, muestra "USD 4.000,00" y "Movimiento eliminado con éxito." con el tic, que se cierra a los 3 s (temporizadores falsos) — validates AC-03.
- [ ] "Cancelar" y Escape cierran la confirmación sin llamar al RPC; la fila y el saldo siguen; el foco vuelve a la fila — validates AC-04.
- [ ] (error E3-2, E3-3) dos clics seguidos en "Confirmar" llaman al RPC una sola vez; mientras tanto el botón dice "Eliminando…" con `aria-disabled="true"` y tiene el foco, "Cancelar" está deshabilitado y Escape no cierra; al terminar, saldo "USD 4.000,00" — validates AC-05.
- [ ] con 120 movimientos en la página 2, eliminar uno vuelve a la página 1 con "Página 1 de 3" — validates AC-06.
- [ ] estando en la página 1, eliminar un movimiento vuelve a pedir la página 1 y la cuenta.
- [ ] eliminar el único movimiento muestra "Aquí verá sus movimientos." y "USD 0,00", con el foco en "Añadir Gasto" — validates AC-07.
- [ ] después de eliminar, con movimientos restantes, el foco queda en la primera fila de la página 1.
- [ ] (error E3-1) con el RPC rechazado, se cierra la confirmación, se muestra "No se pudo eliminar el movimiento. Vuelva a intentarlo." con "Aceptar", la fila y el saldo "USD 5.000,00" siguen y al aceptar el foco vuelve a la fila — validates AC-08, AC-11 (interfaz).
- [ ] (error E3-4) si la recarga posterior al éxito falla, se muestra el error de carga y, tras "Aceptar", la recarga exitosa enfoca la primera fila.
- [ ] (error E3-5) si Cuenta se desmonta durante la eliminación, no hay advertencias de estado y el mensaje de éxito se muestra.
- [ ] en la confirmación, Tab y Mayús+Tab alternan entre "Cancelar" y "Confirmar" y no salen del diálogo — validates AC-13 (unidad).
- [ ] la prueba AC-27 de FEAT-001b sigue abriendo la edición con el teclado sin `{ArrowDown}`.

**Completion criterion**
`npx vitest run --project unitarias` pasa todas las pruebas de `src/`; con `npm run dev` contra el
proyecto de Supabase, un movimiento se elimina desde el menú de su fila y el saldo y la lista se
actualizan.

## Block 4 — Pruebas en navegador

**Files**
- `pruebas-navegador/accesibilidad.spec.js` (modified) — eliminación solo con teclado, axe sobre el menú con "Eliminar" y la confirmación, y la prueba de D7; comentario `:1-3`.
- `pruebas-navegador/anchos.spec.js` (modified) — eliminación en 320, 768, 1280 y 1920 px.
- `pruebas-navegador/rendimiento.spec.js` (modified) — medición de 100 eliminaciones; comentario `:1-4`.

**Logic**
Las pruebas usan los usuarios `accesibilidad`, `anchos` y `rendimiento` de `configuracionGlobal.js`
(D8). Cada prueba carga con la service role los movimientos que elimina, para no depender de lo que
dejaron otras. La medición de rendimiento corre después de las altas y las ediciones del mismo
archivo: lee el saldo real con la service role y espera `/^Página 1 de \d+$/`; elimina siempre el
primer movimiento de la página 1 y mide desde el clic en "Confirmar" hasta que esa fila desaparece y
el saldo muestra el valor esperado.

**Error handling**
- E4-1 — Supabase responde 429 o falta la service role key al preparar los usuarios → la preparación falla con `mensajeLimiteInicios` o `mensajeFaltaClave`, como hoy.

**Required tests**
- [ ] 100 eliminaciones con CPU 4× sobre la cuenta de 5.000 movimientos, medidas desde el clic en "Confirmar" hasta que la lista y el saldo se muestran actualizados: p95 < 2 s — validates AC-09, NFR-01.
- [ ] solo con el teclado se abre el menú de una fila, se elige "Eliminar", se recorren "Cancelar" y "Confirmar" y se confirma, con el foco visible en cada paso — validates AC-13, NFR-04.
- [ ] en 320, 768, 1280 y 1920 px se abre el menú, se ve la confirmación completa y se confirma, sin desplazamiento horizontal — validates AC-14, NFR-05.
- [ ] axe-core sobre el menú abierto con "Eliminar" y sobre la confirmación: 0 violaciones de `color-contrast` — validates AC-15, NFR-06.
- [ ] (D7) con el menú de una fila abierto, un clic en "Añadir Ingreso" cierra el menú y deja el foco en "Añadir Ingreso".
- [ ] (error E4-1) sin clave o con 429, la preparación se detiene con el mensaje correspondiente (prueba existente de `configuracionGlobal.test.js`, sin cambios).
- [ ] las pruebas existentes de alta, edición, sesión, zona horaria, accesibilidad, anchos y rendimiento siguen pasando.

**Completion criterion**
`npm run test:navegador` pasa completo contra el proyecto de Supabase, con el p95 de la eliminación
menor a 2 segundos.

## Rollback

- Base de datos: `supabase/scripts/revertir_eliminacion_movimientos.sql` (Block 1) deshace la función
  y el punto de falla; no borra datos de usuarios. **Se ejecuta antes que
  `revertir_edicion_movimientos.sql`** si alguna vez hay que revertir las dos.
- Código: revertir los commits de la rama. La app anterior no llama a la función nueva, así que
  funciona con la migración aplicada.
- Cuándo aplicarlo: si después del despliegue el saldo de alguna cuenta deja de ser igual a la suma
  de los ingresos menos la suma de los gastos, o si un usuario puede eliminar movimientos ajenos.

## Final verification

- `npm test`, `npm run lint` y `npm run test:navegador` pasan.
- `grep -rn "dangerouslySetInnerHTML\|innerHTML\|eval(" src/` no devuelve resultados.
- `grep -rn "SUPABASE_SERVICE_ROLE_KEY\|SUPABASE_DB_PASSWORD" src/` no devuelve resultados.
- `grep -rni "egreso" src/ supabase/ pruebas/ pruebas-navegador/` no devuelve resultados.
- Con la sesión de un usuario, `rpc('basp_eliminar_movimiento', …)` sobre un movimiento ajeno es
  rechazado y un DELETE directo sobre `bat_movimientos` también.
