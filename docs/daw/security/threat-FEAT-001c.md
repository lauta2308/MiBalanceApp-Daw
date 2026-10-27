# Threat Model FEAT-001c: Eliminación de Movimientos

| Field | Value |
|-------|-------|
| Ticket | FEAT-001c |
| Spec | docs/daw/specs/spec-FEAT-001c.md |
| PRD | docs/daw/prd/prd-FEAT-001c.md |
| Date | 2026-10-27 |
| Método | STRIDE por componente |

> Parte de los threat models de FEAT-001a (`threat-FEAT-001a.md`) y FEAT-001b
> (`threat-FEAT-001b.md`), que siguen vigentes. Aquí se analizan solo los componentes que FEAT-001c
> agrega o modifica. A diferencia del alta y la edición, la eliminación es irreversible: no hay
> papelera ni historial (fuera de alcance del PRD).

## Componentes analizados

| ID | Componente | Dónde se define |
|---|---|---|
| C1 | SPA: opción "Eliminar" de `MenuMovimiento`, `ConfirmacionEliminarMovimiento` y el flujo de `SeccionCuenta` (confirmación, recarga de la página 1, foco) | Spec Block 3 |
| C2 | Servicio `EliminarMovimiento`, que recibe el id del movimiento desde la lista | Spec Block 2 |
| C3 | RPC `BASP_ELIMINAR_MOVIMIENTO` (`SECURITY DEFINER`) | Spec Block 1 |
| C4 | Tablas `BAT_MOVIMIENTOS` y `BAT_CUENTAS`: borrado del movimiento y cambio del saldo en una sola transacción | Spec Block 1 |
| C5 | Esquema `pruebas`: nuevo punto de falla simulada `ELIMINAR_MOVIMIENTO` (ADR-002) | Spec Block 1 |
| C6 | Script de reversión `supabase/scripts/revertir_eliminacion_movimientos.sql` | Spec Block 1 |

El entorno de pruebas (service role key, contraseña de `postgres`, `ayudantesSupabase.js`) no cambia:
FEAT-001c no agrega módulos ni secretos, y sus pruebas usan los ayudantes existentes (R9 de
FEAT-001b sigue vigente).

## Trust boundaries

| ID | Frontera | De → a | Control |
|---|---|---|---|
| TB1 | Internet | Navegador (no confiable) → PostgREST (RPC `basp_eliminar_movimiento`) | HTTPS (TLS 1.2+), JWT firmado por Supabase |
| TB2 | Elevación controlada | Rol `authenticated` → `BASP_ELIMINAR_MOVIMIENTO` ejecutada como `postgres` | `GRANT EXECUTE` solo a `authenticated`, `search_path = ''`, cuenta desde `auth.uid()`, movimiento filtrado por esa cuenta |
| TB3 | Rol de base | PostgREST con rol `authenticated` → tablas `BAT_MOVIMIENTOS` y `BAT_CUENTAS` | Solo `SELECT` (RLS por propietario); sin `DELETE` ni `UPDATE` directos |
| TB4 | Datos del cliente | Id del movimiento tomado de la lista en el navegador (modificable con las herramientas del navegador) → `EliminarMovimiento` y el RPC | Se trata como dato no confiable: forma de UUID en el servicio y filtro por cuenta en la función |

## Clasificación de datos

| Dato | Clasificación | En tránsito | En reposo |
|---|---|---|---|
| Movimiento eliminado (monto, tipo, fecha, categoría) y saldo | Financiero (sensible, personal) | TLS (HTTPS de Supabase) | Cifrado de disco AES-256 de Supabase; el movimiento borrado deja de existir |
| Id del movimiento (uuid) | Identificador seudónimo, no secreto | TLS | No se guarda en el navegador (no hay ruta nueva) |
| JWT de la sesión | Credencial | TLS | `localStorage` (riesgo R6 de FEAT-001a, sin cambios) |

Sin PII nueva: la sesión sigue siendo anónima. Sin credenciales nuevas.

## Análisis STRIDE

| Comp. | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| C1 | R1 | R6, R9 | R7 | R5 | — (estático) | R9 |
| C2 | R1 | R1 | R7 | R5 | R8 | R1 |
| C3 | R1 | R3 | R7 | R5 | R8 | R1, R2 |
| C4 | R1 | R3, R4 | R7 | — (sin lectura nueva) | R8 | R4 |
| C5 | — | R10 | — | R10 | — | R10 |
| C6 | — | R11 | — | R11 | — | R11 |

## Riesgos

| ID | Riesgo | STRIDE | Prob. | Impacto | Mitigación | Estado |
|---|---|---|---|---|---|---|
| R1 | Eliminar el movimiento de otro usuario cambiando el id enviado al RPC (IDOR) | S, T, E | Media | Crítico | `v_id_cuenta` solo desde `auth.uid()`; el movimiento se busca con `id = p_id_movimiento AND id_cuenta = v_id_cuenta`, y si no existe o es ajeno da el mismo `BA404`; `EliminarMovimiento` rechaza ids sin forma de UUID; pruebas AC-10 e id inexistente en `eliminacion.test.js` | Mitigado en spec (Blocks 1 y 2) |
| R2 | Los privilegios por defecto de Supabase dan EXECUTE a `anon` y `service_role` sobre la función nueva | E | Alta (si no se revoca) | Crítico | `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated, service_role` + `GRANT EXECUTE ... TO authenticated`, dueño `postgres`; `seguridad.test.js` verifica EXECUTE para los tres roles y prueba por API `anon` y `service_role` | Mitigado en spec (Block 1) |
| R3 | Saldo inconsistente: falla entre el borrado y el cambio del saldo, o una eliminación concurrente con una edición o con otra eliminación del mismo movimiento | T | Media | Alto | Todo en una función (una transacción); `FOR UPDATE` de la cuenta y después del movimiento, en el mismo orden que el alta y la edición (sin deadlocks); el saldo se ajusta con el tipo y el monto leídos bajo bloqueo; la segunda eliminación concurrente no encuentra la fila y da `BA404`; pruebas AC-11 (falla simulada) y AC-12 (invariante con altas, ediciones y eliminaciones) | Mitigado en spec (Block 1) |
| R4 | Borrar un movimiento directamente por la API (DELETE sobre `bat_movimientos`) sin ajustar el saldo, o cambiar el saldo directamente aprovechando la eliminación (FR-11) | T, E | Baja | Alto | `authenticated` sin `DELETE` ni `UPDATE` sobre las tablas; el saldo solo cambia dentro de las funciones; pruebas AC-16 y las de `seguridad.test.js` (`:170`, `:216`) | Mitigado en spec (Block 1) |
| R5 | Mensajes que exponen detalles internos (códigos `BA404`/`BA500` o texto de PostgREST) | I | Media | Bajo | `EliminarMovimiento` devuelve `{ ok: false }` ante cualquier error; la interfaz muestra solo `mensajeErrorEliminarMovimiento` de `src/mensajes/textos.js` | Mitigado en spec (Blocks 2 y 3) |
| R6 | Eliminación no deseada: un clic accidental o un doble envío que borre dos movimientos | T | Media | Medio | Confirmación explícita con el foco inicial en "Cancelar"; bloqueo del doble envío con `eliminacionEnCurso` y "Eliminando…" con el foco retenido; cada confirmación elimina el id elegido, nunca "el primero"; prueba AC-05 | Mitigado en spec (Block 3) |
| R7 | Una eliminación no deja rastro y no se puede deshacer | R | Baja | Bajo | Los logs de la API de Supabase registran cada llamada al RPC con el usuario; papelera y deshacer están fuera de alcance del PRD; solo se eliminan datos propios, con confirmación | Mitigado (diseño) |
| R8 | Eliminaciones en bucle de un usuario | D | Baja | Bajo | Cada eliminación bloquea solo la cuenta propia y reduce datos; el resto queda cubierto por el riesgo aceptado R8 de FEAT-001a (límites de la API de Supabase) | Mitigado (diseño) |
| R9 | XSS en el menú o en la confirmación | T, E | Baja | Alto | La confirmación muestra solo textos fijos; el menú, el nombre de la categoría escapado por React; la regla `react/no-danger` sigue en error y la verificación final busca `dangerouslySetInnerHTML`, `innerHTML` y `eval(` en `src/` | Mitigado en spec (verificación final) |
| R10 | Activar la falla simulada `ELIMINAR_MOVIMIENTO` para un usuario | T, I, E | Baja | Bajo | El esquema `pruebas` sigue sin acceso para los roles de la API; aunque se activara, solo aborta la eliminación propia | Mitigado en spec (Block 1, ADR-002) |
| R11 | Revertir FEAT-001b antes que FEAT-001c deja `BASP_ELIMINAR_MOVIMIENTO` sin su punto de falla o hace fallar la reversión a mitad de camino | T, I, E | Baja | Medio | `revertir_eliminacion_movimientos.sql` en `BEGIN/COMMIT`, borra antes las filas de `ELIMINAR_MOVIMIENTO` y su encabezado y la sección Rollback de la spec fijan el orden (primero FEAT-001c, después FEAT-001b) | Mitigado en spec (Block 1, Rollback) |

## Análisis de dependencias (W-TM-01)

FEAT-001c no agrega dependencias. Las existentes se siguen revisando con `npm audit` en SAST.

## Mitigaciones a incorporar en la spec

Todas ya están en `docs/daw/specs/spec-FEAT-001c.md`:

1. R1, R3 — Orden de bloqueo cuenta → movimiento, filtro por `id_cuenta` y mismo `BA404` para
   inexistente o ajeno (Block 1, Logic pasos 2 y 4).
2. R2 — `REVOKE` + `GRANT` explícitos y prueba de EXECUTE para los tres roles (Block 1).
3. R4 — Prueba AC-16 y sin permisos nuevos sobre las tablas (Block 1).
4. R5 — `EliminarMovimiento` devuelve `{ ok: false }` sin el error (Block 2).
5. R6 — Foco inicial en "Cancelar" y bloqueo del doble envío (D2, D5, Block 3).
6. R11 — Orden de las reversiones en el script y en la sección Rollback (Block 1).

## Resumen

Riesgos: C:0 abiertos (2 críticos mitigados) · H:0 abiertos (3 altos mitigados) · M:0 abiertos (2
mitigados) · L: todos mitigados. Sin riesgos aceptados nuevos. Resultado: PASSED.
