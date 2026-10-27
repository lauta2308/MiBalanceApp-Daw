# PRD FEAT-001c: Eliminación de Movimientos

| Field | Value |
|-------|-------|
| Ticket | FEAT-001c |
| Ticket padre | FEAT-001 (Cuenta y Movimientos) |
| Tracker | none |
| Date | 2026-10-25 |
| PRD loops | 3 |

> Sub-ticket de FEAT-001. Deriva de `docs/daw/prd/PRD.md` (PRD-001) y `docs/daw/prd/INTERFAZ.md`.
> Cada requerimiento indica entre paréntesis su origen: `RF-xx` y `RNF-xx` de `PRD.md`, `UI-xx` de
> `INTERFAZ.md`. En los criterios, "origen: PRD AC-xx" señala el criterio original que adapta. Las
> referencias `FR-`, `NFR-` y `AC-` sin prefijo son de este documento.

## Context and Problem

Con FEAT-001a y FEAT-001b el usuario registra y corrige movimientos, pero no puede quitar uno
cargado por error o duplicado: el único recurso es editarlo, lo que deja en la lista un movimiento
que nunca existió. Este sub-ticket permite eliminar un movimiento desde el menú de su fila, con
confirmación, recalculando el saldo de forma atómica.

**Supuestos acordados en DEFINE:**

- S-1: El menú de la fila ya existe (lo crea FEAT-001b con "Editar"); este sub-ticket le agrega la
  opción "Eliminar".

## Goals

- G-1: el usuario elimina un movimiento en 3 interacciones desde la lista (fila → "Eliminar" →
  "Confirmar"), sin poder hacerlo por accidente en 1 sola.
- G-2: después de cada eliminación, el saldo es igual a la suma de los ingresos menos la suma de los
  gastos de la cuenta.

## Functional Requirements

- FR-01 (RF-56, RF-65): El sistema debe mostrar la opción "Eliminar" en el menú de la fila de un movimiento, junto a "Editar", y no ofrecerla en ningún otro lugar.
- FR-02 (RF-67): El sistema debe solicitar confirmación antes de eliminar un movimiento con el mensaje "¿Está seguro que desea eliminar este movimiento?" y las opciones "Confirmar" y "Cancelar".
- FR-03 (RF-66): El sistema debe eliminar el movimiento al elegir "Confirmar".
- FR-04 (RF-67): El sistema debe cerrar la confirmación sin eliminar nada al elegir "Cancelar".
- FR-05 (RF-68): El sistema debe recalcular el saldo de la cuenta al eliminar un movimiento.
- FR-06 (RF-106): El sistema debe deshabilitar el botón "Confirmar" y mostrar "Eliminando…" mientras se procesa la eliminación, sin permitir cerrar la confirmación hasta que termine, de modo que cada confirmación elimine un solo movimiento.
- FR-07 (RF-69, RF-104, UI-14): El sistema debe mostrar "Movimiento eliminado con éxito." con un ícono de tic verde durante 3 segundos al completar la eliminación, cerrándolo solo y sin botón "Aceptar".
- FR-08 (RF-55): El sistema debe mostrar la página 1 de la lista luego de eliminar un movimiento.
- FR-09 (RF-49): El sistema debe mostrar el mensaje "Aquí verá sus movimientos." cuando se elimine el último movimiento de la cuenta.
- FR-10 (RNF-07, RNF-05): El sistema debe mostrar "No se pudo eliminar el movimiento. Vuelva a intentarlo." con el botón "Aceptar" cuando el servidor falle o rechace la eliminación, cerrando la confirmación y dejando el movimiento en la lista y el saldo sin cambios.
- FR-11 (RF-06 a RF-14): El sistema debe mantener el rechazo de FEAT-001a FR-50 a la modificación directa del saldo de la cuenta desde la API, ampliando su excepción a los cambios del saldo que produce la eliminación de movimientos (FR-05).

## Non-Functional Requirements

Condiciones de medición de rendimiento (NFR-01), las de `PRD.md`: cuenta con 5.000 movimientos,
Google Chrome estable con la ralentización de CPU 4× de DevTools, conexión de al menos 10 Mbps con
latencia de hasta 100 ms al servidor, y al menos 100 mediciones por operación.

- NFR-01 (RNF-02): La eliminación de un movimiento debe completarse en menos de 2 segundos (p95), desde que el usuario presiona "Confirmar" hasta que la lista y el saldo se muestran actualizados, bajo las condiciones de medición indicadas.
- NFR-02 (RNF-03): El sistema debe rechazar el 100% de los intentos de eliminar movimientos de otro usuario, verificado con pruebas automatizadas directas contra la API de Supabase.
- NFR-03 (RNF-05): Ante una falla durante la eliminación de un movimiento, el movimiento y el saldo deben quedar exactamente como estaban (0 casos de estado parcial), y en el 100% de los casos el saldo debe ser igual a la suma de los ingresos menos la suma de los gastos de la cuenta.
- NFR-04 (RNF-08): El 100% de las acciones de la eliminación (opción del menú, confirmación y mensajes) deben poder realizarse solo con el teclado, con el foco visible en todo momento.
- NFR-05 (RNF-06): El menú de la fila y la confirmación deben poder usarse sin pérdida de funcionalidad y sin desplazamiento horizontal en anchos de viewport de 320px, 768px, 1280px y 1920px.
- NFR-06 (UI-16): El 100% de los textos de la confirmación y de la opción "Eliminar" deben tener un contraste con su fondo de al menos 4,5:1 (3:1 para texto grande), según WCAG 2.1 AA, verificado con axe-core.

## Acceptance Criteria

**Eliminación**

- AC-01 (FR-01; origen: PRD AC-69): WHEN el usuario A con un movimiento en la lista presiona la fila de ese movimiento, THE sistema SHALL mostrar un menú con las opciones "Editar" y "Eliminar".
- AC-02 (FR-02; origen: PRD AC-71): WHEN el usuario A selecciona "Eliminar" en el menú de un movimiento, THE sistema SHALL mostrar "¿Está seguro que desea eliminar este movimiento?" con las opciones "Confirmar" y "Cancelar".
- AC-03 (FR-03, FR-05, FR-07; origen: PRD AC-68): WHEN el usuario A con saldo USD 5.000,00, que ya incluye un ingreso de 1.000, selecciona "Eliminar" en el menú de ese movimiento y elige "Confirmar", THE sistema SHALL quitar el movimiento de la lista, mostrar el saldo "USD 4.000,00" y el mensaje "Movimiento eliminado con éxito." con un ícono de tic verde, que se cierra solo a los 3 segundos.
- AC-04 (FR-04; origen: PRD AC-71): WHEN el usuario A con saldo USD 5.000,00, que ya incluye un ingreso de 1.000, selecciona "Eliminar" en ese movimiento y elige "Cancelar", THE sistema SHALL cerrar la confirmación, seguir mostrando el movimiento en la lista y mantener el saldo en "USD 5.000,00".
- AC-05 (FR-06; origen: PRD AC-130): WHEN el usuario A con saldo USD 5.000,00, que ya incluye un ingreso de 1.000, selecciona "Eliminar" en ese movimiento y presiona "Confirmar" dos veces seguidas, THE sistema SHALL mostrar el botón deshabilitado con el texto "Eliminando…" mientras se procesa, mantener deshabilitado "Cancelar" y no cerrar la confirmación con la tecla Escape hasta que termine, eliminar solo ese movimiento y mostrar el saldo "USD 4.000,00".
- AC-06 (FR-08; origen: PRD AC-40): WHEN el usuario A con 120 movimientos que está en la página 2 elimina un movimiento de esa página, THE sistema SHALL mostrar la página 1 con el indicador "Página 1 de 3".
- AC-07 (FR-09): WHEN el usuario A con un único movimiento, un gasto de 500, lo elimina y confirma, THE sistema SHALL mostrar el mensaje "Aquí verá sus movimientos." y el saldo "USD 0,00".
- AC-08 (FR-10): IF el servidor falla al eliminar un ingreso de 1.000 del usuario A con saldo USD 5.000,00 (simulado en la prueba), THEN THE sistema SHALL cerrar la confirmación, mostrar "No se pudo eliminar el movimiento. Vuelva a intentarlo." con el botón "Aceptar", seguir mostrando el movimiento en la lista y mantener el saldo en "USD 5.000,00".
- AC-16 (FR-11): IF el usuario A con saldo USD 10.000,00, que ya incluye un gasto de 3.000, elimina ese gasto y confirma, y después intenta desde la API cambiar el saldo de su cuenta a 1000000, THEN THE sistema SHALL aceptar la eliminación con el saldo "USD 13.000,00", rechazar el cambio directo del saldo y seguir mostrando el saldo "USD 13.000,00".

**No funcionales**

- AC-09 (NFR-01; origen: PRD AC-115): WHEN se ejecutan 100 eliminaciones de movimientos sobre una cuenta con 5.000 movimientos bajo las condiciones de medición, THE sistema SHALL completar cada eliminación, desde que se presiona "Confirmar" hasta que la lista y el saldo se muestran actualizados, con un p95 menor a 2 segundos.
- AC-10 (NFR-02; origen: PRD AC-117): IF el usuario A autenticado intenta eliminar mediante la API un movimiento del usuario B usando su identificador, THEN THE sistema SHALL rechazar la operación y el movimiento y el saldo de B SHALL quedar sin cambios.
- AC-11 (NFR-03; origen: PRD AC-123): IF se simula una falla después de eliminar el movimiento y antes de actualizar el saldo al eliminar un gasto de 3.000 del usuario A con saldo USD 10.000,00, THEN THE sistema SHALL seguir mostrando el gasto con "-3.000,00", mantener el saldo en USD 10.000,00 y mostrar un mensaje de error.
- AC-12 (NFR-03; origen: PRD AC-125): WHEN se ejecuta sobre el usuario A con saldo USD 0,00 una secuencia fija, definida en la prueba, de 20 altas, 20 ediciones (10 de ellas con cambio de tipo) y 10 eliminaciones intercaladas, THE sistema SHALL mantener después de cada operación el saldo igual a la suma de los ingresos menos la suma de los gastos de la cuenta.
- AC-13 (NFR-04; adapta PRD AC-133): WHEN el usuario A usa solo el teclado para abrir el menú de la fila de un movimiento, elegir "Eliminar", recorrer "Confirmar" y "Cancelar" y confirmar, THE sistema SHALL permitir completar todas las acciones y distinguir visualmente el elemento con foco en cada paso.
- AC-14 (NFR-05; adapta PRD AC-126): WHEN el usuario A elimina un movimiento con anchos de viewport de 320px, 768px, 1280px y 1920px, THE sistema SHALL permitir en cada ancho abrir el menú, ver la confirmación completa y confirmar, sin desplazamiento horizontal.
- AC-15 (NFR-06; adapta AC-UI-12): WHEN se analizan con axe-core el menú de la fila con la opción "Eliminar" y la confirmación de la eliminación, THE sistema SHALL tener el 100% de los textos con un contraste de al menos 4,5:1 (3:1 para texto grande).

## Out of Scope

- Eliminar varios movimientos a la vez (fuera de alcance de `PRD.md`).
- Papelera, deshacer o recuperación de movimientos eliminados.
- Eliminar la cuenta o restablecerla (RF-15 a RF-21; "Eliminar cuenta" está fuera de alcance de `PRD.md`).
- Todo lo que FEAT-001a y FEAT-001b dejan fuera de alcance.

## Risks and Mitigations

- Riesgo: saldo inconsistente si el movimiento se borra y el saldo no se actualiza → mitigación: la eliminación y el recálculo del saldo se ejecutan en una sola operación atómica en la base de datos, probada con fallas simuladas (NFR-03, AC-11, AC-12).
- Riesgo: eliminación accidental → mitigación: confirmación explícita con "Confirmar"/"Cancelar" y bloqueo del doble clic (FR-02, FR-06).
- Riesgo: un usuario elimina movimientos de otro → mitigación: las políticas de acceso de FEAT-001a, verificadas con pruebas directas contra la API (NFR-02, AC-10).

## Dependencies

- FEAT-001a: cuenta, saldo, lista, paginación y mensajes; el rechazo a la modificación directa del saldo (FR-50), cuya excepción amplía FR-11.
- FEAT-001b: el menú de la fila (S-1) y la operación de edición, que usa la secuencia de AC-12.
- Documentos de producto: `docs/daw/prd/PRD.md` (RF-xx, RNF-xx, AC-xx de origen) y `docs/daw/prd/INTERFAZ.md` (UI-xx).
