# PRD FEAT-001b: Edición de Movimientos

| Field | Value |
|-------|-------|
| Ticket | FEAT-001b |
| Ticket padre | FEAT-001 (Cuenta y Movimientos) |
| Tracker | none |
| Date | 2026-10-25 |
| PRD loops | 3 |

> Sub-ticket de FEAT-001. Deriva de `docs/daw/prd/PRD.md` (PRD-001) y `docs/daw/prd/INTERFAZ.md`.
> Cada requerimiento indica entre paréntesis su origen: `RF-xx` y `RNF-xx` de `PRD.md`, `UI-xx` de
> `INTERFAZ.md`. En los criterios, "origen: PRD AC-xx" o "origen: AC-UI-xx" señala el criterio
> original que adapta. Las referencias `FR-`, `NFR-` y `AC-` sin prefijo son de este documento;
> "FEAT-001a FR-xx" remite al PRD de FEAT-001a.

## Context and Problem

Con FEAT-001a el usuario registra gastos e ingresos y ve su saldo, pero un error de carga (un monto,
una categoría, una fecha o el tipo equivocados) solo se corrige hoy registrando un movimiento
compensatorio, lo que ensucia la lista y los futuros reportes por categoría. Este sub-ticket
permite editar un movimiento existente desde la lista, recalculando el saldo de forma atómica.

**Supuestos acordados en DEFINE:**

- S-1: Igual que en FEAT-001a, las categorías propias que usan los criterios ("Mercado",
  "Transporte", "Sueldo") se cargan directamente en la base de datos por la prueba.
- S-2: El menú de la fila nace en este sub-ticket con la opción "Editar". FEAT-001c le agrega la
  opción "Eliminar".

## Goals

- G-1: el usuario corrige el monto, la categoría, la fecha o el tipo de un movimiento desde la
  lista, sin registrar un movimiento compensatorio.
- G-2: después de cada edición, el saldo es igual a la suma de los ingresos menos la suma de los
  gastos de la cuenta.

## Functional Requirements

**Acceso a la edición**

- FR-01 (RF-56, RF-57): El sistema debe mostrar un menú con la opción "Editar" al presionar (con un toque, un clic o el teclado) la fila de un movimiento en la lista, y abrir el formulario de edición de ese movimiento al elegir "Editar".
- FR-02 (RF-90): El sistema debe mostrar el formulario de edición con los valores guardados del movimiento, sin conservar los cambios descartados con "Cancelar" o con la flecha para volver atrás.
- FR-03 (UI-11, UI-10): El sistema debe mostrar el monto en el formulario de edición sin signo, con dos decimales, punto como separador de miles y coma decimal (ej. "1.500,00").
- FR-04 (RF-62): El sistema debe preseleccionar en el calendario la fecha registrada del movimiento.

**Edición**

- FR-05 (RF-58): El sistema debe permitir editar el monto, la categoría y la fecha de un movimiento.
- FR-06 (RF-60): El sistema debe mostrar en el formulario de edición un selector de tipo con las opciones "Gasto" e "Ingreso", con el tipo registrado del movimiento seleccionado.
- FR-07 (RF-59): El sistema debe permitir cambiar el tipo de un movimiento de gasto a ingreso o de ingreso a gasto, conservando su monto.
- FR-08 (RF-61): El sistema debe asignar la categoría por defecto del nuevo tipo ("Pago Ingresado" o "Pago Realizado") al cambiar el tipo, salvo que el usuario elija otra categoría de ese tipo.
- FR-09 (RF-32, RF-39, RF-40): El sistema debe mostrar en el selector de categoría del formulario de edición solo las categorías del tipo seleccionado, siempre con una seleccionada y en el mismo orden que el alta (FEAT-001a FR-17).
- FR-10 (RF-33, RF-37, RF-38, RF-108): El sistema debe mostrar en el formulario de edición el mismo calendario que el alta: solo fecha, siempre con una fecha seleccionada, sin fecha mínima y con los días posteriores a hoy (fecha local del dispositivo) deshabilitados.
- FR-11 (RF-41, RF-42, RF-43, RF-44, UI-04): El sistema debe aplicar al monto del formulario de edición las mismas reglas que el alta: rechazar el monto vacío o no mayor a 0 ("El monto debe ser mayor a 0."), rechazar montos mayores a 999.999.999.999,99 ("El monto máximo es 999.999.999.999,99."), aceptar solo dígitos y una coma decimal, impedir más de dos decimales y agregar el separador de miles al escribir.
- FR-12 (RF-63): El sistema debe recalcular el saldo de la cuenta al editar el monto o el tipo de un movimiento.
- FR-13 (RF-48): El sistema debe conservar el momento del alta de un movimiento al editarlo, de modo que su orden dentro de una misma fecha no cambie.
- FR-14 (RF-39, RF-41, RF-42, RF-43, RF-107): El sistema debe rechazar desde la API la edición de un movimiento con monto no mayor a 0, mayor a 999.999.999.999,99 o con más de dos decimales, con una categoría de otro tipo, o con fecha posterior a la de mañana en UTC, sin modificar el movimiento ni el saldo.
- FR-23 (RF-44): El sistema debe aplicar al texto pegado en el campo de monto del formulario de edición el mismo filtro que el alta (FEAT-001a FR-27): solo se conservan los dígitos y la primera coma.
- FR-24 (RF-37, UI-05): El sistema debe mostrar en el formulario de edición el campo "Fecha" con el formato DD/MM/AAAA y el calendario en español con la semana de lunes a domingo, igual que el alta (FEAT-001a FR-48).
- FR-25 (RF-06 a RF-14): El sistema debe mantener el rechazo de FEAT-001a FR-50 a la modificación directa del saldo de la cuenta desde la API, ampliando su excepción a los cambios del saldo que produce la edición de movimientos (FR-12).

**Formulario**

- FR-15 (RF-64): El sistema debe permitir cerrar el formulario de edición sin guardar cambios con la opción "Cancelar".
- FR-16 (RF-01, RF-03): El sistema debe mostrar en el formulario de edición una flecha para volver atrás que lo cierra sin guardar cambios y vuelve a la sección Cuenta.
- FR-17 (RF-91): El sistema debe mostrar el botón "Guardar" en el formulario de edición.
- FR-18 (RF-65): El sistema debe no mostrar ninguna opción para eliminar el movimiento en el formulario de edición.
- FR-19 (RF-106): El sistema debe deshabilitar el botón "Guardar" y mostrar "Guardando…" mientras se procesa la edición, sin permitir editar ni cerrar el formulario hasta que termine, de modo que cada confirmación registre una sola edición.

**Resultado**

- FR-20 (RF-69, RF-104, UI-14): El sistema debe mostrar "Movimiento actualizado con éxito." con un ícono de tic verde durante 3 segundos al completar la edición, cerrándolo solo y sin botón "Aceptar".
- FR-21 (RF-55): El sistema debe mostrar la página 1 de la lista luego de guardar la edición de un movimiento.
- FR-22 (RNF-07, RNF-05): El sistema debe mostrar "No se pudo guardar el movimiento. Vuelva a intentarlo." con el botón "Aceptar" cuando el servidor falle o rechace la edición, manteniendo abierto el formulario con los datos ingresados y sin modificar el movimiento, la lista ni el saldo.

## Non-Functional Requirements

Condiciones de medición de rendimiento (NFR-01), las de `PRD.md`: cuenta con 5.000 movimientos,
Google Chrome estable con la ralentización de CPU 4× de DevTools, conexión de al menos 10 Mbps con
latencia de hasta 100 ms al servidor, y al menos 100 mediciones por operación.

- NFR-01 (RNF-02): La edición de un movimiento debe completarse en menos de 2 segundos (p95), desde que el usuario presiona "Guardar" hasta que la lista y el saldo se muestran actualizados, bajo las condiciones de medición indicadas.
- NFR-02 (RNF-03): El sistema debe rechazar el 100% de los intentos de editar movimientos de otro usuario, o de editar un movimiento propio asignándole una categoría de otro usuario, verificado con pruebas automatizadas directas contra la API de Supabase.
- NFR-03 (RNF-05): Ante una falla durante la edición de un movimiento (incluido el cambio de tipo), el movimiento y el saldo deben quedar exactamente como estaban (0 casos de estado parcial), y en el 100% de los casos el saldo debe ser igual a la suma de los ingresos menos la suma de los gastos de la cuenta.
- NFR-04 (RNF-08): El 100% de las acciones de la edición (menú de la fila, formulario, selector de tipo, selector de categoría, calendario y mensajes) deben poder realizarse solo con el teclado, con el foco visible en todo momento.
- NFR-05 (RNF-06): El menú de la fila y el formulario de edición deben poder usarse sin pérdida de funcionalidad y sin desplazamiento horizontal en anchos de viewport de 320px, 768px, 1280px y 1920px.
- NFR-06 (UI-16): El 100% de los textos del menú de la fila y del formulario de edición deben tener un contraste con su fondo de al menos 4,5:1 (3:1 para texto grande), según WCAG 2.1 AA, verificado con axe-core.

## Acceptance Criteria

**Acceso a la edición**

- AC-01 (FR-01; origen: PRD AC-69): WHEN el usuario A con un movimiento en la lista presiona la fila de ese movimiento con un toque, con un clic o con la tecla Enter, THE sistema SHALL mostrar un menú con la opción "Editar".
- AC-02 (FR-01, FR-02, FR-03, FR-04; origen: PRD AC-60, AC-UI-06): WHEN el usuario A con un gasto de 1.500 en "Mercado" del 17/09/2026 elige "Editar" en el menú de su fila, THE sistema SHALL abrir el formulario de edición con el monto "1.500,00" sin signo, la categoría "Mercado" y la fecha 17/09/2026.
- AC-03 (FR-06; origen: PRD AC-61): WHEN el usuario A con un gasto registrado elige "Editar" en el menú de su fila, THE sistema SHALL mostrar un selector de tipo con las opciones "Gasto" e "Ingreso" y "Gasto" seleccionado.

**Edición**

- AC-04 (FR-05, FR-12, FR-20; origen: PRD AC-62): WHEN el usuario A con categorías de gastos "Transporte" y "Mercado" y saldo USD 10.000,00, que ya incluye un gasto de 3.000 en "Transporte" del 17/09/2026, edita ese movimiento cambiando el monto a 2000, la categoría a "Mercado" y la fecha a 16/09/2026 y guarda, THE sistema SHALL mostrar el movimiento bajo la fecha 16/09/2026 con la categoría "Mercado" y el monto "-2.000,00", el saldo "USD 11.000,00" y el mensaje "Movimiento actualizado con éxito." con un ícono de tic verde.
- AC-05 (FR-07, FR-08, FR-12; origen: PRD AC-63): WHEN el usuario A con saldo USD 10.000,00, que ya incluye un gasto de 3.000 en "Mercado", edita ese movimiento, cambia el tipo a "Ingreso" sin elegir categoría y guarda, THE sistema SHALL dejar el movimiento de tipo ingreso con la categoría "Pago Ingresado", mostrarlo con el monto "+3.000,00" y mostrar el saldo "USD 16.000,00".
- AC-06 (FR-08, FR-09; origen: PRD AC-64): WHEN el usuario A con las categorías de ingresos "Sueldo" y "Alquiler" y un gasto en "Mercado" edita ese movimiento y selecciona "Ingreso" en el selector de tipo, THE sistema SHALL cambiar la categoría a "Pago Ingresado" y mostrar en el selector de categoría solo "Pago Ingresado", "Alquiler" y "Sueldo", en ese orden.
- AC-07 (FR-07, FR-12; origen: PRD AC-65): WHEN el usuario A con una categoría de ingresos "Sueldo" y saldo USD 10.000,00, que ya incluye un gasto de 3.000 en "Mercado", edita ese movimiento, cambia el tipo a "Ingreso", elige "Sueldo" y guarda, THE sistema SHALL dejar el movimiento de tipo ingreso con la categoría "Sueldo", mostrarlo con el monto "+3.000,00" y mostrar el saldo "USD 16.000,00".
- AC-08 (FR-04, FR-10; origen: PRD AC-66): WHEN el usuario A con un movimiento del 17/09/2026 elige "Editar" y abre el selector de fecha, THE sistema SHALL mostrar el calendario con el 17/09/2026 preseleccionado y los días posteriores a hoy deshabilitados y sin poder seleccionarse.
- AC-30 (FR-10; origen: PRD AC-132): WHEN el usuario A con saldo USD 10.000,00, que ya incluye un gasto de 3.000 del 17/09/2026, edita ese movimiento, elige en el calendario la fecha 15/03/1990 y guarda, THE sistema SHALL mostrar el gasto bajo el grupo "15/03/1990" y mantener el saldo en "USD 10.000,00".
- AC-09 (FR-11; origen: PRD AC-47): IF el usuario A con saldo USD 10.000,00, que ya incluye un gasto de 3.000, edita ese movimiento, cambia el monto a 0 o lo borra y guarda, THEN THE sistema SHALL no guardar el cambio en ninguno de los dos casos, mostrar "El monto debe ser mayor a 0." con el botón "Aceptar", seguir mostrando el movimiento con el monto "-3.000,00" y mantener el saldo en "USD 10.000,00".
- AC-10 (FR-11; origen: PRD AC-48): IF el usuario A con saldo USD 10.000,00, que ya incluye un gasto de 3.000, edita ese movimiento, cambia el monto a 1.000.000.000.000,00 y guarda, THEN THE sistema SHALL no guardar el cambio, mostrar "El monto máximo es 999.999.999.999,99.", seguir mostrando el movimiento con el monto "-3.000,00" y mantener el saldo en "USD 10.000,00".
- AC-11 (FR-11): WHEN el usuario A en el formulario de edición borra el monto e intenta escribir "-50", "abc50", "10,555" y "1500000", THE sistema SHALL mostrar "50", "50", "10,55" y "1.500.000", respectivamente.
- AC-12 (FR-13; origen: PRD AC-37): WHEN el usuario A con un gasto en "Café" y, dado de alta después, un gasto en "Mercado", ambos del 01/10/2026, edita el monto del gasto en "Café" y guarda, THE sistema SHALL seguir mostrando en el grupo "01/10/2026" a "Mercado" antes que "Café".
- AC-13 (FR-14; origen: PRD AC-49): IF el usuario A con saldo USD 10.000,00, un gasto de 3.000 y una categoría de ingresos "Sueldo" intenta editar directamente desde la API ese gasto con monto 0, con monto -50, con monto 1000000000000.00, con monto 10.555 o con la categoría "Sueldo", THEN THE sistema SHALL rechazar las cinco operaciones, no modificar el movimiento y mantener el saldo en USD 10.000,00.
- AC-14 (FR-14; origen: PRD AC-131): IF el usuario A con saldo USD 10.000,00 y un gasto de 3.000 intenta editar directamente desde la API ese gasto con una fecha dos días posterior a la fecha actual en UTC, THEN THE sistema SHALL rechazar la operación, no modificar el movimiento y mantener el saldo en USD 10.000,00.
- AC-31 (FR-23): WHEN el usuario A en el formulario de edición de un gasto de 3.000 borra el monto y pega "$ 1.500,50", y después pega "abc" con el campo mostrando "1.500,50", THE sistema SHALL mostrar "1.500,50" en ambos casos.
- AC-32 (FR-24): WHEN el usuario A el 03/10/2026 elige "Editar" en el menú de la fila de un gasto del 17/09/2026 y abre el calendario, THE sistema SHALL mostrar el campo "Fecha" con "17/09/2026" y el calendario de septiembre de 2026 con el nombre del mes y de los días en español y la semana empezando el lunes.
- AC-33 (FR-25): IF el usuario A con saldo USD 10.000,00, que ya incluye un gasto de 3.000, edita ese gasto a 2000 y guarda, y después intenta desde la API cambiar el saldo de su cuenta a 1000000, THEN THE sistema SHALL aceptar la edición con el saldo "USD 11.000,00", rechazar el cambio directo del saldo y seguir mostrando el saldo "USD 11.000,00".

**Formulario**

- AC-15 (FR-15; origen: PRD AC-67): WHEN el usuario A con saldo USD 10.000,00, que ya incluye un gasto de 3.000, abre ese movimiento para editarlo, cambia el monto a 2000 y presiona "Cancelar", THE sistema SHALL cerrar el formulario, seguir mostrando el gasto con el monto "-3.000,00" y mantener el saldo en "USD 10.000,00".
- AC-16 (FR-16; origen: PRD AC-06): WHEN el usuario A con saldo USD 10.000,00, que ya incluye un gasto de 3.000, abre ese movimiento para editarlo, cambia el monto a 2000 y presiona la flecha para volver atrás, THE sistema SHALL mostrar la sección Cuenta, seguir mostrando el movimiento con el monto "-3.000,00" y mantener el saldo en "USD 10.000,00".
- AC-17 (FR-02, FR-15, FR-16; origen: PRD AC-97): WHEN el usuario A que descartó con "Cancelar", y en otro intento con la flecha para volver atrás, el cambio del monto de un gasto de 3.000 en "Mercado" a 2000 vuelve a abrir el formulario de edición de ese movimiento, THE sistema SHALL mostrar en ambos casos "3.000,00" con la categoría "Mercado".
- AC-18 (FR-17, FR-18; origen: PRD AC-70, AC-98): WHEN el usuario A elige "Editar" en el menú de la fila de un movimiento, THE sistema SHALL mostrar el botón "Guardar" y ninguna opción para eliminar el movimiento.
- AC-19 (FR-19): WHEN el usuario A con saldo USD 10.000,00, que ya incluye un gasto de 3.000, edita ese movimiento con el monto 2000 y presiona "Guardar" dos veces seguidas, THE sistema SHALL mostrar el botón deshabilitado con el texto "Guardando…", no permitir editar ni cerrar el formulario mientras se procesa, registrar una sola edición y mostrar el saldo "USD 11.000,00".

**Resultado**

- AC-20 (FR-20, FR-21; origen: PRD AC-40): WHEN el usuario A con 120 movimientos que está en la página 2 edita un movimiento de esa página y guarda, THE sistema SHALL mostrar la página 1 con el indicador "Página 1 de 3" y el mensaje "Movimiento actualizado con éxito.", que se cierra solo a los 3 segundos.
- AC-21 (FR-22): IF el servidor falla al guardar la edición del monto de un gasto de 3.000 a 2000 del usuario A con saldo USD 10.000,00 (simulado en la prueba), THEN THE sistema SHALL mostrar "No se pudo guardar el movimiento. Vuelva a intentarlo." con el botón "Aceptar", mantener abierto el formulario con el monto "2.000", seguir mostrando en la lista el gasto con "-3.000,00" y mantener el saldo en "USD 10.000,00".

**No funcionales**

- AC-22 (NFR-01; origen: PRD AC-115): WHEN se ejecutan 100 ediciones de movimientos sobre una cuenta con 5.000 movimientos bajo las condiciones de medición, THE sistema SHALL completar cada edición, desde que se presiona "Guardar" hasta que la lista y el saldo se muestran actualizados, con un p95 menor a 2 segundos.
- AC-23 (NFR-02; origen: PRD AC-117): IF el usuario A autenticado intenta editar mediante la API un movimiento del usuario B usando su identificador, THEN THE sistema SHALL rechazar la operación y el movimiento y el saldo de B SHALL quedar sin cambios.
- AC-24 (NFR-02; origen: PRD AC-118): IF el usuario A autenticado intenta editar mediante la API uno de sus movimientos asignándole una categoría del usuario B, THEN THE sistema SHALL rechazar la operación y los saldos de A y de B SHALL quedar sin cambios.
- AC-25 (NFR-03; origen: PRD AC-123): IF se simula una falla después de modificar el movimiento y antes de actualizar el saldo al editar a 2000 un gasto de 3.000 del usuario A con saldo USD 10.000,00, o al cambiarlo a ingreso, THEN THE sistema SHALL en ambos casos seguir mostrando el gasto con "-3.000,00", mantener el saldo en USD 10.000,00 y mostrar un mensaje de error.
- AC-26 (NFR-03; adapta PRD AC-125): WHEN se ejecuta sobre el usuario A con saldo USD 0,00 una secuencia fija, definida en la prueba, de 20 altas y 20 ediciones intercaladas (10 de ellas con cambio de tipo), THE sistema SHALL mantener después de cada operación el saldo igual a la suma de los ingresos menos la suma de los gastos de la cuenta.
- AC-27 (NFR-04; adapta PRD AC-133): WHEN el usuario A usa solo el teclado para abrir el menú de la fila de un movimiento, elegir "Editar", cambiar el tipo, la categoría, la fecha y el monto y guardar, THE sistema SHALL permitir completar todas las acciones y distinguir visualmente el elemento con foco en cada paso.
- AC-28 (NFR-05; adapta PRD AC-126): WHEN el usuario A edita un movimiento con anchos de viewport de 320px, 768px, 1280px y 1920px, THE sistema SHALL permitir en cada ancho abrir el menú de la fila, completar el formulario de edición y guardar, sin desplazamiento horizontal.
- AC-29 (NFR-06; adapta AC-UI-12): WHEN se analizan con axe-core el menú de la fila y el formulario de edición con el selector de tipo, el selector de categoría y el calendario abiertos, THE sistema SHALL tener el 100% de los textos con un contraste de al menos 4,5:1 (3:1 para texto grande).

## Out of Scope

- Eliminación de movimientos y la opción "Eliminar" del menú de la fila: es FEAT-001c.
- Edición de varios movimientos a la vez (fuera de alcance de `PRD.md`).
- Creación, edición y eliminación de categorías propias (S-1).
- Historial o deshacer de las ediciones.
- Todo lo que FEAT-001a deja fuera de alcance (navegación, Editar Cuenta, Restablecer Cuenta, Google, Reportes).

## Risks and Mitigations

- Riesgo: saldo inconsistente al editar, sobre todo al cambiar el tipo (hay que revertir el efecto anterior y aplicar el nuevo) → mitigación: la edición y el recálculo del saldo se ejecutan en una sola operación atómica en la base de datos, probada con fallas simuladas y con la secuencia de AC-26 (NFR-03).
- Riesgo: la edición cambia el orden del movimiento dentro de su fecha → mitigación: el momento del alta no se modifica al editar (FR-13, AC-12).
- Riesgo: un usuario edita datos de otro o usa categorías ajenas → mitigación: las mismas políticas de acceso de FEAT-001a, más la validación de la categoría en la operación de edición (NFR-02, AC-23, AC-24).

## Dependencies

- FEAT-001a: cuenta, categorías por defecto, saldo, operación atómica de alta, lista, paginación, mensajes, calendario y campo de monto, que este sub-ticket reutiliza.
- Documentos de producto: `docs/daw/prd/PRD.md` (RF-xx, RNF-xx, AC-xx de origen), `docs/daw/prd/INTERFAZ.md` (UI-xx, AC-UI-xx de origen) y `docs/daw/prd/prd-FEAT-001a.md` (FEAT-001a FR-xx).
- FEAT-001c depende de este sub-ticket (agrega "Eliminar" al menú de la fila).
