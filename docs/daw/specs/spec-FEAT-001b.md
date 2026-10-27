# Spec FEAT-001b: Edición de Movimientos

| Field | Value |
|-------|-------|
| Ticket | FEAT-001b |
| PRD | docs/daw/prd/prd-FEAT-001b.md |
| Tier | FEATURE |
| Date | 2026-10-27 |
| Spec loops | 0 |

## Summary

La edición reutiliza la arquitectura de FEAT-001a. En la base de datos, una nueva función atómica
`BASP_EDITAR_MOVIMIENTO` (RPC, `SECURITY DEFINER`) valida igual que el alta, cambia el movimiento sin
tocar `creado_en` y ajusta el saldo restando el efecto anterior y sumando el nuevo, en una sola
transacción. La vista `BAV_MOVIMIENTOS` suma `id_categoria` para precargar el formulario. En el
frontend, cada fila de la lista abre un menú con "Editar", y `FormularioMovimiento` gana un modo
edición en la ruta `/movimientos/:idMovimiento/editar`, con un selector de tipo. Antes, un bloque sin
cambio de comportamiento ordena el código repetido que dejó FEAT-001a.

Decisiones de diseño acordadas en PLAN:
- D1 — Modo edición dentro de `FormularioMovimiento` (prop `modo`: `'alta'` | `'edicion'`), porque ya
  tiene el bloqueo del doble envío, la recarga de categorías por tipo y los mismos campos.
- D2 — De los ayudantes de prueba solo se unifica lo idéntico (cliente de administrador, marca de
  usuario de prueba, texto del error 429); las funciones homónimas que hacen otra cosa se quedan.
- D3 — Las pruebas de navegador de la edición van en los archivos de Playwright existentes, con sus
  usuarios, para no gastar inicios anónimos (límite de ~30 por hora).
- D4 — El monto del campo se carga con `FormatearMonto` (ya convierte `"1500.00"` en `"1.500,00"`).
- D5 — Al volver de la edición, el foco va a la fila del movimiento editado si está en la página 1;
  si no está, a la primera fila de la página 1.

Terminología: la del PRD y el glosario de `AGENTS.md` — movimiento, ingreso, gasto, cuenta, saldo,
categoría, "Pago Realizado", "Pago Ingresado". Nunca "egreso".

## Coverage: PRD → blocks

| Requirement | Covered by |
|---|---|
| FR-01 | Block 4 |
| FR-02 | Block 3 (lectura), Block 4 |
| FR-03 | Block 3 (`FormatearMonto`), Block 4 |
| FR-04 | Block 4 |
| FR-05 | Block 2, Block 4 |
| FR-06 | Block 4 |
| FR-07 | Block 2, Block 4 |
| FR-08 | Block 4 |
| FR-09 | Block 4 |
| FR-10 | Block 4 |
| FR-11 | Block 4 |
| FR-12 | Block 2 |
| FR-13 | Block 2 |
| FR-14 | Block 2 |
| FR-15 | Block 4 |
| FR-16 | Block 4 |
| FR-17 | Block 4 |
| FR-18 | Block 4 |
| FR-19 | Block 4 |
| FR-20 | Block 3 (texto), Block 4 |
| FR-21 | Block 4 |
| FR-22 | Block 3 (`{ ok: false }`), Block 4 |
| FR-23 | Block 4 |
| FR-24 | Block 4 |
| FR-25 | Block 2 |
| NFR-01 | Strategy: una sola llamada RPC por edición, que bloquea solo la cuenta propia y un movimiento por su clave primaria, y una sola recarga de la página 1 con la consulta ya cubierta por `BAIX_MOVIMIENTOS_CUENTA_FECHA`; medido en Block 5 |
| NFR-02 | Strategy: cuenta tomada de `auth.uid()`, movimiento buscado con `id_cuenta = v_id_cuenta`, categoría validada contra esa cuenta y ese tipo, y FK compuesta; probado en Block 2 |
| NFR-03 | Strategy: todo dentro de una función (una transacción) con la falla simulada `EDITAR_MOVIMIENTO` entre el cambio del movimiento y el del saldo; probado en Block 2 |
| NFR-04 | Strategy: elementos nativos (`button`, `input type="radio"`, `select`), menú con `role="menu"` y manejo de flechas, Enter y Escape, foco visible de `estilos.css`; probado en Block 4 y Block 5 |
| NFR-05 | Strategy: menú y formulario en columna con anchos relativos, sin anchos fijos mayores a 320px; probado en Block 5 |
| NFR-06 | Strategy: los colores ya validados en FEAT-001a para texto y botones; probado con axe-core en Block 5 |

## Dependencies between blocks

- Block 1 no depende de ninguno.
- Block 2 depende de Block 1, porque `pruebas/edicion.test.js` usa los ayudantes ya unificados.
- Block 3 depende de Block 1 (`obtenerCliente.js`) y de Block 2 (columna `id_categoria` y RPC `basp_editar_movimiento`).
- Block 4 depende de Block 3.
- Block 5 depende de Block 2 y Block 4.

Orden de ejecución: 1 → 2 → 3 → 4 → 5.

## Block 1 — Refactor de base y comandos del proyecto

Bloque técnico sin FR propio: deja en orden lo que FEAT-001a repitió, antes de que la edición lo
repita una vez más. No cambia el comportamiento de la app ni de las pruebas.

**Files**
- `src/servicios/obtenerCliente.js` (new) — `ObtenerCliente()`: importación dinámica de `./clienteSupabase.js`, con el comentario que hoy está en `src/servicios/cuenta.js:4-6` (por qué es dinámica).
- `src/servicios/cuenta.js` (modified) — importa `ObtenerCliente` y borra su copia y el comentario.
- `src/servicios/movimientos.js` (modified) — importa `ObtenerCliente` y borra su copia.
- `src/servicios/categorias.js` (modified) — importa `ObtenerCliente` y borra su copia.
- `src/servicios/obtenerCliente.test.js` (new) — prueba del módulo.
- `pruebas/utilidades/ayudantesSupabase.js` (new) — `CrearClienteAdministrador({ urlSupabase, claveServicio })` (sin sesión persistida, sin caché propia), `MarcarUsuarioPrueba(clienteAdministrador, idUsuario)` (escribe `app_metadata.es_prueba = true`) y `mensajeLimiteInicios` (texto del error 429). No lee `process.env` ni importa `pg` o `vite` (threat R9).
- `pruebas/utilidades/clientesPrueba.js` (modified) — usa `ayudantesSupabase.js`; conserva su caché del cliente y su lectura de `process.env`.
- `pruebas-navegador/utilidades/fixtures.js` (modified) — usa `ayudantesSupabase.js`; conserva `loadEnv` y su caché. `CargarCategoria` y `ObtenerCuentaUsuario` de ambos archivos quedan como están (hacen cosas distintas).
- `AGENTS.md` (modified) — en "Cómo correr", agregar `npm run lint` y `npm run test:navegador` (aprobado por el usuario en CLASSIFY).

**Logic**
Mover sin cambiar: las firmas públicas de los servicios y de `clientesPrueba.js` / `fixtures.js` no
cambian, así que ninguna prueba ni componente que los importa se toca. Los `vi.mock` existentes
simulan `clienteSupabase.js`, que `obtenerCliente.js` sigue importando con la misma ruta.

**Error handling**
- E1-1 — `clienteSupabase.js` lanza al cargarse (faltan variables de entorno) → `ObtenerCliente()` rechaza la promesa y cada servicio lo sigue convirtiendo en `{ ok: false }`, como hoy.
- E1-2 — `CrearClienteAdministrador` sin `urlSupabase` o sin `claveServicio` → lanza un `Error` con el texto de `mensajeFaltaClave`, antes de crear el cliente.

**Required tests**
- [ ] `ObtenerCliente()` devuelve el `clienteSupabase` simulado.
- [ ] (error E1-1) con `clienteSupabase.js` simulado para lanzar al importarse, `ObtenerCuenta()`, `ObtenerPaginaMovimientos(1)` y `ObtenerCategorias('GASTO')` devuelven `{ ok: false }`.
- [ ] (error E1-2) `CrearClienteAdministrador({ urlSupabase: '', claveServicio: 'x' })` y con `claveServicio` vacía lanzan el error de clave faltante.
- [ ] las suites existentes de `src/`, `pruebas/` y `pruebas-navegador/` pasan sin cambios en sus aserciones.

**Completion criterion**
`npm test` y `npm run lint` pasan; `grep -rn "async function ObtenerCliente" src/servicios` muestra
solo `obtenerCliente.js`, y `src/sesion/sesionAnonima.js` conserva su copia (aislamiento del inicio
anónimo).

## Block 2 — Base de datos: edición atómica

**Files**
- `supabase/migrations/20261027000100_edicion_movimientos.sql` (new) — función, vista y punto de falla.
- `supabase/scripts/revertir_edicion_movimientos.sql` (new) — reversión de esta migración.
- `pruebas/edicion.test.js` (new) — pruebas contra Supabase.
- `pruebas/seguridad.test.js` (modified) — EXECUTE de la función nueva para `anon`, `authenticated` y `service_role`.

**API contract**
- Método + ruta: `POST /rest/v1/rpc/basp_editar_movimiento` (supabase-js: `rpc('basp_editar_movimiento', …)`).
- Request: `p_id_movimiento uuid`, `p_tipo text` (`'INGRESO' | 'GASTO'`), `p_monto numeric` (enviado como texto `"1500.00"`, ADR-001), `p_id_categoria uuid`, `p_fecha date` (`"AAAA-MM-DD"`).
- Response: `uuid` — el id del movimiento editado.
- Error codes: `BA401` sin sesión; `BA404` el usuario no tiene cuenta, o el movimiento no existe o es de otra cuenta (mismo código, no revela si existe); `BA400` falta un dato o tipo inválido; `BA422` monto NaN, ≤ 0, > 999.999.999.999,99 o con más de dos decimales; `BA423` fecha posterior a mañana en UTC; `BA424` categoría inexistente, de otra cuenta o de otro tipo; `BA500` falla simulada.
- Auth: JWT de Supabase con rol `authenticated`. `EXECUTE` revocado a `PUBLIC`, `anon`, `authenticated` y `service_role`, y concedido solo a `authenticated`. Dueño `postgres`, `SECURITY DEFINER`, `SET search_path = ''`.

**Data model**
- Sin tablas ni columnas nuevas. `BAT_MOVIMIENTOS` se actualiza en `tipo`, `monto`, `id_categoria` y `fecha`; `creado_en`, `id` e `id_cuenta` no cambian. Las restricciones existentes siguen aplicando: `BACK_MOVIMIENTOS_TIPO`, `BACK_MOVIMIENTOS_MONTO_POSITIVO`, `BACK_MOVIMIENTOS_MONTO_MAXIMO`, FK compuesta `BAFK_MOVIMIENTOS_CATEGORIA (id_categoria, id_cuenta, tipo)`.
- `pruebas.BAT_FALLAS_SIMULADAS`: `BACK_FALLAS_SIMULADAS_PUNTO` pasa a `CHECK (punto IN ('AGREGAR_MOVIMIENTO', 'EDITAR_MOVIMIENTO'))` (DROP + ADD CONSTRAINT). PK `id_usuario` sin cambios.
- `BAV_MOVIMIENTOS`: `CREATE OR REPLACE VIEW public.BAV_MOVIMIENTOS WITH (security_invoker = true)` con las mismas columnas en el mismo orden y `m.id_categoria` (uuid, no nulo) al final, después de `creado_en`. Conserva sus permisos (`SELECT` para `authenticated`).
- Índices: ninguno nuevo; la búsqueda del movimiento usa `BAPK_MOVIMIENTOS`.

**Logic**
`BASP_EDITAR_MOVIMIENTO`, en este orden:
1. `v_id_usuario := auth.uid()`; nulo → `BA401`.
2. Cuenta del usuario con `FOR UPDATE` (mismo orden de bloqueo que el alta: primero la cuenta) → `v_id_cuenta`; sin cuenta → `BA404`.
3. Validaciones de los parámetros, en el mismo orden y con los mismos códigos que `BASP_AGREGAR_MOVIMIENTO`, más `p_id_movimiento` no nulo (`BA400`).
4. Movimiento: `SELECT tipo, monto INTO v_tipo_anterior, v_monto_anterior FROM public.BAT_MOVIMIENTOS WHERE id = p_id_movimiento AND id_cuenta = v_id_cuenta FOR UPDATE`; sin fila → `BA404`.
5. Categoría: debe existir con `id_cuenta = v_id_cuenta AND tipo = p_tipo` → si no, `BA424`.
6. `UPDATE public.BAT_MOVIMIENTOS SET tipo = p_tipo, monto = p_monto, id_categoria = p_id_categoria, fecha = p_fecha WHERE id = p_id_movimiento`.
7. Falla simulada `EDITAR_MOVIMIENTO` (ADR-002) → `BA500`.
8. Un solo `UPDATE public.BAT_CUENTAS SET saldo = saldo - v_efecto_anterior + v_efecto_nuevo`, donde cada efecto (variables `numeric`) es `+monto` para un ingreso y `-monto` para un gasto. Sin piso: el saldo puede quedar negativo.
9. `RETURN p_id_movimiento`.

Permisos: el patrón de la migración anterior (`REVOKE EXECUTE … FROM PUBLIC, anon, authenticated,
service_role` y `GRANT EXECUTE … TO authenticated`). `service_role` sigue sin UPDATE sobre
`bat_movimientos`: las pruebas editan solo por el RPC, con la sesión del usuario.

Reversión (`revertir_edicion_movimientos.sql`), dentro de `BEGIN/COMMIT` (threat R14):
1. `DELETE FROM pruebas.BAT_FALLAS_SIMULADAS WHERE punto = 'EDITAR_MOVIMIENTO'`.
2. Restaurar `BACK_FALLAS_SIMULADAS_PUNTO` a `IN ('AGREGAR_MOVIMIENTO')`.
3. `DROP FUNCTION public.BASP_EDITAR_MOVIMIENTO(uuid, text, numeric, uuid, date)`.
4. `DROP VIEW` + `CREATE VIEW public.BAV_MOVIMIENTOS WITH (security_invoker = true)` sin `id_categoria`, con `REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role` y `GRANT SELECT … TO authenticated`.
5. Instrucción de `supabase migration repair --status reverted 20261027000100` en el encabezado. No toca la reversión de FEAT-001a, que nunca se ejecuta en esta base (borra cuentas reales).

**Input validation**
- `p_id_movimiento`: uuid no nulo; debe pertenecer a la cuenta de la sesión.
- `p_tipo`: `'INGRESO'` o `'GASTO'`.
- `p_monto`: numeric, no NaN, > 0, ≤ 999999999999.99, como máximo 2 decimales (se rechaza el tercero antes de que `numeric(14,2)` redondee).
- `p_id_categoria`: uuid de una categoría de la cuenta de la sesión y del tipo `p_tipo`.
- `p_fecha`: date, ≤ mañana en UTC (RF-107); sin mínimo; se guarda tal cual.

**Error handling**
- E2-1 — Sin sesión → `BA401`.
- E2-2 — Movimiento inexistente o de otra cuenta → `BA404`; nada cambia.
- E2-3 — Monto inválido (0, -50, 1000000000000.00, 10.555) → `BA422`; nada cambia.
- E2-4 — Fecha dos días posterior a hoy en UTC → `BA423`; nada cambia.
- E2-5 — Categoría de otro tipo o de otro usuario → `BA424`; nada cambia.
- E2-6 — Falla simulada entre el cambio del movimiento y el del saldo → `BA500` y se revierte la transacción entera.
- E2-7 — Cambio directo del saldo desde la API con la sesión del usuario → rechazado por falta de permisos (FR-25).
- E2-8 — Llamada al RPC como `anon` o `service_role` → rechazada por falta de EXECUTE.

**Required tests**
Todas en `pruebas/edicion.test.js` salvo indicación; usuarios anónimos marcados con `es_prueba`.
- [ ] editar por RPC un gasto de 3.000 en "Transporte" (saldo 10.000) a 2000, "Mercado" y otra fecha deja el movimiento con esos valores y el saldo en 11.000 — validates AC-04 (API).
- [ ] cambiar a ingreso con "Pago Ingresado" un gasto de 3.000 (saldo 10.000) deja saldo 16.000; con "Sueldo", igual — validates AC-05, AC-07 (API), FR-07.
- [ ] editar a la fecha 1990-03-15 sin cambiar el monto deja el saldo igual — validates AC-30 (API).
- [ ] `creado_en` leído por la conexión directa es el mismo antes y después de editar, y el orden de la lista por `fecha desc, creado_en desc` no cambia — validates AC-12 (API), FR-13.
- [ ] (error E2-3, E2-5) editar con monto 0, -50, 1000000000000.00, 10.555 y con la categoría de ingresos "Sueldo" para un gasto: las cinco rechazadas, movimiento y saldo sin cambios — validates AC-13.
- [ ] (error E2-4) editar con fecha dos días posterior a hoy en UTC: rechazada, sin cambios — validates AC-14.
- [ ] (error E2-2) el usuario A edita un movimiento del usuario B por su id: rechazada, el movimiento y el saldo de B sin cambios — validates AC-23.
- [ ] (error E2-2) un id inexistente devuelve el mismo código que un id ajeno.
- [ ] (error E2-5) el usuario A asigna a su movimiento una categoría de B: rechazada, los saldos de A y de B sin cambios — validates AC-24.
- [ ] (error E2-6) con la falla `EDITAR_MOVIMIENTO` activa, editar a 2000 un gasto de 3.000 y, en otro intento, cambiarlo a ingreso: ambos fallan con `BA500`, el gasto sigue en 3.000 y el saldo en 10.000 — validates AC-25 (API).
- [ ] secuencia fija de 20 altas y 20 ediciones intercaladas (10 con cambio de tipo) desde saldo 0: después de cada operación, saldo = suma de ingresos − suma de gastos — validates AC-26.
- [ ] (error E2-7) después de editar a 2000 un gasto de 3.000 (saldo 11.000), un UPDATE directo del saldo a 1000000 con la sesión del usuario es rechazado y el saldo sigue en 11.000 — validates AC-33.
- [ ] (error E2-1) llamar al RPC sin sesión: rechazado.
- [ ] (error E2-8, en `seguridad.test.js`) `anon` y `service_role` no tienen EXECUTE sobre `basp_editar_movimiento(uuid, text, numeric, uuid, date)` y `authenticated` sí; la vista sigue sin devolver movimientos ajenos y conserva `security_invoker`.
- [ ] la vista `bav_movimientos` devuelve `id_categoria` del movimiento propio.

**Completion criterion**
La migración se aplica con `npx supabase db push`; `npx vitest run pruebas/edicion.test.js
pruebas/seguridad.test.js` pasa contra el proyecto de Supabase.

## Block 3 — Servicios y textos

**Files**
- `src/servicios/movimientos.js` (modified) — `ObtenerMovimiento(idMovimiento)` y `EditarMovimiento({ idMovimiento, tipo, monto, idCategoria, fecha })`.
- `src/servicios/movimientos.test.js` (modified) — la simulación de `from()` suma `.eq` y `.maybeSingle`, y la de `rpc` responde según el nombre de la función.
- `src/mensajes/textos.js` (modified) — `mensajeMovimientoActualizado = 'Movimiento actualizado con éxito.'`.

**API contract**
- Lectura: `GET /rest/v1/bav_movimientos?select=id,fecha,tipo,monto,id_categoria&id=eq.{idMovimiento}` (supabase-js `.from('bav_movimientos').select(...).eq('id', idMovimiento).maybeSingle()`). Respuesta: `{ id: uuid, fecha: "AAAA-MM-DD", tipo: 'INGRESO' | 'GASTO', monto: "1500.00", id_categoria: uuid }` o `null`. Auth: rol `authenticated`, filtrado por la RLS.
- Edición: el RPC de Block 2.
- Contrato de los servicios: `ObtenerMovimiento` → `{ ok: true, movimiento }` o `{ ok: false }`; `EditarMovimiento` → `{ ok: true }` o `{ ok: false }`. Nunca exponen el error de Supabase (threat R5).

**Logic**
- `ObtenerMovimiento`: si `idMovimiento` no tiene forma de uuid, devuelve `{ ok: false }` sin consultar. La `fecha` se devuelve como texto, nunca con `new Date(fecha)`.
- `EditarMovimiento`: `rpc('basp_editar_movimiento', { p_id_movimiento, p_tipo, p_monto: ConvertirMontoParaApi(monto), p_id_categoria, p_fecha })`.

**Input validation**
- `idMovimiento`: string con formato uuid (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`); llega de la URL y se trata como no confiable.
- `monto`: texto del campo ya validado por `ValidarMonto`; se convierte con `ConvertirMontoParaApi`.
- `tipo`, `idCategoria`, `fecha`: los del formulario; los valida el servidor.

**Error handling**
- E3-1 — `idMovimiento` mal formado → `{ ok: false }` sin consultar.
- E3-2 — La lectura devuelve `null` (inexistente o ajeno) → `{ ok: false }`.
- E3-3 — Error de Supabase o excepción en la lectura (incluida la falta de variables de entorno) → `{ ok: false }`.
- E3-4 — Error del RPC de edición (cualquier código `BA4xx` o `BA500`), respuesta sin `data` o excepción → `{ ok: false }`.

**Required tests**
- [ ] `ObtenerMovimiento` con un id válido consulta `bav_movimientos` con `eq('id', …)` y devuelve el movimiento con `monto` `"1500.00"` y `fecha` `"2026-09-17"` como texto — validates FR-02.
- [ ] `FormatearMonto("1500.00")` devuelve `"1.500,00"` (sin signo) — validates FR-03.
- [ ] `EditarMovimiento` con monto `"2.000"` llama al RPC con `p_monto: "2000.00"` y los demás parámetros, y devuelve `{ ok: true }`.
- [ ] (error E3-1) `ObtenerMovimiento('abc')` devuelve `{ ok: false }` sin llamar a Supabase.
- [ ] (error E3-2) con `data: null` devuelve `{ ok: false }`.
- [ ] (error E3-3) con un error de Supabase (código `22P02`) y con una excepción devuelve `{ ok: false }` sin el texto del error.
- [ ] (error E3-4) con el RPC respondiendo `BA500`, `BA422` o una excepción, `EditarMovimiento` devuelve `{ ok: false }` — validates FR-22 (servicio).
- [ ] `mensajeMovimientoActualizado` es "Movimiento actualizado con éxito." — validates FR-20 (texto).

**Completion criterion**
`npx vitest run src/servicios src/utilidades src/mensajes` pasa.

## Block 4 — Interfaz: menú de la fila y formulario de edición

**Files**
- `src/componentes/MenuMovimiento.jsx` (new) — menú `role="menu"` con un `role="menuitem"` "Editar"; se abre debajo de la fila; Escape o un clic afuera lo cierran y devuelven el foco al botón de la fila; al abrirse, el foco va a "Editar".
- `src/componentes/ListaMovimientos.jsx` (modified) — cada fila es un `button` (`aria-haspopup="menu"`, `aria-expanded`, `data-id-movimiento`) dentro del `li`, con la categoría y el monto; un solo menú abierto a la vez; prop `alEditar(idMovimiento)`.
- `src/componentes/SelectorTipo.jsx` (new) — grupo de radios "Gasto" / "Ingreso" con leyenda "Tipo"; props `tipo`, `alCambiar`, `deshabilitado`.
- `src/paginas/FormularioMovimiento.jsx` (modified) — prop `modo` (`'alta'` | `'edicion'`) e `idMovimiento`; en edición: título "Editar Movimiento", carga del movimiento, `SelectorTipo`, mensaje de éxito propio y vuelta a Cuenta con `{ pagina: 1, idMovimientoEditado }`.
- `src/App.jsx` (modified) — ruta `/movimientos/:idMovimiento/editar` con `key={ubicacion.key}`, que lee el parámetro y monta `FormularioMovimiento` en modo edición; se actualiza el comentario de cabecera.
- `src/paginas/SeccionCuenta.jsx` (modified) — pasa `alEditar` a la lista (navega a la ruta de edición); al volver con `idMovimientoEditado`, enfoca esa fila si está en la página 1 o la primera fila si no está (D5), y después quita la clave del estado de la navegación, como ya hace con `tipoFormulario`.
- `src/estilos.css` (modified) — estilos de la fila como botón, del menú y del selector de tipo, con foco visible.
- `src/componentes/MenuMovimiento.test.jsx`, `src/componentes/SelectorTipo.test.jsx` (new).
- `src/componentes/ListaMovimientos.test.jsx`, `src/paginas/SeccionCuenta.test.jsx`, `src/paginas/FormularioMovimiento.test.jsx` (modified) — pruebas nuevas y actualización de las consultas de filas que cambian con el botón (`ListaMovimientos.test.jsx:26,44,60,102`; `SeccionCuenta.test.jsx:202,217,237,245,260,267,291,361,399`; `FormularioMovimiento.test.jsx:449,472,492,664,731,739`). La simulación de Supabase de `FormularioMovimiento.test.jsx:31-55` responde a la lectura por id y al RPC de edición.

**Logic**
- Modo alta: sin cambios.
- Modo edición, al montarse: `ObtenerMovimiento(idMovimiento)` → estado inicial `monto = FormatearMonto(movimiento.monto)`, `fecha = movimiento.fecha`, `tipo = movimiento.tipo`, `idCategoria = movimiento.id_categoria`. Las categorías se cargan por el `tipo` del estado (el efecto ya depende de `tipo`). En la primera carga se conserva la categoría del movimiento; cuando el usuario cambia el tipo, se elige la por defecto del nuevo tipo (FR-08) y el monto no cambia (FR-07). "Guardar" queda deshabilitado hasta que el movimiento y las categorías estén cargados.
- "Guardar" en edición: `ValidarMonto` → `EditarMovimiento` con el mismo bloqueo de doble envío (`envioEnCurso`, "Guardando…", campos deshabilitados, flecha y "Cancelar" deshabilitados) → éxito: `MostrarExito(mensajeMovimientoActualizado)` y navegar a `/` con `{ pagina: 1, idMovimientoEditado }`.
- "Cancelar" y la flecha en edición: navegan a `/` con `{ idMovimientoEditado }` sin guardar; cada apertura monta el formulario de nuevo y lee los valores guardados (FR-02).
- El formulario de edición no tiene ninguna opción para eliminar (FR-18).

**Input validation**
- Monto: el mismo `CampoMonto` del alta (filtro al escribir y al pegar, 2 decimales, separador de miles) y `ValidarMonto` antes de enviar.
- Tipo: solo `'GASTO'` o `'INGRESO'`, con uno siempre seleccionado.
- Categoría: una de las categorías del tipo seleccionado; siempre una seleccionada.
- Fecha: el mismo `SelectorFecha` (DD/MM/AAAA, en español, semana desde el lunes, días posteriores a hoy deshabilitados, sin mínimo).
- `idMovimiento` de la URL: lo valida `ObtenerMovimiento` (Block 3).

**Error handling**
- E4-1 — Monto vacío o 0 → "El monto debe ser mayor a 0." con "Aceptar"; no se envía; al aceptar, foco en "Monto".
- E4-2 — Monto mayor al máximo → "El monto máximo es 999.999.999.999,99."; no se envía.
- E4-3 — `EditarMovimiento` devuelve `{ ok: false }` (incluida la falla simulada) → "No se pudo guardar el movimiento. Vuelva a intentarlo." con "Aceptar"; el formulario sigue abierto con los datos ingresados; la lista y el saldo no cambian (FR-22).
- E4-4 — `ObtenerMovimiento` devuelve `{ ok: false }` (id mal formado, inexistente, ajeno o falla de red) → "No se pudieron cargar sus movimientos. Vuelva a intentarlo." con "Aceptar", que vuelve a Cuenta.
- E4-5 — Falla la carga de categorías → el mismo mensaje con "Aceptar" que reintenta, como en el alta; "Guardar" deshabilitado.
- E4-6 — Doble clic en "Guardar" → el segundo se ignora (FR-19).

**Required tests**
- [ ] presionar la fila con clic, con toque (evento de puntero) y con Enter abre un menú con "Editar" — validates AC-01.
- [ ] el menú se cierra con Escape y el foco vuelve a la fila; abrir el menú de otra fila cierra el anterior.
- [ ] elegir "Editar" en un gasto de 1.500 en "Mercado" del 17/09/2026 abre el formulario con "1.500,00" sin signo, "Mercado" y 17/09/2026 — validates AC-02.
- [ ] en un gasto, el selector de tipo muestra "Gasto" e "Ingreso" con "Gasto" seleccionado — validates AC-03.
- [ ] editar a 2000, "Mercado" y 16/09/2026 un gasto de 3.000 en "Transporte" llama a `EditarMovimiento` con esos valores, muestra "Movimiento actualizado con éxito." con el tic verde, y Cuenta muestra el movimiento bajo 16/09/2026 con "-2.000,00" y "USD 11.000,00" — validates AC-04.
- [ ] cambiar el tipo a "Ingreso" sin elegir categoría envía "Pago Ingresado" y Cuenta muestra "+3.000,00" y "USD 16.000,00" — validates AC-05.
- [ ] al seleccionar "Ingreso", la categoría pasa a "Pago Ingresado" y el selector muestra solo "Pago Ingresado", "Alquiler" y "Sueldo", en ese orden — validates AC-06.
- [ ] cambiar a "Ingreso" y elegir "Sueldo" envía "Sueldo"; Cuenta muestra "+3.000,00" y "USD 16.000,00" — validates AC-07.
- [ ] el calendario de un movimiento del 17/09/2026 lo muestra preseleccionado y los días posteriores a hoy deshabilitados — validates AC-08.
- [ ] (error E4-1) monto 0 y monto vacío: no llama a `EditarMovimiento`, muestra "El monto debe ser mayor a 0." con "Aceptar", la lista sigue con "-3.000,00" y el saldo con "USD 10.000,00" — validates AC-09.
- [ ] (error E4-2) 1.000.000.000.000,00 muestra "El monto máximo es 999.999.999.999,99." y no se envía — validates AC-10.
- [ ] en el campo de monto de la edición, "-50", "abc50", "10,555" y "1500000" muestran "50", "50", "10,55" y "1.500.000" — validates AC-11.
- [ ] después de editar el monto de "Café", "Mercado" (dado de alta después) sigue antes que "Café" en el grupo 01/10/2026 (servicios simulados con el orden del servidor) — validates AC-12.
- [ ] "Cancelar" con el monto cambiado a 2000 no llama a `EditarMovimiento`; Cuenta muestra "-3.000,00" y "USD 10.000,00" — validates AC-15.
- [ ] la flecha con el monto cambiado vuelve a Cuenta sin guardar, con "-3.000,00" y "USD 10.000,00" — validates AC-16.
- [ ] después de descartar con "Cancelar" y, en otro intento, con la flecha, reabrir muestra "3.000,00" y "Mercado" — validates AC-17.
- [ ] el formulario de edición muestra "Guardar" y ninguna opción para eliminar — validates AC-18.
- [ ] (error E4-6) dos clics seguidos en "Guardar" llaman una sola vez a `EditarMovimiento`; mientras tanto el botón dice "Guardando…" y no se puede editar ni cerrar; Cuenta muestra "USD 11.000,00" — validates AC-19.
- [ ] con 120 movimientos y la página 2 abierta, editar y guardar vuelve a la página 1 con "Página 1 de 3" y el mensaje, que se cierra a los 3 segundos — validates AC-20.
- [ ] (error E4-3) con `EditarMovimiento` en `{ ok: false }`, muestra "No se pudo guardar el movimiento. Vuelva a intentarlo." con "Aceptar", el formulario conserva "2.000", la lista sigue con "-3.000,00" y el saldo con "USD 10.000,00" — validates AC-21, AC-25 (interfaz).
- [ ] elegir 15/03/1990 envía `"1990-03-15"`; Cuenta muestra el grupo "15/03/1990" y "USD 10.000,00" — validates AC-30.
- [ ] pegar "$ 1.500,50" en el monto vacío y después "abc" muestra "1.500,50" en ambos casos — validates AC-31.
- [ ] el 03/10/2026, en un gasto del 17/09/2026, el campo "Fecha" muestra "17/09/2026" y el calendario de septiembre de 2026 en español con la semana desde el lunes — validates AC-32.
- [ ] (error E4-4) con `ObtenerMovimiento` en `{ ok: false }`, muestra "No se pudieron cargar sus movimientos. Vuelva a intentarlo." y "Aceptar" vuelve a Cuenta.
- [ ] (error E4-5) con `ObtenerCategorias` en `{ ok: false }`, muestra el mismo mensaje y "Guardar" sigue deshabilitado.
- [ ] al volver de editar, el foco queda en la fila editada si está en la página 1 y, si no está, en la primera fila; una recarga no vuelve a forzar el foco.
- [ ] con solo el teclado (Tab, Enter, flechas, Espacio y Escape) se abre el menú, se elige "Editar", se cambia el tipo, la categoría, la fecha y el monto, y se guarda — validates AC-27 (unidad).

**Completion criterion**
`npx vitest run --project unitarias` pasa todas las pruebas de `src/`; con `npm run dev` contra el
proyecto de Supabase, un gasto se edita desde el menú de su fila y el saldo y la lista se actualizan.

## Block 5 — Pruebas en navegador

**Files**
- `pruebas-navegador/rendimiento.spec.js` (modified) — medición de 100 ediciones sobre el usuario con 5.000 movimientos; el selector `.fila-movimiento` (`:78`) pasa al botón de la fila.
- `pruebas-navegador/accesibilidad.spec.js` (modified) — recorrido de la edición solo con teclado y análisis axe del menú y del formulario de edición; actualización de las consultas de filas (`:152,156,264`).
- `pruebas-navegador/anchos.spec.js` (modified) — edición en 320, 768, 1280 y 1920 px; actualización de las consultas de filas (`:155,161,180`).
- `pruebas-navegador/sesion.spec.js` (modified) — consulta de filas (`:26`).
- `pruebas-navegador/zonaHoraria.spec.js` (modified) — consulta de filas (`:41`).

**Logic**
Las pruebas de la edición usan los usuarios que ya prepara `configuracionGlobal.js` para cada archivo
(D3): no se agregan nombres a `nombresUsuarios` ni inicios anónimos. La medición de rendimiento corre
dentro de `rendimiento.spec.js`, sobre el usuario que ya tiene 5.000 movimientos.

**Error handling**
- E5-1 — Supabase responde 429 (límite de inicios anónimos) al preparar los usuarios → la preparación falla con `mensajeLimiteInicios`, como hoy.
- E5-2 — Falta la service role key en `.env.pruebas.local` → la preparación falla con `mensajeFaltaClave`, como hoy.

**Required tests**
- [ ] 100 ediciones con CPU 4× sobre 5.000 movimientos, medidas desde el clic en "Guardar" hasta que la lista y el saldo se muestran actualizados: p95 < 2 s — validates AC-22, NFR-01.
- [ ] solo con el teclado se abre el menú de una fila, se elige "Editar", se cambian el tipo, la categoría, la fecha y el monto y se guarda, con el foco visible en cada paso — validates AC-27, NFR-04.
- [ ] en 320, 768, 1280 y 1920 px se abre el menú, se completa la edición y se guarda, sin desplazamiento horizontal — validates AC-28, NFR-05.
- [ ] axe-core sobre el menú abierto y sobre el formulario de edición con el selector de tipo, el de categoría y el calendario abiertos: 0 violaciones de contraste — validates AC-29, NFR-06.
- [ ] (error E5-1, E5-2) sin clave o con 429, la preparación se detiene con el mensaje correspondiente (prueba existente de `configuracionGlobal.test.js`, sin cambios).
- [ ] las pruebas existentes de sesión, zona horaria, accesibilidad, anchos y rendimiento siguen pasando con las filas como botón.

**Completion criterion**
`npm run test:navegador` pasa completo contra el proyecto de Supabase, con el p95 de la edición
menor a 2 segundos.

## Rollback

- Base de datos: `supabase/scripts/revertir_edicion_movimientos.sql` (Block 2) deshace la función, la
  columna de la vista y el punto de falla, y deja los permisos como estaban; no borra datos de usuarios.
- Código: revertir los commits de la rama. Si la migración ya se aplicó, la app anterior sigue
  funcionando con la vista nueva, porque pide sus columnas por nombre.
- Cuándo aplicarlo: si después del despliegue el saldo de alguna cuenta deja de ser igual a la suma
  de los ingresos menos la suma de los gastos, o si un usuario puede leer o editar movimientos ajenos.

## Final verification

- `npm test`, `npm run lint` y `npm run test:navegador` pasan.
- `grep -rn "dangerouslySetInnerHTML\|innerHTML\|eval(" src/` no devuelve resultados (threat R12).
- `grep -rn "SUPABASE_SERVICE_ROLE_KEY\|SUPABASE_DB_PASSWORD" src/` no devuelve resultados y
  `pruebas/utilidades/ayudantesSupabase.js` no lee `process.env` (threat R9).
- `grep -rni "egreso" src/ supabase/ pruebas/ pruebas-navegador/` no devuelve resultados.
- Con la sesión de un usuario, `rpc('basp_editar_movimiento', …)` sobre un movimiento ajeno es
  rechazado y la vista `bav_movimientos` solo devuelve movimientos propios.
