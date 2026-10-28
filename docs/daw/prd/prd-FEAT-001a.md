# PRD FEAT-001a: Cuenta, Saldo, Alta y Lista de Movimientos

| Field | Value |
|-------|-------|
| Ticket | FEAT-001a |
| Ticket padre | FEAT-001 (Cuenta y Movimientos) |
| Tracker | none |
| Date | 2026-10-25 |
| PRD loops | 5 |

> Sub-ticket de FEAT-001. Deriva de `docs/daw/prd/PRD.md` (PRD-001) y `docs/daw/prd/INTERFAZ.md`.
> Cada requerimiento indica entre paréntesis su origen: `RF-xx` y `RNF-xx` de `PRD.md`, `UI-xx` de
> `INTERFAZ.md`. En los criterios, "origen: PRD AC-xx" o "origen: AC-UI-xx" señala el criterio
> original que adapta. Las referencias `FR-`, `NFR-` y `AC-` sin prefijo son de este documento.

## Context and Problem

MiBalance busca que el usuario centralice sus ingresos y gastos en una única cuenta de balance y
conozca en todo momento su saldo real (ver "Contexto y Problema" de `PRD.md`). Este sub-ticket
construye la base sobre la que se apoya el resto de la aplicación: la cuenta única del usuario con
sus categorías por defecto, el saldo, el alta de gastos e ingresos y la lista de movimientos.

Mientras no se incorpora Google OAuth (RF-22, RF-23), el usuario entra con el inicio de sesión
anónimo de Supabase, de forma provisoria y aislada (ver "Stack" en `AGENTS.md`).

**Supuestos acordados en DEFINE:**

- S-1: "Registrarse" equivale, mientras dure la sesión anónima, al primer inicio de sesión anónimo
  de un usuario: ahí se crean su cuenta y sus categorías por defecto.
- S-2: La creación de categorías propias queda fuera de este sub-ticket. Los criterios que usan
  categorías como "Mercado", "Sueldo", "Transporte" o "café" se prueban con esas categorías cargadas
  directamente en la base de datos por la prueba, con las credenciales de administrador de Supabase
  (service role key), que existen solo en el entorno de pruebas y nunca en la aplicación. En la aplicación, el usuario solo ve "Pago
  Realizado" y "Pago Ingresado" hasta que llegue la feature de Categorías.
- S-3: La barra de navegación (RF-26) no se incluye: la sección Cuenta es la única sección que
  existe. Solo se incluye la flecha para volver atrás del formulario de alta (RF-01, RF-03).

## Goals

- G-1 (O-1 de `PRD.md`): el usuario ve su saldo en la pantalla inicial sin navegar (0 interacciones
  después de iniciar la sesión).
- G-2 (O-1 de `PRD.md`): el usuario registra un gasto con la categoría y la fecha por defecto en 3
  interacciones desde la sección Cuenta ("Añadir Gasto" → monto → "Guardar"); el mensaje de éxito se
  cierra solo, sin sumar interacciones.
- G-3: el saldo es siempre igual a la suma de los ingresos menos la suma de los gastos de la cuenta.

## Functional Requirements

**Sesión (provisoria)**

- FR-01 (`AGENTS.md`, provisorio hasta RF-22/RF-23): El sistema debe iniciar automáticamente una sesión anónima de Supabase cuando un usuario sin sesión abra la aplicación, y mostrar la sección Cuenta como pantalla inicial (RF-25).
- FR-02 (`AGENTS.md`, RF-105, provisorio hasta RF-24): El sistema debe mostrar el mensaje de error "No se pudo iniciar la sesión. Vuelva a intentarlo." con el botón "Aceptar" cuando falle el inicio de sesión anónimo; al presionar "Aceptar" debe reintentar el inicio de sesión, y no debe mostrar la sección Cuenta mientras no haya una sesión iniciada.
- FR-03 (RF-28): El sistema debe mantener la sesión iniciada, con el mismo usuario y sus datos, al cerrar y volver a abrir el navegador.

**Cuenta**

- FR-04 (RF-04): El sistema debe crear una única cuenta llamada "Mi Cuenta" con moneda USD y saldo 0 para cada usuario que se registre (S-1).
- FR-05 (RF-05, RF-87, RF-88): El sistema debe crear las categorías por defecto "Pago Realizado" (tipo gasto) y "Pago Ingresado" (tipo ingreso) en la cuenta de cada usuario que se registre, e impedir que se modifiquen o eliminen.
- FR-06 (UI-01): El sistema debe mostrar en la sección Cuenta el nombre de la cuenta seguido del código ISO 4217 de su moneda entre paréntesis (ej. "Mi Cuenta (USD)").
- FR-07 (UI-02, UI-10): El sistema debe mostrar en la sección Cuenta el saldo precedido por el código de la moneda, con dos decimales, punto como separador de miles y coma decimal (ej. "USD 10.000,00").
- FR-08 (UI-03): El sistema debe mostrar el saldo en color verde cuando sea mayor a 0, en rojo cuando sea menor a 0 y en el color normal del texto cuando sea 0.

**Saldo**

- FR-09 (RF-45): El sistema debe aumentar el saldo de la cuenta en el monto de cada ingreso que se registre.
- FR-10 (RF-46): El sistema debe disminuir el saldo de la cuenta en el monto de cada gasto que se registre.
- FR-11 (RF-47): El sistema debe permitir registrar un gasto mayor que el saldo de la cuenta, dejando el saldo en negativo.

**Alta de movimientos**

- FR-12 (RF-29): El sistema debe permitir añadir un gasto desde la sección Cuenta con el botón "Añadir Gasto", ingresando el monto, la categoría y la fecha, los tres obligatorios.
- FR-13 (RF-30): El sistema debe permitir añadir un ingreso desde la sección Cuenta con el botón "Añadir Ingreso", ingresando el monto, la categoría y la fecha, los tres obligatorios.
- FR-14 (RF-31): El sistema debe mostrar el formulario de alta sin conservar los valores de un intento anterior: con el monto vacío y con la fecha y la categoría en sus valores por defecto.
- FR-15 (RF-32): El sistema debe tener siempre una categoría seleccionada en el selector de categoría, sin una opción vacía ni "sin categoría".
- FR-16 (RF-39): El sistema debe mostrar en el selector de categoría solo las categorías del mismo tipo que el movimiento.
- FR-17 (RF-40, RF-71): El sistema debe ordenar las categorías del selector con la categoría por defecto primero y después las demás en orden alfabético, sin distinguir mayúsculas/minúsculas ni tildes.
- FR-18 (RF-35, RF-36): El sistema debe preseleccionar "Pago Realizado" al abrir "Añadir Gasto" y "Pago Ingresado" al abrir "Añadir Ingreso".
- FR-19 (RF-33, RF-37): El sistema debe mostrar un calendario para seleccionar solo la fecha (sin hora), siempre con una fecha seleccionada y sin una opción para dejarla vacía.
- FR-20 (RF-34): El sistema debe preseleccionar en el calendario el día de hoy según la fecha local del dispositivo, sin convertirla a UTC.
- FR-21 (RF-38): El sistema debe deshabilitar en el calendario los días posteriores a hoy (fecha local del dispositivo).
- FR-22 (RF-107): El sistema debe rechazar, también cuando la operación llega directamente desde la API, el registro de un movimiento con fecha posterior a la de mañana en UTC, sin modificar la fecha de los movimientos que acepta.
- FR-23 (RF-108): El sistema debe aceptar cualquier fecha pasada en un movimiento, sin una fecha mínima.
- FR-24 (RF-41): El sistema debe rechazar el registro de un movimiento con el monto vacío o no mayor a 0, con el mensaje "El monto debe ser mayor a 0.".
- FR-25 (RF-42): El sistema debe rechazar el registro de un movimiento con un monto mayor a 999.999.999.999,99, con el mensaje "El monto máximo es 999.999.999.999,99.".
- FR-26 (RF-43): El sistema debe impedir escribir más de dos decimales en el campo de monto.
- FR-27 (RF-44): El sistema debe aceptar en el campo de monto solo dígitos y una coma decimal, sin signos ni letras, ignorando una segunda coma y aplicando el mismo filtro al texto pegado (solo se conservan los dígitos y la primera coma).
- FR-28 (UI-04): El sistema debe agregar el punto como separador de miles en el campo de monto mientras el usuario escribe (ej. "1500000" se muestra "1.500.000").
- FR-29 (RF-32, RF-33, RF-39, RF-41, RF-42, RF-43): El sistema debe rechazar desde la API el registro de un movimiento sin monto, sin categoría o sin fecha, con monto no mayor a 0, mayor a 999.999.999.999,99 o con más de dos decimales, o con una categoría de otro tipo, sin registrar nada ni modificar el saldo.
- FR-30 (RF-91): El sistema debe mostrar el botón "Guardar" en los formularios "Añadir Gasto" y "Añadir Ingreso".
- FR-31 (RF-64): El sistema debe permitir cerrar el formulario de alta sin registrar nada con la opción "Cancelar".
- FR-32 (RF-01, RF-03): El sistema debe mostrar en el formulario de alta una flecha para volver atrás que lo cierra sin registrar nada y vuelve a la sección Cuenta, y no debe mostrar esa flecha en la sección Cuenta.
- FR-33 (RF-106): El sistema debe deshabilitar el botón "Guardar" y mostrar el texto "Guardando…" mientras se procesa el alta, sin permitir editar ni cerrar el formulario hasta que termine, de modo que cada confirmación registre un solo movimiento.

**Lista de movimientos**

- FR-34 (RF-48): El sistema debe mostrar en la sección Cuenta la lista de movimientos ordenada por fecha, de la más reciente a la más antigua y, dentro de una misma fecha, por el momento del alta, del más reciente al más antiguo.
- FR-35 (UI-05): El sistema debe agrupar los movimientos de la lista por fecha, con la fecha en formato DD/MM/AAAA como encabezado de cada grupo.
- FR-36 (UI-06, UI-07, UI-08, UI-10): El sistema debe mostrar cada movimiento con su categoría a la izquierda y su monto a la derecha, sin el tipo ni el código de moneda, con el signo "-" en los gastos y "+" en los ingresos, en formato argentino con dos decimales (ej. "Café -800,00").
- FR-37 (UI-09): El sistema debe mostrar el monto de los gastos en color rojo y el de los ingresos en color verde.
- FR-38 (RF-49): El sistema debe mostrar el mensaje "Aquí verá sus movimientos." en lugar de la lista cuando la cuenta no tenga movimientos.
- FR-39 (RF-50): El sistema debe mostrar la lista de movimientos en páginas de 50 movimientos.
- FR-40 (RF-51, RF-52): El sistema debe permitir ir a la página anterior y a la siguiente con los botones "Anterior" y "Siguiente", con "Anterior" deshabilitado en la primera página y "Siguiente" en la última.
- FR-41 (RF-53, RF-54): El sistema debe mostrar el indicador "Página X de Y" debajo de la lista, y mostrar los botones de paginación y el indicador solo cuando la cuenta tenga más de 50 movimientos.
- FR-42 (RF-55): El sistema debe mostrar la página 1 de la lista luego de guardar el alta de un movimiento.

**Mensajes**

- FR-43 (RF-69, RF-104, UI-14): El sistema debe mostrar "Gasto registrado con éxito." o "Ingreso registrado con éxito." al completar el alta, con un ícono de tic verde, durante 3 segundos, cerrándolo solo, sin botón "Aceptar" y sin impedir seguir usando la aplicación; un mensaje de éxito nuevo reemplaza al que esté en pantalla y cuenta sus propios 3 segundos desde que aparece.
- FR-44 (RF-105, UI-15): El sistema debe mostrar cada mensaje de error, incluidos los de validación, con un ícono de cruz roja, hasta que el usuario presione su botón "Aceptar"; al cerrar un error de validación, el formulario sigue abierto con todos los datos ingresados y el foco vuelve al campo con el error. Al cerrar cualquier error, el foco vuelve al elemento que corresponde a ese error o, si ese elemento ya no está en pantalla, al primer control enfocable de la pantalla actual; mientras el error está en pantalla, un clic en su fondo o dentro del mensaje fuera de "Aceptar" no saca el foco del mensaje (agregado por FIX-001).
- FR-45 (RNF-07): El sistema debe mostrar el mensaje "No se pudieron cargar sus movimientos. Vuelva a intentarlo." cuando falle la carga de la cuenta, el saldo o la lista, o cuando alguno de sus montos o el saldo lleguen con un formato inesperado (agregado por FIX-001); al presionar "Aceptar" debe reintentar la carga.
- FR-46 (RNF-07, RNF-05): El sistema debe mostrar el mensaje "No se pudo guardar el movimiento. Vuelva a intentarlo." cuando el servidor falle o rechace el alta (incluida una fecha rechazada por FR-22), manteniendo abierto el formulario con los datos ingresados y sin modificar la lista ni el saldo.

**Agregados en la revisión de DEFINE**

- FR-47 (UI-05, RF-50): El sistema debe mostrar el encabezado de la fecha al principio de cada página de la lista, también cuando el grupo de esa fecha empieza en la página anterior.
- FR-48 (RF-37, UI-05): El sistema debe mostrar en los formularios de alta los campos "Monto", "Categoría" y "Fecha"; el campo "Fecha" con el formato DD/MM/AAAA, y el calendario en español con la semana de lunes a domingo.
- FR-49 (RF-73 a RF-89, S-2): El sistema debe rechazar, cuando la operación llega desde la API con la sesión de un usuario, la creación, la edición y la eliminación de cualquier categoría, salvo la creación automática de las categorías por defecto al registrarse (FR-05), hasta que la feature de Categorías habilite esas operaciones con sus validaciones.
- FR-50 (RF-06 a RF-14): El sistema debe rechazar, cuando la operación llega desde la API con la sesión de un usuario, la modificación del nombre, de la moneda y del saldo de su cuenta, salvo los cambios del saldo que producen las operaciones de movimientos de la aplicación (FR-09, FR-10), hasta que la feature "Editar Cuenta" habilite el cambio de nombre y de moneda con sus validaciones.

## Non-Functional Requirements

Condiciones de medición de rendimiento (NFR-01), las de `PRD.md`: cuenta con 5.000 movimientos,
Google Chrome estable con la ralentización de CPU 4× de DevTools, conexión de al menos 10 Mbps con
latencia de hasta 100 ms al servidor, y al menos 100 mediciones por operación.

- NFR-01 (RNF-02): El alta de un movimiento debe completarse en menos de 2 segundos (p95), desde que el usuario presiona "Guardar" hasta que la lista y el saldo se muestran actualizados, bajo las condiciones de medición indicadas.
- NFR-02 (RNF-03): El sistema debe rechazar el 100% de los intentos de leer, crear, editar o eliminar cuentas, categorías o movimientos cuyo propietario no sea el usuario autenticado, verificado con pruebas automatizadas que acceden directamente a la API de Supabase sin pasar por la interfaz.
- NFR-03 (RNF-04): El 100% de los montos y del saldo deben almacenarse y procesarse con un tipo decimal/numeric (no float) de al menos 2 decimales, sin pérdida de precisión; el saldo se almacena sin tope de dígitos enteros.
- NFR-04 (RNF-05): Ante una falla durante el alta de un movimiento, la cuenta, sus movimientos y su saldo deben quedar exactamente como estaban (0 casos de estado parcial), y en el 100% de los casos el saldo debe ser igual a la suma de los ingresos menos la suma de los gastos de la cuenta, incluso ante escrituras directas desde la API.
- NFR-05 (RNF-06): La sección Cuenta y el formulario de alta deben poder usarse sin pérdida de funcionalidad y sin desplazamiento horizontal en anchos de viewport de 320px, 768px, 1280px y 1920px.
- NFR-06 (RNF-07): El 100% de los mensajes de error de este sub-ticket (inicio de sesión, carga de la cuenta y la lista, alta) deben estar en español, tratar de usted y no contener códigos de error internos ni stack traces.
- NFR-07 (RNF-08): El 100% de las acciones de este sub-ticket (alta, calendario, selector de categoría, paginación, mensajes) deben poder realizarse solo con el teclado, con el foco visible en todo momento, y los íconos de tic, cruz y flecha para volver atrás deben tener un texto alternativo que lea un lector de pantalla.
- NFR-08 (UI-16): El 100% de los textos de las pantallas de este sub-ticket deben tener un contraste con su fondo de al menos 4,5:1 (3:1 para texto de 24 px o más, o de 18,66 px o más en negrita), y los íconos de tic y cruz de al menos 3:1, según WCAG 2.1 AA, verificado con axe-core.

## Acceptance Criteria

**Sesión**

- AC-01 (FR-01): WHEN un usuario sin sesión abre la aplicación y el inicio de sesión anónimo responde correctamente, THE sistema SHALL mostrar la sección Cuenta sin pedirle ninguna acción.
- AC-02 (FR-02, FR-44): IF el inicio de sesión anónimo falla al abrir la aplicación (simulado en la prueba), THEN THE sistema SHALL mostrar "No se pudo iniciar la sesión. Vuelva a intentarlo." con un ícono de cruz roja y el botón "Aceptar", y no mostrar la sección Cuenta.
- AC-03 (FR-02): WHEN, con el mensaje de AC-02 en pantalla, el usuario presiona "Aceptar" y el nuevo intento responde correctamente, THE sistema SHALL reintentar el inicio de sesión y mostrar la sección Cuenta.
- AC-04 (FR-03; origen: PRD AC-35): WHEN el usuario A con saldo USD 1.500,00 y 3 movimientos cierra el navegador y vuelve a abrir la aplicación, THE sistema SHALL mostrar su sección Cuenta con el saldo "USD 1.500,00" y los 3 movimientos, sin crear otro usuario.

**Cuenta y categorías por defecto**

- AC-05 (FR-04, FR-06, FR-07; origen: PRD AC-09, AC-UI-13): WHEN el usuario A que acaba de registrarse accede a la sección Cuenta, THE sistema SHALL mostrar una única cuenta con el encabezado "Mi Cuenta (USD)" y el saldo "USD 0,00".
- AC-06 (FR-05, FR-16; adapta PRD AC-10): WHEN el usuario A que acaba de registrarse abre "Añadir Gasto" y después "Añadir Ingreso" y despliega el selector de categoría, THE sistema SHALL mostrar como única opción "Pago Realizado" en el primero y "Pago Ingresado" en el segundo.
- AC-07 (FR-04, FR-05): WHEN el usuario A acaba de registrarse, THE sistema SHALL tener en la base de datos exactamente 1 cuenta de A, llamada "Mi Cuenta", con moneda USD y saldo 0, y exactamente 2 categorías de A: "Pago Realizado" de tipo gasto y "Pago Ingresado" de tipo ingreso.
- AC-08 (FR-04, NFR-02): IF el usuario A intenta crear una segunda cuenta para sí mismo directamente desde la API, THEN THE sistema SHALL rechazar la operación y A SHALL seguir teniendo exactamente 1 cuenta.
- AC-09 (FR-05; origen: PRD AC-96): IF el usuario A intenta cambiar el nombre o el tipo de "Pago Realizado" o de "Pago Ingresado", o eliminarlas, directamente desde la API, THEN THE sistema SHALL rechazar todas las operaciones y ambas categorías SHALL seguir existiendo con su nombre y su tipo.
- AC-10 (FR-07; origen: AC-UI-01): WHEN el usuario A con una cuenta en USD y un saldo de 10000 accede a la sección Cuenta, THE sistema SHALL mostrar el saldo "USD 10.000,00".
- AC-11 (FR-08; origen: AC-UI-02): WHEN el usuario A con saldo USD 8.500,00, USD -1.000,00 o USD 0,00 accede a la sección Cuenta, THE sistema SHALL mostrar el saldo en verde, en rojo o en el color normal del texto, respectivamente.

**Alta de movimientos**

- AC-12 (FR-12, FR-10, FR-43; origen: PRD AC-43): WHEN el usuario A con saldo USD 10.000,00 y una categoría de gastos "Mercado" presiona "Añadir Gasto", ingresa el monto 1500, selecciona "Mercado", deja la fecha de hoy y presiona "Guardar", THE sistema SHALL mostrar bajo la fecha de hoy un movimiento con la categoría "Mercado" y el monto "-1.500,00", el saldo "USD 8.500,00" y el mensaje "Gasto registrado con éxito.".
- AC-13 (FR-13, FR-09, FR-43; origen: PRD AC-44): WHEN el usuario A con saldo USD 10.000,00 y una categoría de ingresos "Sueldo" presiona "Añadir Ingreso", ingresa el monto 1000, selecciona "Sueldo", deja la fecha de hoy y presiona "Guardar", THE sistema SHALL mostrar bajo la fecha de hoy un movimiento con la categoría "Sueldo" y el monto "+1.000,00", el saldo "USD 11.000,00" y el mensaje "Ingreso registrado con éxito.".
- AC-14 (FR-24, FR-44; origen: PRD AC-45, AC-112, AC-UI-15): IF el usuario A con saldo USD 10.000,00 y una categoría de gastos "Mercado", que eligió "Mercado" y la fecha 01/10/2026, intenta guardar un gasto con el monto vacío o con el monto 0, THEN THE sistema SHALL no registrar el movimiento en ninguno de los dos casos, mostrar "El monto debe ser mayor a 0." con un ícono de cruz roja y el botón "Aceptar", mantener el saldo en "USD 10.000,00" y, al presionar "Aceptar", dejar el formulario abierto con "Mercado" y 01/10/2026 y el foco en el campo "Monto".
- AC-15 (FR-25; origen: PRD AC-46): IF el usuario A con saldo USD 0,00 intenta guardar un ingreso de 1.000.000.000.000,00, THEN THE sistema SHALL no registrarlo y mostrar "El monto máximo es 999.999.999.999,99."; WHEN después guarda un ingreso de 999.999.999.999,99, THE sistema SHALL registrarlo y mostrar el saldo "USD 999.999.999.999,99".
- AC-16 (FR-29; origen: PRD AC-49): IF el usuario A con saldo USD 10.000,00 y una categoría de ingresos "Sueldo" intenta registrar directamente desde la API un gasto con monto 0, con monto -50, con monto 1000000000000.00, con monto 10.555, con la categoría "Sueldo", sin monto, sin categoría o sin fecha, THEN THE sistema SHALL rechazar las ocho operaciones, no registrar ningún movimiento y mantener el saldo en USD 10.000,00.
- AC-17 (FR-26; origen: PRD AC-50): WHEN el usuario A en "Añadir Gasto" intenta escribir "10,555" en el campo de monto, THE sistema SHALL no aceptar el tercer decimal y mostrar "10,55".
- AC-18 (FR-27; origen: PRD AC-51): WHEN el usuario A en "Añadir Gasto" intenta escribir "-50" o "abc50" en el campo de monto, THE sistema SHALL no aceptar el signo "-" ni las letras y mostrar "50" en ambos casos.
- AC-19 (FR-28; origen: AC-UI-03): WHEN el usuario A en "Añadir Gasto" escribe "1500000" o "1500,50" en el campo de monto, THE sistema SHALL mostrar "1.500.000" o "1.500,50", respectivamente.
- AC-20 (FR-10, FR-28; origen: PRD AC-52): WHEN el usuario A con saldo USD 10.000,00 escribe "1500,50" en "Añadir Gasto" y guarda con la categoría y la fecha por defecto, THE sistema SHALL mostrar el movimiento con el monto "-1.500,50" y el saldo "USD 8.499,50".
- AC-21 (FR-19, FR-20, FR-21; origen: PRD AC-53): WHEN el usuario A presiona "Añadir Gasto" o "Añadir Ingreso" y abre el selector de fecha, THE sistema SHALL mostrar en ambos formularios un calendario para seleccionar solo la fecha, con el día de hoy preseleccionado y los días posteriores a hoy deshabilitados y sin poder seleccionarse.
- AC-22 (FR-15, FR-16; origen: PRD AC-54): WHEN el usuario A con una categoría de gastos "Mercado" y una de ingresos "Sueldo" presiona "Añadir Gasto" y abre el selector de categoría, THE sistema SHALL mostrar solo "Pago Realizado" y "Mercado", sin "Pago Ingresado", "Sueldo" ni una opción vacía o "sin categoría".
- AC-23 (FR-18; origen: PRD AC-55): WHEN el usuario A presiona "Añadir Gasto" o "Añadir Ingreso", THE sistema SHALL mostrar preseleccionada la categoría "Pago Realizado" o "Pago Ingresado", respectivamente.
- AC-24 (FR-19; origen: PRD AC-56): WHEN el usuario A en "Añadir Gasto" abre el calendario, THE sistema SHALL tener siempre una fecha seleccionada y no ofrecer una opción para dejar la fecha vacía.
- AC-25 (FR-14; origen: PRD AC-57): WHEN el usuario A que en "Añadir Ingreso" ingresó el monto 500, eligió la categoría "Sueldo" y cambió la fecha a 01/10/2026 vuelve atrás con la flecha, presiona "Cancelar" o guarda el ingreso, y presiona otra vez "Añadir Ingreso", THE sistema SHALL mostrar en los tres casos el monto vacío, la categoría "Pago Ingresado" y la fecha de hoy.
- AC-26 (FR-17; origen: PRD AC-58): WHEN el usuario A con las categorías de gastos "Transporte", "café" y "Mercado" abre el selector de categoría en "Añadir Gasto", THE sistema SHALL mostrar las opciones en este orden: "Pago Realizado", "café", "Mercado" y "Transporte".
- AC-27 (FR-11; origen: PRD AC-59): WHEN el usuario A con saldo USD 1.000,00 registra un gasto de 2000, THE sistema SHALL registrarlo y mostrar el saldo "USD -1.000,00".
- AC-28 (FR-22; origen: PRD AC-131): IF el usuario A con saldo USD 10.000,00 intenta registrar directamente desde la API un gasto con fecha dos días posterior a la fecha actual en UTC, THEN THE sistema SHALL rechazar la operación, no registrar ningún movimiento y mantener el saldo en USD 10.000,00.
- AC-29 (FR-22): WHEN el usuario A registra directamente desde la API un gasto de 100 con la fecha de mañana en UTC, THE sistema SHALL registrarlo con esa misma fecha.
- AC-30 (FR-23; origen: PRD AC-132): WHEN el usuario A con saldo USD 10.000,00 elige en el calendario de "Añadir Gasto" la fecha 15/03/1990, ingresa el monto 100 y guarda, THE sistema SHALL registrar el gasto bajo el grupo "15/03/1990" y mostrar el saldo "USD 9.900,00".
- AC-31 (FR-20): WHILE el dispositivo del usuario A está en la zona horaria UTC-3 con la hora local 23:30 del 03/10/2026 (02:30 del 04/10/2026 en UTC), WHEN el usuario A abre "Añadir Gasto", ingresa el monto 100 y guarda sin cambiar la fecha, THE sistema SHALL preseleccionar el 03/10/2026 y registrar el gasto bajo el grupo "03/10/2026".
- AC-32 (FR-32; origen: PRD AC-03, AC-05): WHEN el usuario A con saldo USD 10.000,00 y una categoría de ingresos "Sueldo" que en "Añadir Ingreso" ingresó el monto 500, eligió la categoría "Sueldo" y cambió la fecha a 01/10/2026 presiona la flecha para volver atrás, THE sistema SHALL mostrar la sección Cuenta sin la flecha para volver atrás, sin registrar ningún movimiento y con el saldo "USD 10.000,00".
- AC-33 (FR-31; origen: PRD AC-67): WHEN el usuario A con saldo USD 10.000,00 abre "Añadir Gasto", ingresa el monto 500 y presiona "Cancelar", THE sistema SHALL cerrar el formulario sin registrar ningún movimiento y mantener el saldo en "USD 10.000,00".
- AC-34 (FR-30; origen: PRD AC-98): WHEN el usuario A abre "Añadir Gasto" o "Añadir Ingreso", THE sistema SHALL mostrar el botón "Guardar" en ambos formularios.
- AC-35 (FR-33; origen: PRD AC-129): WHEN el usuario A con saldo USD 10.000,00 que en "Añadir Gasto" ingresó el monto 1500 presiona "Guardar" dos veces seguidas, THE sistema SHALL mostrar el botón deshabilitado con el texto "Guardando…" y no permitir editar ni cerrar el formulario mientras se procesa, registrar un solo gasto y mostrar el saldo "USD 8.500,00".
- AC-65 (FR-27): WHEN el usuario A en "Añadir Gasto" escribe "1,5" y después otra coma y un "0", THE sistema SHALL ignorar la segunda coma y mostrar "1,50".
- AC-66 (FR-27): WHEN el usuario A pega "$ 1.500,50" en el campo de monto vacío de "Añadir Gasto", y después pega "abc" con el campo mostrando "1.500,50", THE sistema SHALL mostrar "1.500,50" en ambos casos.
- AC-67 (FR-48): WHEN el usuario A abre "Añadir Gasto" el 03/10/2026 y abre el calendario, THE sistema SHALL mostrar los campos "Monto", "Categoría" y "Fecha", el campo "Fecha" con "03/10/2026" y el calendario de octubre de 2026 con el nombre del mes y de los días en español y la semana empezando el lunes.

**Lista de movimientos**

- AC-36 (FR-34, FR-35; origen: PRD AC-36): WHEN el usuario A que registró un gasto de 1.500 en "Mercado" del 17/09/2026, un ingreso de 50.000 en "Sueldo" del 01/10/2026 y luego un gasto de 800 en "Café" del 01/10/2026 accede a la sección Cuenta, THE sistema SHALL mostrar primero el grupo "01/10/2026" con el gasto en "Café" seguido del ingreso en "Sueldo", y después el grupo "17/09/2026" con el gasto en "Mercado".
- AC-37 (FR-35, FR-36; origen: AC-UI-14): WHEN el usuario A con un gasto de 1.500 en "Mercado" del 17/09/2026 accede a la sección Cuenta, THE sistema SHALL mostrar el encabezado "17/09/2026" y debajo una fila con "Mercado" a la izquierda y "-1.500,00" a la derecha, sin el tipo de movimiento.
- AC-38 (FR-36; origen: AC-UI-04): WHEN el usuario A con un gasto de 1.500 en "Mercado" y dos ingresos de 520,50 y 1000 en "Sueldo" accede a la sección Cuenta, THE sistema SHALL mostrar en la lista "-1.500,00", "+520,50" y "+1.000,00", sin código de moneda.
- AC-39 (FR-37; origen: AC-UI-05): WHEN el usuario A con un gasto de 1.500 en "Mercado" y un ingreso de 1.000 en "Sueldo" accede a la sección Cuenta, THE sistema SHALL mostrar "-1.500,00" en rojo y "+1.000,00" en verde.
- AC-40 (FR-38; origen: PRD AC-42): WHEN el usuario A sin movimientos accede a la sección Cuenta, THE sistema SHALL mostrar el mensaje "Aquí verá sus movimientos." en lugar de la lista.
- AC-41 (FR-39, FR-40, FR-41; origen: PRD AC-38): WHEN el usuario A con 120 movimientos accede a la sección Cuenta, THE sistema SHALL mostrar los 50 movimientos más recientes, el indicador "Página 1 de 3" y el botón "Anterior" deshabilitado.
- AC-42 (FR-39, FR-40, FR-41; origen: PRD AC-39): WHEN el usuario A con 120 movimientos en la página 1 presiona "Siguiente" dos veces, THE sistema SHALL mostrar primero los movimientos 51 a 100 en el mismo orden con el indicador "Página 2 de 3", y después los 20 más antiguos con el indicador "Página 3 de 3" y el botón "Siguiente" deshabilitado.
- AC-43 (FR-41; origen: PRD AC-41): WHEN el usuario A con 30 movimientos accede a la sección Cuenta, THE sistema SHALL mostrar los 30 movimientos sin los botones "Anterior" y "Siguiente" ni el indicador de página.
- AC-44 (FR-42; origen: PRD AC-40): WHEN el usuario A con 120 movimientos que está en la página 2 añade un gasto con fecha de hoy, THE sistema SHALL mostrar la página 1 con el indicador "Página 1 de 3" y el gasto nuevo en primer lugar.
- AC-63 (FR-47): WHEN el usuario A con 55 movimientos, de los cuales los que ocupan los lugares 48 a 55 de la lista son del 01/10/2026, presiona "Siguiente", THE sistema SHALL mostrar al principio de la página 2 el encabezado "01/10/2026" seguido de los movimientos 51 a 55.
- AC-64 (FR-41): WHEN el usuario A con 50 movimientos accede a la sección Cuenta, THE sistema SHALL mostrar los 50 sin los botones "Anterior" y "Siguiente" ni el indicador de página; WHEN después registra un movimiento más, THE sistema SHALL mostrar el indicador "Página 1 de 2" y el botón "Siguiente" habilitado.

**Mensajes**

- AC-45 (FR-43; origen: PRD AC-111, AC-UI-15): WHEN el usuario A registra un gasto, THE sistema SHALL mostrar "Gasto registrado con éxito." con un ícono de tic verde, sin el botón "Aceptar", y cerrarlo solo a los 3 segundos.
- AC-46 (FR-43; origen: PRD AC-128): WHEN el usuario A, con el mensaje "Gasto registrado con éxito." todavía en pantalla, presiona "Añadir Gasto", ingresa el monto 500 y presiona "Guardar", THE sistema SHALL registrar el segundo gasto sin que haya tenido que cerrar el primer mensaje, en 3 interacciones, reemplazar el primer mensaje por el nuevo "Gasto registrado con éxito." y mantener el nuevo visible durante 3 segundos completos desde que aparece.
- AC-47 (FR-44; origen: PRD AC-113): WHILE el mensaje "El monto debe ser mayor a 0." está en pantalla, WHEN pasan 10 segundos sin que el usuario A presione "Aceptar" y después lo presiona, THE sistema SHALL mantener el mensaje visible a los 10 segundos y cerrarlo al presionar "Aceptar".
- AC-48 (FR-45, NFR-06): IF falla la carga de la cuenta, el saldo o la lista al mostrar la sección Cuenta (simulado en la prueba), THEN THE sistema SHALL mostrar "No se pudieron cargar sus movimientos. Vuelva a intentarlo." con el botón "Aceptar" y, al presionarlo con el servidor ya respondiendo, cargar y mostrar el saldo y la lista.
- AC-70 (FR-45, NFR-06; agregado por FIX-001): IF al mostrar la sección Cuenta la lista llega con un movimiento de monto "abc", o la cuenta llega con el saldo "abc" (simulado en la prueba), THEN THE sistema SHALL mostrar en ambos casos "No se pudieron cargar sus movimientos. Vuelva a intentarlo." con el botón "Aceptar", sin dejar la pantalla en blanco, y, al presionarlo con el servidor ya respondiendo datos válidos, cargar y mostrar el saldo y la lista.
- AC-71 (FR-44, NFR-07; agregado por FIX-001): IF el usuario A, que llegó a la sección Cuenta desde "Añadir Gasto", vuelve a "Añadir Gasto" con el botón Atrás del navegador mientras se procesa la eliminación de un movimiento y la eliminación falla (simulado en la prueba), THEN THE sistema SHALL mostrar "No se pudo eliminar el movimiento. Vuelva a intentarlo." y, al presionar "Aceptar", cerrar el mensaje y dejar el foco en la flecha para volver atrás de "Añadir Gasto", el primer control enfocable de esa pantalla.
- AC-72 (FR-44, NFR-07; agregado por FIX-001): WHILE el mensaje "No se pudieron cargar sus movimientos. Vuelva a intentarlo." está en pantalla, WHEN el usuario A hace clic en el fondo del mensaje o en su texto y después presiona Tab, THE sistema SHALL mantener el foco en "Aceptar" en los dos casos.
- AC-49 (FR-46, NFR-06): IF el servidor falla al guardar un gasto de 1500 del usuario A con saldo USD 10.000,00 (simulado en la prueba), THEN THE sistema SHALL mostrar "No se pudo guardar el movimiento. Vuelva a intentarlo.", mantener abierto el formulario con el monto "1.500" y la categoría y la fecha elegidas, no agregar el movimiento a la lista y mantener el saldo en "USD 10.000,00".

**No funcionales**

- AC-50 (NFR-01; origen: PRD AC-115): WHEN se ejecutan 100 altas de movimientos sobre una cuenta con 5.000 movimientos bajo las condiciones de medición, THE sistema SHALL completar cada alta, desde que se presiona "Guardar" hasta que la lista y el saldo se muestran actualizados, con un p95 menor a 2 segundos.
- AC-51 (NFR-02; origen: PRD AC-116): IF el usuario A autenticado consulta directamente la API de Supabase la cuenta, las categorías y los movimientos del usuario B filtrando por sus identificadores, THEN THE sistema SHALL devolver 0 registros en cada consulta.
- AC-52 (NFR-02; origen: PRD AC-117): IF el usuario A autenticado intenta editar y eliminar mediante la API la cuenta, una categoría y un movimiento del usuario B usando sus identificadores, THEN THE sistema SHALL rechazar todas las operaciones y los datos de B SHALL quedar sin cambios.
- AC-53 (NFR-02; origen: PRD AC-118): IF el usuario A autenticado intenta crear mediante la API un movimiento en la cuenta del usuario B, y otro en su propia cuenta usando una categoría de B, THEN THE sistema SHALL rechazar ambas operaciones y los saldos de A y de B SHALL quedar sin cambios.
- AC-54 (NFR-04): IF el usuario A con saldo USD 10.000,00 intenta modificar directamente desde la API el saldo de su cuenta, o crear, editar o eliminar uno de sus movimientos sin pasar por las operaciones de la aplicación, THEN THE sistema SHALL rechazar la operación o mantener el saldo igual a la suma de los ingresos menos la suma de los gastos de la cuenta, verificado después de cada intento.
- AC-55 (NFR-03; origen: PRD AC-121): WHEN el usuario A con saldo USD 0,00 registra un ingreso de 0,10 y otro de 0,20, THE sistema SHALL mostrar el saldo "USD 0,30" y almacenar los montos y el saldo en columnas de tipo numeric.
- AC-56 (NFR-03; origen: PRD AC-122): WHEN el usuario A con saldo USD 0,00 registra dos ingresos de 999.999.999.999,99, THE sistema SHALL registrar ambos y mostrar el saldo "USD 1.999.999.999.999,98".
- AC-57 (NFR-04; origen: PRD AC-123): IF se simula una falla después de escribir el movimiento y antes de actualizar el saldo al dar de alta un gasto de 1000 del usuario A con saldo USD 10.000,00, THEN THE sistema SHALL no registrar ningún movimiento, mantener el saldo en USD 10.000,00, mostrar "No se pudo guardar el movimiento. Vuelva a intentarlo." y mantener abierto el formulario con los datos ingresados.
- AC-58 (NFR-04; adapta PRD AC-125): WHEN se ejecuta sobre el usuario A con saldo USD 0,00 una secuencia fija, definida en la prueba, de 20 altas de ingresos y gastos intercalados, THE sistema SHALL mantener después de cada alta el saldo igual a la suma de los ingresos menos la suma de los gastos de la cuenta.
- AC-59 (NFR-05; adapta PRD AC-126): WHEN el usuario A usa la sección Cuenta y el formulario de alta con anchos de viewport de 320px, 768px, 1280px y 1920px, THE sistema SHALL permitir en cada ancho ver el saldo y la lista, paginar y registrar un gasto y un ingreso, sin desplazamiento horizontal.
- AC-60 (NFR-06; adapta PRD AC-127): IF se simula una falla del servidor en el inicio de sesión, en la carga de la cuenta y la lista y en el alta de un movimiento, THEN THE sistema SHALL mostrar en cada caso un mensaje en español, tratando de usted, sin códigos de error internos ni stack traces.
- AC-61 (NFR-07; adapta PRD AC-133): WHEN el usuario A usa solo el teclado para registrar un gasto y un ingreso, incluidos el calendario, el selector de categoría, la paginación y los mensajes, THE sistema SHALL permitir completar todas las acciones, distinguir visualmente el elemento con foco en cada paso y exponer a un lector de pantalla el texto alternativo de los íconos de tic, de cruz y de la flecha para volver atrás.
- AC-62 (NFR-08; adapta AC-UI-12): WHEN se analizan con axe-core la sección Cuenta (con saldo positivo, negativo y cero, y con la lista y la paginación), los formularios "Añadir Gasto" y "Añadir Ingreso" con el calendario y el selector abiertos, y los mensajes de éxito y de error, THE sistema SHALL tener el 100% de los textos con un contraste de al menos 4,5:1 (3:1 para texto grande) y los íconos de tic y de cruz con al menos 3:1.
- AC-68 (FR-49): IF el usuario A autenticado intenta desde la API crear una categoría de gastos "Viajes", renombrar a "Otra" una categoría "Mercado" cargada por la prueba o eliminarla, THEN THE sistema SHALL rechazar las tres operaciones, no crear "Viajes" y mantener "Mercado" con su nombre.
- AC-69 (FR-50): IF el usuario A autenticado con la cuenta "Mi Cuenta" en USD y saldo USD 0,00 intenta desde la API cambiar el nombre de su cuenta a "", la moneda a "ARS" o el saldo a 1000000, THEN THE sistema SHALL rechazar las tres operaciones y la sección Cuenta SHALL seguir mostrando "Mi Cuenta (USD)" y el saldo "USD 0,00".

## Out of Scope

- Edición de movimientos: es FEAT-001b.
- Eliminación de movimientos: es FEAT-001c.
- El menú de la fila de un movimiento con "Editar" y "Eliminar" (RF-56): llega con FEAT-001b.
- Creación, edición y eliminación de categorías propias y la sección Categorías (RF-70 a RF-89, salvo RF-87 y RF-88 para las categorías por defecto) (S-2).
- Barra de navegación y secciones Categorías, Reportes y Perfil (RF-26, RF-02) (S-3).
- "Editar Cuenta": cambio de nombre y de moneda, y la lista de monedas ISO 4217 (RF-06 a RF-14).
- Restablecer Cuenta (RF-15 a RF-21).
- Inicio de sesión con Google, cierre de sesión y la pantalla de inicio de sesión (RF-22 a RF-24, RF-27): se reemplazará el inicio de sesión anónimo sin tocar la lógica de movimientos.
- Reportes y su rendimiento (RF-92 a RF-103, RNF-01, UI-12, UI-13).
- Todo lo listado en "Fuera de Alcance" de `PRD.md` (múltiples cuentas, transferencias, multi-idioma, fechas futuras, notas, búsqueda, filtros de la lista, etc.).

## Risks and Mitigations

- Riesgo: saldo inconsistente o estado parcial en el alta → mitigación: el alta y la actualización del saldo se ejecutan en una sola operación atómica en la base de datos, probada con fallas simuladas (NFR-04, AC-57, AC-58).
- Riesgo: un usuario accede a datos de otro → mitigación: políticas de acceso en Supabase restringidas al propietario, verificadas con pruebas directas contra la API (NFR-02, AC-51 a AC-53).
- Riesgo: el saldo se modifica por fuera de las operaciones de la aplicación → mitigación: el saldo solo cambia a través de las operaciones de alta de movimientos (y, en FEAT-001b y FEAT-001c, de edición y eliminación), y se prueban los intentos de alterarlo directamente desde la API (AC-54, AC-69).
- Riesgo: categorías o datos de la cuenta inválidos creados desde la API antes de que existan sus features (nombres vacíos, duplicados, moneda cambiada con movimientos) → mitigación: en este sub-ticket la API no permite crear, editar ni eliminar categorías ni modificar la cuenta (FR-49, FR-50).
- Riesgo: errores de precisión con decimales → mitigación: tipo numeric para montos y saldo, y pruebas con 0,10 + 0,20 y con el monto máximo (NFR-03, AC-55, AC-56).
- Riesgo: corrimiento del día por zona horaria → mitigación: la fecha es un día calendario (`date`), "hoy" se calcula con la fecha local del dispositivo y el servidor solo rechaza fechas posteriores a mañana en UTC (FR-20, FR-22, AC-29, AC-31).
- Riesgo: límite de Supabase de ~30 inicios de sesión anónimos por hora por IP, que puede frenar las pruebas automatizadas → mitigación: reutilizar usuarios de prueba dentro de una corrida, marcarlos con `es_prueba = true` y borrarlos con el script de limpieza (ver `AGENTS.md`).
- Riesgo: con la sesión anónima, los datos del usuario quedan atados a ese navegador en ese dispositivo; si borra los datos del navegador, usa modo incógnito o entra desde otro dispositivo, obtiene una cuenta nueva vacía y la anterior no se puede recuperar → mitigación: no abrir la aplicación a usuarios reales hasta incorporar Google OAuth (RF-22, RF-23).
- Riesgo: el código de la sesión anónima se mezcla con la lógica de movimientos y encarece pasar a Google OAuth → mitigación: el inicio de sesión queda aislado en un módulo propio (ver "Architecture conventions" en `AGENTS.md`).
- Riesgo: pausa del proyecto de Supabase por inactividad en el plan gratuito → mitigación: la que indica `PRD.md` (monitorear el uso y evaluar un plan pago antes de abrir a usuarios reales).

## Dependencies

- Documentos de producto: `docs/daw/prd/PRD.md` (RF-xx, RNF-xx, AC-xx de origen) y `docs/daw/prd/INTERFAZ.md` (UI-xx, AC-UI-xx de origen).
- Un proyecto de Supabase con "Allow anonymous sign-ins" activado, su URL y su anon key en `.env.local`, y su service role key disponible solo para las pruebas (S-2), nunca en el código de la aplicación.
- Stack de `AGENTS.md`: React 19 + Vite, supabase-js, react-router, react-day-picker + date-fns, Vitest + Testing Library, Playwright + axe-core.
- No depende de otros sub-tickets. FEAT-001b y FEAT-001c dependen de este.
- AC-71, agregado por FIX-001, usa la eliminación de movimientos de FEAT-001c (`docs/daw/prd/prd-FEAT-001c.md`, FR-10), ya integrada en main, como caso en que el elemento de origen del foco deja de estar en pantalla.
