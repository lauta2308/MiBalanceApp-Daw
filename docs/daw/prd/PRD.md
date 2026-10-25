# PRD-001: MiBalance — Control de ingresos y gastos

## Contexto y Problema

El público objetivo está compuesto por profesionales y trabajadores activos de entre 25 y 45 años que perciben ingresos regulares pero experimentan dificultades para retener su dinero al final del mes. La convivencia diaria con múltiples canales de pago digitales, compras online con tarjeta, transferencias rápidas y micro-suscripciones recurrentes (streaming, software, membresías) fomenta el fenómeno del "gasto hormiga invisible". Al no consolidar sus salidas de dinero en un solo lugar, los usuarios pierden la noción real de cuánto están gastando en el día a día.

El problema radica en que las aplicaciones de los bancos tradicionales no están diseñadas para ayudar al usuario a ahorrar, sino solo para mostrarle transacciones pasadas. Estas herramientas listan los movimientos de forma pasiva, con nombres comerciales y sin un análisis inmediato del consumo mensual acumulado.

Al carecer de una plataforma que centralice de manera ágil todos sus flujos financieros en una única cuenta de balance central, el usuario sufre las siguientes consecuencias:

- Pérdida de control mensual: Desconoce con precisión en qué categorías no esenciales (delivery, cafeterías, ocio) se diluye su dinero a lo largo del mes.
- Incapacidad de reacción: Al no tener una visión clara del dinero neto disponible frente a los consumos acumulados del periodo, no puede ajustar sus hábitos antes de que termine el mes.
- Estancamiento financiero: La falta de visibilidad sobre sus ingresos, gastos y hábitos de consumo dificulta identificar gastos innecesarios y limita su capacidad de ahorro, reduciendo la posibilidad de acumular capital para proyectos a mediano y largo plazo (inversiones, viajes o un fondo de emergencia).

Personas:

- Lucía (profesional, 28 años). Tiene ingresos regulares, pero realiza numerosos gastos pequeños mediante tarjetas, transferencias y billeteras digitales. Quiere saber rápidamente en qué está gastando su dinero y cuánto le queda disponible al final del mes.
- Nicolás (trabajador independiente, 34 años). Tiene ingresos variables y múltiples gastos recurrentes. Quiere centralizar sus movimientos y obtener una visión clara de su situación financiera sin tener que revisar diferentes aplicaciones.
- Julieta (profesional, 35 años). Tiene capacidad de ahorro, pero no logra identificar qué gastos están reduciendo su dinero disponible. Quiere detectar las categorías donde más gasta y controlar su evolución durante el mes.

## Objetivos

- O-1. Centralizar y controlar los ingresos y gastos del usuario, permitiéndole conocer de forma clara su saldo y evolución financiera.
  - Se cumple cuando: el saldo se ve en la pantalla inicial sin navegar (0 interacciones luego de iniciar sesión) y un gasto con la categoría y la fecha por defecto se registra en 3 interacciones desde la sección Cuenta ("Añadir Gasto" → monto → guardar); el mensaje de éxito se cierra solo, sin sumar interacciones (RF-104).
- O-2. Visualizar y analizar los gastos por categoría mediante reportes y gráficos, facilitando la identificación de los principales focos de consumo y del gasto hormiga.
  - Se cumple cuando: desde la sección Cuenta el usuario ve el gráfico de gastos por categoría del mes en curso en 1 interacción (entrar a Reportes).
- O-3. Facilitar la toma de decisiones durante el mes, proporcionando información que permita al usuario detectar desvíos en sus hábitos de consumo antes de finalizar el período.
  - Se cumple cuando: el usuario puede ver los gastos por categoría del mes en curso (parcial hasta hoy) y compararlos con los de meses anteriores navegando entre períodos.
- O-4. Favorecer la capacidad de ahorro, ayudando al usuario a identificar gastos innecesarios y comprender cómo sus hábitos de consumo afectan el dinero disponible.
  - Se cumple cuando: el usuario puede identificar la categoría con mayor gasto de cualquier día, semana, mes o año calendario.

## Requerimientos Funcionales

Los formatos, colores e íconos de la interfaz se definen en `INTERFAZ.md`.

### Navegación

- RF-01: El sistema debe mostrar una flecha para volver atrás en todas las pantallas, salvo en la sección Cuenta y en la pantalla de inicio de sesión.
- RF-02: El sistema debe volver a la sección Cuenta al presionar la flecha para volver atrás en las secciones Categorías, Reportes y Perfil.
- RF-03: El sistema debe cerrar sin guardar cambios y volver a la pantalla anterior al presionar la flecha para volver atrás en los formularios de añadir o editar un movimiento, de crear o editar una categoría y de "Editar Cuenta".

### Cuenta

- RF-04: El sistema debe crear una cuenta por defecto llamada "Mi Cuenta" con moneda USD para cada usuario que se registre en el sistema.
- RF-05: El sistema debe crear las categorías por defecto "Pago Realizado" (tipo gasto) y "Pago Ingresado" (tipo ingreso) en la cuenta de cada usuario que se registre en el sistema.
- RF-06: El sistema debe permitir cambiar el nombre de la cuenta desde la opción "Editar Cuenta" de la sección Cuenta.
- RF-07: El sistema debe conservar sin cambios los movimientos, las categorías, el saldo y la moneda de la cuenta cuando se cambie su nombre.
- RF-08: El sistema debe rechazar un nombre de cuenta vacío o compuesto solo por espacios.
- RF-09: El sistema debe impedir ingresar más de 30 caracteres en el nombre de la cuenta.
- RF-10: El sistema debe guardar el nombre de la cuenta sin los espacios al inicio y al final.
- RF-11: El sistema debe permitir cambiar la moneda de la cuenta siempre que no tenga movimientos registrados.
- RF-12: El sistema debe permitir elegir la moneda de una lista guardada en la base de datos de la aplicación (sin consultar sitios externos) con las monedas de la lista oficial ISO 4217 publicada en iso.org, con una entrada por código y sin incluir XXX ni XTS (no son monedas), los metales (XAU, XAG, XPT, XPD), las unidades de cuenta de organismos internacionales (XDR, XSU, XUA, XBA, XBB, XBC, XBD) ni las unidades que ISO marca como fondo (ej. BOV, CLF), mostrando cada una con su código y su nombre oficial en inglés tal como lo publica ISO (ej. "ARS — Argentine Peso").
- RF-13: El sistema debe mostrar el mensaje "Cuenta actualizada con éxito." al guardar un cambio de nombre o de moneda de la cuenta.
- RF-14: El sistema debe permitir cerrar el formulario "Editar Cuenta" sin guardar cambios con la opción "Cancelar".

### Restablecer Cuenta

- RF-15: El sistema debe solicitar confirmación, con las opciones "Confirmar" y "Cancelar", cuando el usuario seleccione la opción "Restablecer Cuenta" de la sección Perfil.
- RF-16: El sistema debe eliminar todos los movimientos de la cuenta al confirmarse el restablecimiento.
- RF-17: El sistema debe eliminar las categorías creadas por el usuario al confirmarse el restablecimiento, conservando las categorías por defecto "Pago Realizado" y "Pago Ingresado".
- RF-18: El sistema debe dejar el saldo de la cuenta en 0 al confirmarse el restablecimiento.
- RF-19: El sistema debe restaurar el nombre de la cuenta a "Mi Cuenta" al confirmarse el restablecimiento.
- RF-20: El sistema debe restaurar la moneda de la cuenta a USD al confirmarse el restablecimiento.
- RF-21: El sistema debe mostrar el mensaje "Cuenta restablecida con éxito." al completarse el restablecimiento de la cuenta.

### Autenticación y Perfil

- RF-22: El sistema debe permitir registrarse a través de Google con el botón "Iniciar Sesión con Google".
- RF-23: El sistema debe permitir iniciar sesión a través de Google con el botón "Iniciar Sesión con Google".
- RF-24: El sistema debe mostrar la pantalla de inicio de sesión con un mensaje de error cuando la autenticación con Google se cancela o falla.
- RF-25: El sistema debe mostrar la sección Cuenta como pantalla inicial luego de que el usuario se autentique con Google.
- RF-26: El sistema debe permitir navegar entre las secciones "Cuenta", "Categorías", "Reportes" y "Perfil" desde una barra de navegación visible en esas cuatro secciones.
- RF-27: El sistema debe cerrar la sesión del usuario cuando seleccione la opción "Cerrar Sesión" de la sección Perfil.
- RF-28: El sistema debe mantener la sesión iniciada al cerrar y volver a abrir el navegador, hasta que el usuario seleccione "Cerrar Sesión".

### Movimientos

- RF-29: El sistema debe permitir añadir un gasto desde la sección Cuenta con el botón "Añadir Gasto", ingresando el monto, la categoría y la fecha, los tres obligatorios.
- RF-30: El sistema debe permitir añadir un ingreso desde la sección Cuenta con el botón "Añadir Ingreso", ingresando el monto, la categoría y la fecha, los tres obligatorios.
- RF-31: El sistema debe mostrar el formulario de añadir un movimiento sin conservar los valores ingresados en un intento anterior: con el monto vacío y con la fecha y la categoría en sus valores por defecto.
- RF-32: El sistema debe impedir que un movimiento quede sin categoría: el selector de categoría siempre tiene una categoría seleccionada.
- RF-33: El sistema debe impedir que un movimiento quede sin fecha: el calendario siempre tiene una fecha seleccionada.
- RF-34: El sistema debe preseleccionar el día de hoy en el calendario al añadir un movimiento.
- RF-35: El sistema debe preseleccionar la categoría "Pago Realizado" al abrir el formulario de añadir un gasto.
- RF-36: El sistema debe preseleccionar la categoría "Pago Ingresado" al abrir el formulario de añadir un ingreso.
- RF-37: El sistema debe mostrar un calendario para seleccionar solo la fecha (sin hora) de un movimiento.
- RF-38: El sistema debe deshabilitar en el calendario los días posteriores a hoy.
- RF-107: El sistema debe rechazar, también cuando la operación llega directamente desde la API, el registro o la edición de un movimiento con fecha posterior a la de mañana según la hora universal (UTC); ese margen cubre el "hoy" de todas las zonas horarias, porque el servidor no conoce la zona del usuario.
- RF-108: El sistema debe aceptar cualquier fecha pasada en un movimiento, sin una fecha mínima.
- RF-39: El sistema debe mostrar en el selector de categoría de un movimiento solo las categorías del mismo tipo que el movimiento.
- RF-40: El sistema debe mostrar las categorías en el selector de categoría de un movimiento en el mismo orden que en la sección Categorías.
- RF-41: El sistema debe rechazar el registro o la edición de un movimiento cuyo monto esté vacío o no sea mayor a 0.
- RF-42: El sistema debe rechazar el registro o la edición de un movimiento cuyo monto sea mayor a 999.999.999.999,99.
- RF-43: El sistema debe impedir ingresar más de dos decimales en el monto de un movimiento.
- RF-44: El sistema debe aceptar que el usuario escriba en el campo de monto de un movimiento solo dígitos y una coma decimal, sin signos ni letras.
- RF-45: El sistema debe aumentar el saldo de la cuenta cuando se registre un ingreso.
- RF-46: El sistema debe disminuir el saldo de la cuenta cuando se registre un gasto.
- RF-47: El sistema debe permitir registrar un gasto mayor que el saldo de la cuenta, dejando el saldo en negativo.
- RF-48: El sistema debe mostrar en la sección Cuenta la lista de movimientos ordenada por la fecha del movimiento, de la más reciente a la más antigua y, dentro de una misma fecha, por el momento del alta, del más reciente al más antiguo (editar un movimiento no cambia su momento de alta).
- RF-49: El sistema debe mostrar el mensaje "Aquí verá sus movimientos." en la sección Cuenta cuando la cuenta no tenga movimientos.
- RF-50: El sistema debe mostrar la lista de movimientos en páginas de 50 movimientos.
- RF-51: El sistema debe permitir navegar a la página anterior y a la siguiente de la lista con los botones "Anterior" y "Siguiente".
- RF-52: El sistema debe deshabilitar el botón "Anterior" en la primera página de la lista y el botón "Siguiente" en la última.
- RF-53: El sistema debe mostrar el indicador "Página X de Y" debajo de la lista de movimientos.
- RF-54: El sistema debe mostrar los botones de paginación y el indicador de página solo cuando la cuenta tenga más de 50 movimientos.
- RF-55: El sistema debe mostrar la página 1 de la lista de movimientos luego de guardar el alta, la edición o la eliminación de un movimiento.
- RF-56: El sistema debe mostrar un menú con las opciones "Editar" y "Eliminar" al presionar (con un toque o un clic) la fila de un movimiento en la lista.
- RF-57: El sistema debe abrir el formulario de edición de un movimiento al elegir "Editar" en el menú de su fila.
- RF-58: El sistema debe permitir editar el monto, la categoría y la fecha de un movimiento.
- RF-59: El sistema debe permitir cambiar el tipo de un movimiento (de gasto a ingreso o de ingreso a gasto) al editarlo, conservando su monto.
- RF-60: El sistema debe mostrar en el formulario de edición de un movimiento un selector de tipo con las opciones "Gasto" e "Ingreso", con el tipo registrado del movimiento seleccionado.
- RF-61: El sistema debe asignar la categoría por defecto del nuevo tipo cuando se cambie el tipo de un movimiento, salvo que el usuario elija otra categoría de ese tipo.
- RF-62: El sistema debe preseleccionar en el calendario la fecha registrada del movimiento al editarlo.
- RF-63: El sistema debe recalcular el saldo de la cuenta cuando se edite el monto o el tipo de un movimiento.
- RF-64: El sistema debe permitir cerrar los formularios de añadir y de editar un movimiento sin guardar cambios con la opción "Cancelar".
- RF-65: El sistema debe ofrecer la opción de eliminar un movimiento solo desde el menú de su fila, sin mostrarla en el formulario de edición.
- RF-66: El sistema debe permitir eliminar un movimiento.
- RF-67: El sistema debe solicitar confirmación antes de eliminar un movimiento, con las opciones "Confirmar" y "Cancelar".
- RF-68: El sistema debe recalcular el saldo de la cuenta cuando se elimine un movimiento.
- RF-106: El sistema debe deshabilitar el botón "Guardar" de los formularios de un movimiento o el botón "Confirmar" de su eliminación mientras se procesa la operación, mostrando el texto "Guardando…" o "Eliminando…", sin permitir editar ni cerrar el formulario o la confirmación hasta que termine, de modo que cada confirmación registre una sola operación.
- RF-69: El sistema debe mostrar un mensaje de éxito al completar una operación sobre un movimiento: "Gasto registrado con éxito.", "Ingreso registrado con éxito.", "Movimiento actualizado con éxito." o "Movimiento eliminado con éxito.", según corresponda.

### Categorías

- RF-70: El sistema debe mostrar en la sección Categorías las categorías de la cuenta agrupadas bajo los títulos "Ingresos" y "Gastos", en ese orden.
- RF-71: El sistema debe ordenar las categorías de cada grupo con la categoría por defecto primero y después las creadas por el usuario en orden alfabético, sin distinguir mayúsculas/minúsculas ni tildes.
- RF-72: El sistema debe mostrar las opciones "Editar" y "Eliminar" en cada categoría de la sección Categorías.
- RF-73: El sistema debe abrir el formulario de crear una categoría al presionar el botón "Nueva Categoría" en la sección Categorías.
- RF-74: El sistema debe permitir crear categorías de ingresos y de gastos.
- RF-75: El sistema debe mostrar un desplegable con las opciones "Ingreso" y "Gasto" al presionar el campo de tipo del formulario de crear o de editar una categoría.
- RF-76: El sistema debe rechazar la creación de una categoría sin un tipo seleccionado.
- RF-77: El sistema debe rechazar un nombre de categoría vacío o compuesto solo por espacios.
- RF-78: El sistema debe impedir ingresar más de 30 caracteres en el nombre de una categoría.
- RF-79: El sistema debe impedir crear una categoría con un nombre que ya exista entre las categorías del mismo tipo (ingreso o gasto) de la cuenta, incluidas las categorías por defecto, sin distinguir mayúsculas/minúsculas, tildes ni espacios al inicio o al final.
- RF-80: El sistema debe guardar el nombre de una categoría sin los espacios al inicio y al final.
- RF-81: El sistema debe permitir editar el nombre y el tipo de una categoría creada por el usuario siempre que no tenga movimientos asociados.
- RF-82: El sistema debe impedir guardar la edición de una categoría si su nombre ya existe entre las categorías del tipo resultante de la cuenta, incluidas las categorías por defecto, sin distinguir mayúsculas/minúsculas, tildes ni espacios al inicio o al final.
- RF-83: El sistema debe permitir eliminar una categoría creada por el usuario siempre que no tenga movimientos asociados.
- RF-84: El sistema debe solicitar confirmación antes de eliminar una categoría, con las opciones "Confirmar" y "Cancelar".
- RF-85: El sistema debe permitir cerrar los formularios de crear y de editar una categoría sin guardar cambios con la opción "Cancelar".
- RF-86: El sistema debe mostrar el formulario de crear una categoría con el nombre vacío y el campo de tipo con el texto "Seleccione", sin un tipo preseleccionado y sin conservar los valores ingresados en un intento anterior.
- RF-87: El sistema debe impedir editar las categorías por defecto "Pago Realizado" y "Pago Ingresado".
- RF-88: El sistema debe impedir eliminar las categorías por defecto "Pago Realizado" y "Pago Ingresado".
- RF-89: El sistema debe mostrar un mensaje de éxito al completar una operación sobre una categoría: "Categoría creada con éxito.", "Categoría actualizada con éxito." o "Categoría eliminada con éxito.", según corresponda.

### Formularios

- RF-90: El sistema debe mostrar los formularios de edición de un movimiento, de una categoría y de "Editar Cuenta" con los valores guardados, sin conservar los cambios descartados con "Cancelar" o con la flecha para volver atrás.
- RF-91: El sistema debe mostrar el botón "Guardar" en los formularios de añadir y de editar un movimiento, de crear y de editar una categoría y de "Editar Cuenta".

### Reportes

- RF-92: El sistema debe permitir elegir en la sección Reportes el tipo de movimiento a analizar: ingresos o gastos.
- RF-93: El sistema debe permitir elegir en la sección Reportes el tipo de gráfico: torta o barras.
- RF-94: El sistema debe mostrar, al entrar a la sección Reportes, los gastos del mes en curso en un gráfico de torta.
- RF-95: El sistema debe permitir filtrar los reportes por período calendario: día, semana (de lunes a domingo), mes o año.
- RF-96: El sistema debe mostrar el período en curso, con los movimientos registrados hasta hoy, al elegir el filtro día, semana, mes o año.
- RF-97: El sistema debe permitir navegar al período anterior y al siguiente del filtro día, semana, mes o año elegido, sin avanzar más allá del período en curso.
- RF-98: El sistema debe actualizar el gráfico apenas el usuario cambie cualquier opción de la sección Reportes, sin un botón de aplicar.
- RF-99: El sistema debe mostrar en el gráfico de torta el porcentaje de cada categoría sobre el total del período filtrado como número entero (ej. "34%"), de modo que la suma sea siempre 100%: cada porcentaje se redondea hacia abajo y los puntos que faltan se suman de a uno a las categorías con mayor parte decimal y, ante empate, a la primera en orden alfabético.
- RF-100: El sistema debe mostrar en el gráfico de barras el monto de cada categoría en el período filtrado, sin código de moneda.
- RF-101: El sistema debe ordenar las barras del gráfico de barras de mayor a menor monto y, ante montos iguales, por nombre de categoría en orden alfabético.
- RF-102: El sistema debe mostrar en el gráfico solo las categorías que tengan movimientos en el período filtrado.
- RF-103: El sistema debe mostrar el mensaje "Sin movimientos en este período." en lugar del gráfico cuando no haya movimientos del tipo elegido en el período filtrado.

### Mensajes

- RF-104: El sistema debe mostrar cada mensaje de éxito durante 3 segundos y cerrarlo solo, sin un botón "Aceptar" y sin impedir que el usuario siga usando la aplicación mientras se muestra.
- RF-105: El sistema debe mostrar cada mensaje de error, incluidos los de validación, hasta que el usuario presione su botón "Aceptar".

## Requerimientos No Funcionales

Condiciones de medición de rendimiento (RNF-01 y RNF-02): cuenta con 5.000 movimientos, Google Chrome (versión estable) con la ralentización de CPU 4× de DevTools (simula un celular de gama media), conexión de al menos 10 Mbps con latencia de hasta 100 ms al servidor, y al menos 100 mediciones por operación.

- RNF-01: Cuando el usuario cambie cualquier opción de la sección Reportes (tipo de movimiento, tipo de gráfico, período o navegación entre períodos), el gráfico debe actualizarse en menos de 1 segundo (p95), bajo las condiciones de medición indicadas.
- RNF-02: Las operaciones de creación, edición y eliminación de movimientos deben completarse, desde que el usuario confirma la acción hasta que la lista y el saldo se muestran actualizados, en menos de 2 segundos (p95), bajo las condiciones de medición indicadas.
- RNF-03: El sistema debe rechazar el 100% de los intentos de lectura, creación, edición o eliminación de movimientos, categorías o cuentas cuyo propietario no sea el usuario autenticado, y el 100% de los intentos de crear, editar o eliminar monedas de la lista de monedas, verificado mediante pruebas automatizadas que accedan directamente a la API de Supabase sin pasar por la interfaz.
- RNF-04: El 100% de los montos financieros deben almacenarse y procesarse utilizando una representación numérica (tipo decimal/numeric, no float) que permita mantener al menos dos posiciones decimales sin pérdida de precisión; el saldo se almacena sin tope de dígitos enteros, de modo que ninguna suma de movimientos válidos lo desborde.
- RNF-05: Ante una falla durante una operación de alta, edición (incluido el cambio de tipo) o eliminación de movimientos, o durante el restablecimiento de la cuenta, la cuenta, sus movimientos, sus categorías y su saldo deben quedar exactamente como estaban antes de la operación (0 casos de estado parcial), y en todo momento el saldo debe ser igual a la suma de los ingresos menos la suma de los gastos de la cuenta; verificable mediante pruebas que simulen fallas a mitad de la operación.
- RNF-06: La interfaz debe ser utilizable sin pérdida de funcionalidad en anchos de viewport desde 320px hasta 1920px, verificado al menos en 320px (móvil), 768px (tablet), 1280px (escritorio) y 1920px (escritorio grande).
- RNF-07: El sistema debe mostrar un mensaje de error en español, tratando de usted y sin detalles técnicos (códigos de error internos, stack traces), para el 100% de las operaciones que puedan fallar: alta, edición y eliminación de movimientos; creación, edición y eliminación de categorías; cambio de nombre y de moneda de la cuenta; restablecimiento de la cuenta; carga de la lista de movimientos; carga de la lista de categorías; carga de la lista de monedas; carga de reportes; y autenticación.
- RNF-08: El 100% de las acciones de la interfaz debe poder realizarse solo con el teclado, con el foco visible en todo momento, y todos los íconos que transmiten información (tic de éxito, cruz de error, flecha para volver atrás) deben tener un texto alternativo que lea un lector de pantalla.

## Criterios de Aceptación

### Navegación

- AC-01 (RF-26): Dado el usuario A con sesión iniciada, cuando accede a la sección Cuenta, entonces se muestra la barra de navegación con "Cuenta", "Categorías", "Reportes" y "Perfil".
- AC-02 (RF-26): Dado el usuario A en la sección Categorías, cuando presiona "Reportes" y después "Cuenta" en la barra de navegación, entonces se muestra primero la sección Reportes con la barra de navegación y después la sección Cuenta.
- AC-03 (RF-01): Dado el usuario A con sesión iniciada, cuando accede a la sección Cuenta, entonces no se muestra la flecha para volver atrás.
- AC-04 (RF-01, RF-02): Dado el usuario A en la sección Categorías, Reportes o Perfil, cuando presiona la flecha para volver atrás, entonces en los tres casos se muestra la sección Cuenta.
- AC-05 (RF-03): Dado el usuario A con saldo USD 10.000,00 que en "Añadir Ingreso" ingresó el monto 500, eligió la categoría "Sueldo" y cambió la fecha a 01/10/2026, cuando presiona la flecha para volver atrás, entonces se muestra la sección Cuenta, no se registra ningún movimiento y el saldo sigue en USD 10.000,00.
- AC-06 (RF-03): Dado el usuario A con un saldo actual de USD 10.000,00 que ya incluye un gasto de 3.000, cuando abre ese movimiento para editarlo, cambia el monto a 2000 y presiona la flecha para volver atrás, entonces se muestra la sección Cuenta, la lista sigue mostrando el movimiento con el monto "-3.000,00" y el saldo sigue en USD 10.000,00.
- AC-07 (RF-03): Dado el usuario A en el formulario de "Nueva Categoría", cuando escribe "Viajes" y presiona la flecha para volver atrás, entonces se muestra la sección Categorías y la categoría "Viajes" no se crea.
- AC-08 (RF-03): Dado el usuario A en "Editar Cuenta" con la cuenta llamada "Mi Cuenta", cuando escribe el nombre "Ahorros" y presiona la flecha para volver atrás, entonces se muestra la sección Cuenta y la cuenta sigue llamándose "Mi Cuenta".

### Cuenta

- AC-09 (RF-04): Dado el usuario A que acaba de registrarse, cuando accede a la sección Cuenta, entonces ve una única cuenta con el encabezado "Mi Cuenta (USD)" y el saldo "USD 0,00".
- AC-10 (RF-05, RF-26, RF-70): Dado el usuario A que acaba de registrarse, cuando presiona "Categorías" en la barra de navegación, entonces se muestra la sección Categorías con exactamente dos categorías: "Pago Ingresado" en el grupo "Ingresos" y "Pago Realizado" en el grupo "Gastos".
- AC-11 (RF-06, RF-13): Dado el usuario A con sesión iniciada y una cuenta llamada "Mi Cuenta" en USD, cuando en la sección Cuenta presiona "Editar Cuenta" y cambia el nombre de la cuenta a "Cuenta Personal", entonces el encabezado de la sección Cuenta pasa a mostrar "Cuenta Personal (USD)" y se muestra el mensaje "Cuenta actualizada con éxito.".
- AC-12 (RF-07): Dado el usuario A con una cuenta llamada "Mi Cuenta" en USD, con saldo USD 8.500,00, 3 movimientos y la categoría propia "Mercado", cuando presiona "Editar Cuenta" y cambia el nombre a "Cuenta Personal", entonces la cuenta conserva los mismos 3 movimientos con sus montos, tipos, categorías y fechas, la categoría "Mercado", la moneda USD y el saldo USD 8.500,00.
- AC-13 (RF-08): Dado el usuario A en "Editar Cuenta" con la cuenta llamada "Mi Cuenta", cuando intenta guardar el nombre vacío o compuesto solo por espacios, entonces en ambos casos el nombre no se guarda, se muestra el mensaje "Ingrese un nombre para la cuenta." y la cuenta sigue llamándose "Mi Cuenta".
- AC-14 (RF-09): Dado el usuario A en "Editar Cuenta", cuando escribe un nombre de cuenta de 30 caracteres, intenta escribir un carácter más y guarda, entonces el campo no acepta el carácter 31 y la cuenta queda con el nombre de 30 caracteres.
- AC-15 (RF-10): Dado el usuario A con la cuenta "Mi Cuenta" en USD, cuando en "Editar Cuenta" cambia el nombre a "  Ahorros  " (con espacios al inicio y al final) y guarda, entonces el encabezado de la sección Cuenta muestra "Ahorros (USD)".
- AC-16 (RF-11, RF-12, RF-13): Dado el usuario A con la cuenta "Mi Cuenta" en USD sin movimientos registrados, cuando presiona "Editar Cuenta" y selecciona "ARS — Argentine Peso" de la lista de monedas, entonces el encabezado de la sección Cuenta pasa a mostrar "Mi Cuenta (ARS)", el saldo se muestra como "ARS 0,00" y aparece el mensaje "Cuenta actualizada con éxito.".
- AC-17 (RF-11): Dado el usuario A que cambió la moneda de su cuenta "Mi Cuenta" de USD a ARS antes de registrar movimientos, cuando registra un gasto de 1500 en "Pago Realizado", entonces el encabezado muestra "Mi Cuenta (ARS)", la lista muestra ese movimiento con el monto "-1.500,00" sin código de moneda y el saldo se muestra como "ARS -1.500,00".
- AC-18 (RF-11): Dado el usuario A con una cuenta en USD que tiene movimientos registrados, cuando presiona "Editar Cuenta", entonces la opción de cambiar la moneda aparece deshabilitada.
- AC-19 (RF-11): Dado el usuario A con una cuenta en USD que tiene movimientos registrados, cuando intenta cambiar la moneda a ARS directamente desde la API, entonces el sistema rechaza el cambio y la moneda sigue siendo USD.
- AC-20 (RF-12): Dado el usuario A con una cuenta en USD sin movimientos, cuando intenta cambiar directamente desde la API la moneda a "XAU" o a "ABC", entonces el sistema rechaza ambos cambios y la moneda sigue siendo USD.
- AC-21 (RF-12): Dado el usuario A en "Editar Cuenta" con una cuenta sin movimientos, cuando abre la lista de monedas, entonces la lista contiene exactamente una entrada por cada código de la lista oficial ISO 4217 de iso.org vigente al cargarla en la base de datos, salvo XXX, XTS, XAU, XAG, XPT, XPD, XDR, XSU, XUA, XBA, XBB, XBC, XBD y las unidades que ISO marca como fondo (por ejemplo, "EUR" aparece una sola vez y "XAU" y "XDR" no aparecen), cada una con su nombre oficial en inglés, y el navegador no hace ninguna solicitud a sitios externos para mostrarla.
- AC-22 (RF-14): Dado el usuario A en "Editar Cuenta" con la cuenta llamada "Mi Cuenta", cuando escribe el nombre "Ahorros" y presiona "Cancelar", entonces el formulario se cierra y la cuenta sigue llamándose "Mi Cuenta".

### Restablecer Cuenta

- AC-23 (RF-15): Dado el usuario A con sesión iniciada, cuando en la sección Perfil selecciona "Restablecer Cuenta", entonces el sistema muestra el mensaje de confirmación "¿Está seguro que desea restablecer la cuenta? Se eliminarán sus movimientos y las categorías que creó, y la cuenta volverá a llamarse "Mi Cuenta" con moneda USD." con las opciones "Confirmar" y "Cancelar".
- AC-24 (RF-15, RF-16, RF-17, RF-18, RF-19, RF-20, RF-21): Dado el usuario A con sesión iniciada, con movimientos, categorías propias, nombre de cuenta distinto de "Mi Cuenta" y moneda distinta de USD, cuando en la sección Perfil selecciona "Restablecer Cuenta" y elige "Confirmar", entonces todos sus movimientos y categorías propias se eliminan, el saldo de la cuenta queda en 0, el nombre vuelve a ser "Mi Cuenta", la moneda vuelve a ser USD y se muestra el mensaje "Cuenta restablecida con éxito.".
- AC-25 (RF-17, RF-70): Dado el usuario A con las categorías propias "Mercado" (gasto) y "Sueldo" (ingreso), cuando en la sección Perfil selecciona "Restablecer Cuenta" y elige "Confirmar", entonces la sección Categorías muestra exactamente dos categorías: "Pago Ingresado" en el grupo "Ingresos" y "Pago Realizado" en el grupo "Gastos".
- AC-26 (RF-17, RF-35): Dado el usuario A que acaba de restablecer su cuenta, cuando registra un gasto sin cambiar la categoría preseleccionada, entonces el movimiento queda categorizado como "Pago Realizado".
- AC-27 (RF-15): Dado el usuario A con sesión iniciada, con movimientos y categorías propias registradas, cuando en la sección Perfil selecciona "Restablecer Cuenta" y elige "Cancelar", entonces no se elimina ningún movimiento ni categoría, y el saldo, el nombre y la moneda de la cuenta permanecen sin cambios.

### Autenticación y Perfil

- AC-28 (RF-22, RF-23): Dado un usuario sin sesión iniciada, cuando abre la aplicación, entonces la pantalla de inicio de sesión muestra el botón "Iniciar Sesión con Google".
- AC-29 (RF-22, RF-25): Dado un usuario que no tiene una cuenta registrada en la aplicación, cuando selecciona "Iniciar Sesión con Google", elige una cuenta de Google y autoriza el acceso, entonces el sistema crea su cuenta y muestra su sección Cuenta.
- AC-30 (RF-23, RF-25): Dado un usuario con una cuenta registrada con saldo USD 1.500,00 y 3 movimientos, cuando selecciona "Iniciar Sesión con Google", elige la misma cuenta de Google y autoriza el acceso, entonces accede a su sección Cuenta y ve el saldo USD 1.500,00 y los 3 movimientos.
- AC-31 (RF-24): Dado un usuario en la pantalla de inicio de sesión, cuando selecciona "Iniciar Sesión con Google" y cierra la ventana de Google sin autorizar el acceso, o Google responde con un error (simulado en la prueba), entonces en ambos casos permanece en la pantalla de inicio de sesión, ve el mensaje "No se pudo iniciar sesión con Google. Vuelva a intentarlo." y no accede a la sección Cuenta.
- AC-32 (RF-15, RF-26, RF-27): Dado el usuario A con sesión iniciada en la sección Cuenta, cuando presiona "Perfil" en la barra de navegación, entonces se muestra la sección Perfil con las opciones "Cerrar Sesión" y "Restablecer Cuenta".
- AC-33 (RF-27): Dado el usuario A con sesión iniciada, cuando en la sección Perfil selecciona "Cerrar Sesión", entonces se muestra la pantalla de inicio de sesión.
- AC-34 (RF-27): Dado el usuario A que cerró su sesión, cuando ingresa la dirección de la sección Cuenta en el navegador, entonces se muestra la pantalla de inicio de sesión y no se muestran sus movimientos.
- AC-35 (RF-28): Dado el usuario A con sesión iniciada, cuando cierra el navegador y vuelve a abrir la aplicación, entonces ve su sección Cuenta sin volver a iniciar sesión con Google.

### Movimientos

- AC-36 (RF-48): Dado el usuario A con un gasto de 1.500 en "Mercado" del 17/09/2026, un ingreso de 50.000 en "Sueldo" del 01/10/2026 y luego un gasto de 800 en "Café" del 01/10/2026, cuando accede a la sección Cuenta, entonces ve primero el grupo "01/10/2026" con el gasto en "Café" seguido del ingreso en "Sueldo", y después el grupo "17/09/2026" con el gasto en "Mercado".
- AC-37 (RF-48): Dado el usuario A con un gasto en "Café" y, dado de alta después, un gasto en "Mercado", ambos del 01/10/2026, cuando edita el monto del gasto en "Café" y guarda, entonces el grupo "01/10/2026" sigue mostrando "Mercado" antes que "Café".
- AC-38 (RF-50, RF-52, RF-53): Dado el usuario A con 120 movimientos, cuando accede a la sección Cuenta, entonces la lista muestra los 50 movimientos más recientes, el indicador "Página 1 de 3" y el botón "Anterior" deshabilitado.
- AC-39 (RF-50, RF-51, RF-52, RF-53): Dado el usuario A con 120 movimientos que está en la página 1 de la lista, cuando presiona "Siguiente" dos veces, entonces la lista muestra primero los movimientos 51 a 100 en el mismo orden con el indicador "Página 2 de 3", y después los 20 movimientos más antiguos con el indicador "Página 3 de 3" y el botón "Siguiente" deshabilitado.
- AC-40 (RF-55): Dado el usuario A con 120 movimientos que está en la página 2 de la lista, cuando añade un gasto con fecha de hoy, edita un movimiento de esa página o elimina un movimiento de esa página, entonces en los tres casos la lista muestra la página 1 con el indicador "Página 1 de 3" y, en el caso del alta, el gasto nuevo en primer lugar.
- AC-41 (RF-54): Dado el usuario A con 30 movimientos, cuando accede a la sección Cuenta, entonces la lista muestra los 30 movimientos y no muestra los botones "Anterior" y "Siguiente" ni el indicador de página.
- AC-42 (RF-49): Dado el usuario A sin movimientos registrados, cuando accede a la sección Cuenta, entonces ve el mensaje "Aquí verá sus movimientos." en lugar de la lista.
- AC-43 (RF-29, RF-46, RF-69): Dado el usuario A con saldo USD 10.000,00 y una categoría de gastos "Mercado", cuando en la sección Cuenta presiona "Añadir Gasto", ingresa el monto 1500, selecciona "Mercado", deja la fecha de hoy y presiona "Guardar", entonces la lista muestra, bajo la fecha de hoy, un movimiento con la categoría "Mercado" y el monto "-1.500,00", el saldo pasa a "USD 8.500,00" y se muestra el mensaje "Gasto registrado con éxito.".
- AC-44 (RF-30, RF-45, RF-69): Dado el usuario A con saldo USD 10.000,00 y una categoría de ingresos "Sueldo", cuando en la sección Cuenta presiona "Añadir Ingreso", ingresa el monto 1000, selecciona "Sueldo", deja la fecha de hoy y presiona "Guardar", entonces la lista muestra, bajo la fecha de hoy, un movimiento con la categoría "Sueldo" y el monto "+1.000,00", el saldo pasa a "USD 11.000,00" y se muestra el mensaje "Ingreso registrado con éxito.".
- AC-45 (RF-41): Dado el usuario A con saldo USD 10.000,00, cuando intenta guardar un gasto con el monto vacío o con el monto 0, entonces en ambos casos el movimiento no se registra, se muestra el mensaje "El monto debe ser mayor a 0." y el saldo sigue en USD 10.000,00.
- AC-46 (RF-42): Dado el usuario A con saldo USD 0,00, cuando intenta guardar un ingreso de 1.000.000.000.000,00 y después uno de 999.999.999.999,99, entonces el primero no se registra y se muestra el mensaje "El monto máximo es 999.999.999.999,99.", y el segundo se registra y el saldo pasa a "USD 999.999.999.999,99".
- AC-47 (RF-41): Dado el usuario A con un saldo actual de USD 10.000,00 que ya incluye un gasto de 3.000, cuando edita ese movimiento, cambia el monto a 0 o lo borra y guarda, entonces en ambos casos el cambio no se guarda, se muestra el mensaje "El monto debe ser mayor a 0.", la lista sigue mostrando el movimiento con el monto "-3.000,00" y el saldo sigue en USD 10.000,00.
- AC-48 (RF-42): Dado el usuario A con un saldo actual de USD 10.000,00 que ya incluye un gasto de 3.000, cuando edita ese movimiento, cambia el monto a 1.000.000.000.000,00 y guarda, entonces el cambio no se guarda, se muestra el mensaje "El monto máximo es 999.999.999.999,99.", la lista sigue mostrando el movimiento con el monto "-3.000,00" y el saldo sigue en USD 10.000,00.
- AC-49 (RF-39, RF-41, RF-42, RF-43): Dado el usuario A con saldo USD 10.000,00, un gasto de 3.000 y una categoría de ingresos "Sueldo", cuando intenta registrar o editar directamente desde la API un gasto con monto 0, con monto -50, con monto 1.000.000.000.000,00, con monto 10,555 o con la categoría "Sueldo", entonces el sistema rechaza todas las operaciones, no se registra ni se modifica ningún movimiento y el saldo sigue en USD 10.000,00.
- AC-50 (RF-43): Dado el usuario A en "Añadir Gasto", cuando intenta escribir "10,555" en el campo de monto, entonces el campo no acepta el tercer decimal y muestra "10,55".
- AC-51 (RF-44): Dado el usuario A en "Añadir Gasto", cuando intenta escribir "-50" o "abc50" en el campo de monto, entonces el campo no acepta el signo "-" ni las letras y en ambos casos muestra "50".
- AC-52 (RF-46): Dado el usuario A con saldo USD 10.000,00 que en "Añadir Gasto" escribió "1500,50" y el campo muestra "1.500,50", cuando guarda con la categoría y la fecha por defecto, entonces la lista muestra el movimiento con el monto "-1.500,50" y el saldo pasa a "USD 8.499,50".
- AC-53 (RF-29, RF-30, RF-34, RF-37, RF-38): Dado el usuario A con sesión iniciada, cuando en la sección Cuenta presiona "Añadir Gasto" o "Añadir Ingreso" y abre el selector de fecha, entonces en ambos formularios se muestra un calendario para seleccionar solo la fecha, con el día de hoy preseleccionado y los días posteriores a hoy deshabilitados y sin poder seleccionarse.
- AC-54 (RF-32, RF-39): Dado el usuario A con una categoría de gastos "Mercado" y una de ingresos "Sueldo", cuando presiona "Añadir Gasto" y abre el selector de categoría, entonces ve solo "Pago Realizado" y "Mercado", sin "Pago Ingresado", "Sueldo" ni una opción vacía o "sin categoría".
- AC-55 (RF-35, RF-36): Dado el usuario A con sesión iniciada, cuando presiona "Añadir Gasto" o "Añadir Ingreso", entonces el selector de categoría muestra preseleccionada "Pago Realizado" o "Pago Ingresado", respectivamente.
- AC-56 (RF-33): Dado el usuario A en "Añadir Gasto", cuando abre el calendario, entonces hay siempre una fecha seleccionada y el calendario no ofrece una opción para dejar la fecha vacía.
- AC-57 (RF-31, RF-34, RF-36): Dado el usuario A que en "Añadir Ingreso" ingresó el monto 500, eligió la categoría "Sueldo" y cambió la fecha a 01/10/2026, cuando vuelve atrás con la flecha o guarda el ingreso y presiona otra vez "Añadir Ingreso", entonces en ambos casos el formulario muestra el monto vacío, la categoría "Pago Ingresado" y la fecha de hoy.
- AC-58 (RF-40, RF-71): Dado el usuario A con las categorías de gastos "Transporte", "café" y "Mercado", cuando en "Añadir Gasto" abre el selector de categoría, entonces las opciones aparecen en este orden: "Pago Realizado", "café", "Mercado" y "Transporte".
- AC-59 (RF-47): Dado el usuario A con un saldo de USD 1.000,00, cuando registra un gasto de 2000, entonces el gasto se registra y el nuevo saldo es "USD -1.000,00".
- AC-60 (RF-57, RF-90): Dado el usuario A con un gasto de 1.500 en "Mercado" del 17/09/2026, cuando elige "Editar" en el menú de la fila de ese movimiento, entonces se abre el formulario de edición con el monto "1.500,00", la categoría "Mercado" y la fecha 17/09/2026.
- AC-61 (RF-60): Dado el usuario A con un gasto registrado, cuando elige "Editar" en el menú de la fila de ese movimiento, entonces el formulario de edición muestra un selector de tipo con las opciones "Gasto" e "Ingreso" y "Gasto" seleccionado.
- AC-62 (RF-58, RF-63, RF-69): Dado el usuario A con categorías de gastos "Transporte" y "Mercado" y un saldo actual de USD 10.000,00 que ya incluye un gasto de 3.000 en "Transporte" con fecha 17/09/2026, cuando edita ese movimiento cambiando el monto a 2000, la categoría a "Mercado" y la fecha a 16/09/2026, entonces la lista muestra el movimiento bajo la fecha 16/09/2026 con la categoría "Mercado" y el monto "-2.000,00", el saldo queda en USD 11.000,00 y se muestra el mensaje "Movimiento actualizado con éxito.".
- AC-63 (RF-59, RF-61, RF-63): Dado el usuario A con un saldo actual de USD 10.000,00 que ya incluye un gasto de 3.000 en "Mercado", cuando edita ese movimiento, cambia el tipo a ingreso sin elegir categoría y guarda, entonces el movimiento queda de tipo ingreso con la categoría "Pago Ingresado", la lista lo muestra con el monto "+3.000,00" y el saldo queda en USD 16.000,00 (se revierte el gasto de 3.000 y se suma el ingreso de 3.000).
- AC-64 (RF-39, RF-59, RF-60, RF-61): Dado el usuario A con una categoría de ingresos "Sueldo" y un gasto en "Mercado", cuando edita ese movimiento y selecciona "Ingreso" en el selector de tipo, entonces la categoría pasa a "Pago Ingresado" y el selector de categoría muestra solo "Pago Ingresado" y "Sueldo".
- AC-65 (RF-39, RF-59, RF-61, RF-63): Dado el usuario A con una categoría de ingresos "Sueldo" y un saldo actual de USD 10.000,00 que ya incluye un gasto de 3.000 en "Mercado", cuando edita ese movimiento, cambia el tipo a ingreso, elige la categoría "Sueldo" en lugar de "Pago Ingresado" y guarda, entonces el movimiento queda de tipo ingreso con la categoría "Sueldo", la lista lo muestra con el monto "+3.000,00" y el saldo queda en USD 16.000,00.
- AC-66 (RF-37, RF-38, RF-62): Dado el usuario A con un movimiento con fecha 17/09/2026, cuando elige "Editar" en el menú de la fila de ese movimiento y abre el selector de fecha, entonces se muestra el calendario con el 17/09/2026 preseleccionado y los días posteriores a hoy deshabilitados y sin poder seleccionarse.
- AC-67 (RF-64): Dado el usuario A con un saldo actual de USD 10.000,00 que ya incluye un gasto de 3.000, cuando abre ese movimiento para editarlo, cambia el monto a 2000 y presiona "Cancelar", o abre "Añadir Gasto", ingresa el monto 500 y presiona "Cancelar", entonces en ambos casos el formulario se cierra, no se registra ningún movimiento nuevo, el gasto sigue con el monto "-3.000,00" y el saldo sigue en USD 10.000,00.
- AC-68 (RF-66, RF-67, RF-68, RF-69): Dado el usuario A con un saldo actual de USD 5.000,00 que ya incluye un ingreso de 1.000, cuando selecciona "Eliminar" en el menú de ese movimiento y elige "Confirmar", entonces el movimiento desaparece de la lista, el saldo queda en USD 4.000,00 y se muestra el mensaje "Movimiento eliminado con éxito.".
- AC-69 (RF-56): Dado el usuario A con un movimiento en la lista, cuando presiona la fila de ese movimiento con un toque o con un clic, entonces se muestra un menú con las opciones "Editar" y "Eliminar".
- AC-70 (RF-65): Dado el usuario A con un movimiento en la lista, cuando elige "Editar" en el menú de la fila de ese movimiento, entonces el formulario de edición no muestra ninguna opción para eliminar el movimiento.
- AC-71 (RF-67): Dado el usuario A con un saldo actual de USD 5.000,00 que ya incluye un ingreso de 1.000, cuando selecciona "Eliminar" en el menú de ese movimiento, entonces se muestra el mensaje de confirmación "¿Está seguro que desea eliminar este movimiento?" con las opciones "Confirmar" y "Cancelar" y, si elige "Cancelar", el movimiento sigue en la lista y el saldo sigue en USD 5.000,00.
- AC-129 (RF-106): Dado el usuario A con saldo USD 10.000,00 que en "Añadir Gasto" ingresó el monto 1500, cuando presiona "Guardar" dos veces seguidas, entonces mientras se procesa el botón muestra "Guardando…" deshabilitado y el formulario no se puede editar ni cerrar, se registra un solo gasto y el saldo pasa a "USD 8.500,00".
- AC-130 (RF-106): Dado el usuario A con un saldo actual de USD 5.000,00 que ya incluye un ingreso de 1.000, cuando selecciona "Eliminar" en el menú de ese movimiento y presiona "Confirmar" dos veces seguidas, entonces mientras se procesa el botón muestra "Eliminando…" deshabilitado, se elimina solo ese movimiento y el saldo queda en USD 4.000,00.
- AC-131 (RF-107): Dado el usuario A con saldo USD 10.000,00 y un gasto de 3.000, cuando intenta registrar directamente desde la API un gasto con fecha dos días posterior a la fecha actual en UTC, o editar el gasto existente con esa fecha, entonces el sistema rechaza ambas operaciones, no se registra ni se modifica ningún movimiento y el saldo sigue en USD 10.000,00.
- AC-132 (RF-108): Dado el usuario A con saldo USD 10.000,00, cuando en "Añadir Gasto" elige en el calendario la fecha 15/03/1990, ingresa el monto 100 y guarda, entonces el gasto se registra bajo el grupo "15/03/1990" y el saldo pasa a "USD 9.900,00".

### Categorías

- AC-72 (RF-70, RF-71): Dado el usuario A con las categorías de ingresos "Ventas" y "Alquiler" y las de gastos "Transporte", "café", "Ómnibus" y "Mercado", cuando accede a la sección Categorías, entonces ve primero el grupo "Ingresos" con "Pago Ingresado", "Alquiler" y "Ventas", y después el grupo "Gastos" con "Pago Realizado", "café", "Mercado", "Ómnibus" y "Transporte".
- AC-73 (RF-72): Dado el usuario A con una categoría de gastos "Ocio" sin movimientos asociados, cuando accede a la sección Categorías, entonces "Ocio" muestra las opciones "Editar" y "Eliminar" habilitadas.
- AC-74 (RF-73, RF-86): Dado el usuario A en la sección Categorías, cuando presiona "Nueva Categoría", entonces se abre el formulario de crear una categoría con el nombre vacío y el campo de tipo con el texto "Seleccione".
- AC-75 (RF-75): Dado el usuario A en el formulario de "Nueva Categoría" o en el de edición de una categoría sin movimientos, cuando presiona el campo de tipo, entonces en ambos formularios se muestra un desplegable con las opciones "Ingreso" y "Gasto".
- AC-76 (RF-76): Dado el usuario A en el formulario de "Nueva Categoría", cuando escribe el nombre "Viajes", no elige un tipo y presiona "Guardar", entonces la categoría no se crea y se muestra el mensaje "Seleccione un tipo para la categoría.".
- AC-77 (RF-74, RF-89): Dado el usuario A con sesión iniciada, cuando en la sección Categorías presiona "Nueva Categoría", escribe "Ventas", elige el tipo "Ingreso" y presiona "Guardar", y después crea del mismo modo "Mercado" de tipo "Gasto", entonces se muestra el mensaje "Categoría creada con éxito.", "Ventas" queda disponible al registrar un ingreso y "Mercado" al registrar un gasto.
- AC-78 (RF-77): Dado el usuario A en la sección Categorías, cuando intenta crear una categoría con el nombre vacío o compuesto solo por espacios, entonces en ambos casos la categoría no se crea y se muestra el mensaje "Ingrese un nombre para la categoría.".
- AC-79 (RF-78): Dado el usuario A en la sección Categorías, cuando escribe un nombre de categoría de 30 caracteres, intenta escribir un carácter más y guarda, entonces el campo no acepta el carácter 31 y la categoría se crea con los 30 caracteres.
- AC-80 (RF-79): Dado el usuario A que en su cuenta tiene las categorías de gastos "Mercado" y "Café", cuando intenta crear una categoría de gastos llamada "mercado", " Mercado " (con espacios al inicio y al final), "Cafe" o "pago realizado", entonces en los cuatro casos el sistema no crea la categoría y muestra el mensaje "Ya existe una categoría con ese nombre.".
- AC-81 (RF-79, RF-82): Dado el usuario A con las categorías de gastos "Mercado" y "Ocio", esta última sin movimientos asociados, cuando intenta directamente desde la API crear otra categoría de gastos llamada "mercado" o cambiar el nombre de "Ocio" a "Mercado", entonces el sistema rechaza ambas operaciones, sigue habiendo una sola categoría "Mercado" y "Ocio" conserva su nombre.
- AC-82 (RF-08, RF-09, RF-76, RF-77, RF-78): Dado el usuario A con la cuenta llamada "Mi Cuenta", cuando intenta directamente desde la API guardar el nombre de la cuenta vacío o con 31 caracteres, o crear una categoría con el nombre vacío, con 31 caracteres o sin tipo, entonces el sistema rechaza todas las operaciones, la cuenta sigue llamándose "Mi Cuenta" y no se crea ninguna categoría.
- AC-83 (RF-80): Dado el usuario A en la sección Categorías, cuando crea una categoría de gastos con el nombre "  Viajes  " (con espacios al inicio y al final), entonces la categoría se guarda y se muestra como "Viajes".
- AC-84 (RF-74, RF-79): Dado el usuario A que en su cuenta tiene una categoría de gastos "Mercado", cuando crea una categoría de ingresos llamada "Mercado", entonces la categoría se crea.
- AC-85 (RF-81, RF-89): Dado el usuario A que en su cuenta tiene una categoría de gastos "Ocio" sin movimientos asociados, cuando en la sección Categorías edita el nombre de la categoría a "Entretenimiento", entonces el nombre de la categoría queda actualizado a "Entretenimiento" y se muestra el mensaje "Categoría actualizada con éxito.".
- AC-86 (RF-81): Dado el usuario A que en su cuenta tiene una categoría de gastos "Ocio" sin movimientos asociados, cuando la edita y cambia su tipo a ingreso, entonces "Ocio" aparece en el selector de categoría al añadir un ingreso y deja de aparecer al añadir un gasto.
- AC-87 (RF-81, RF-83): Dado el usuario A que en su cuenta tiene una categoría "Mercado" con movimientos asociados, cuando ve la categoría en la sección Categorías, entonces las opciones "Editar" y "Eliminar" aparecen deshabilitadas.
- AC-88 (RF-81, RF-83): Dado el usuario A que en su cuenta tiene una categoría de gastos "Mercado" con movimientos asociados, cuando intenta cambiarle el nombre o el tipo, o eliminarla, directamente desde la API, entonces el sistema rechaza las operaciones y la categoría sigue existiendo con su nombre y su tipo.
- AC-89 (RF-82): Dado el usuario A que en su cuenta tiene las categorías de gastos "Mercado" y "Ocio" (esta última sin movimientos asociados), cuando en la sección Categorías intenta cambiar el nombre de "Ocio" a "Mercado", entonces el sistema no guarda el cambio, muestra el mensaje "Ya existe una categoría con ese nombre." y "Ocio" conserva su nombre.
- AC-90 (RF-82): Dado el usuario A que tiene una categoría de ingresos "Ventas" y una categoría de gastos "Ventas" sin movimientos asociados, cuando intenta cambiar el tipo de la categoría de gastos "Ventas" a ingreso, entonces el sistema no guarda el cambio, muestra el mensaje "Ya existe una categoría con ese nombre." y la categoría sigue siendo de tipo gasto.
- AC-91 (RF-83, RF-84, RF-89): Dado el usuario A que en su cuenta tiene una categoría "Ocio" sin movimientos asociados, cuando en la sección Categorías elimina la categoría y elige "Confirmar", entonces la categoría desaparece de la lista de categorías disponibles y se muestra el mensaje "Categoría eliminada con éxito.".
- AC-92 (RF-84): Dado el usuario A con una categoría "Ocio" sin movimientos asociados, cuando presiona "Eliminar" en esa categoría, entonces se muestra el mensaje de confirmación "¿Está seguro que desea eliminar esta categoría?" con las opciones "Confirmar" y "Cancelar" y, si elige "Cancelar", "Ocio" sigue en la lista de categorías.
- AC-93 (RF-85): Dado el usuario A con una categoría de gastos "Ocio" sin movimientos asociados, cuando en "Nueva Categoría" escribe "Viajes" y presiona "Cancelar", o abre "Ocio" para editarla, cambia el nombre a "Entretenimiento" y presiona "Cancelar", entonces en ambos casos el formulario se cierra, "Viajes" no se crea y "Ocio" sigue llamándose "Ocio".
- AC-94 (RF-86): Dado el usuario A que presionó "Nueva Categoría", escribió "Viajes" y eligió el tipo "Gasto", cuando vuelve atrás con la flecha o guarda la categoría y presiona otra vez "Nueva Categoría", entonces en ambos casos el campo de nombre está vacío y el campo de tipo muestra "Seleccione".
- AC-95 (RF-87, RF-88): Dado el usuario A con sesión iniciada, cuando ve las categorías "Pago Realizado" y "Pago Ingresado" en la sección Categorías, entonces las opciones "Editar" y "Eliminar" aparecen deshabilitadas en ambas.
- AC-96 (RF-87, RF-88): Dado el usuario A con sesión iniciada, cuando intenta cambiar el nombre o el tipo de "Pago Realizado" y de "Pago Ingresado", o eliminarlas, directamente desde la API, entonces el sistema rechaza todas las operaciones y ambas siguen existiendo con su nombre y su tipo.

### Formularios

- AC-97 (RF-90): Dado el usuario A que descartó con "Cancelar" o con la flecha para volver atrás estos cambios: el monto de un gasto de 3.000 en "Mercado" a 2000, el nombre de la categoría "Ocio" a "Entretenimiento" y el nombre de la cuenta "Mi Cuenta" a "Ahorros", cuando vuelve a abrir cada formulario de edición, entonces muestran "3.000,00" con "Mercado", "Ocio" y "Mi Cuenta", respectivamente.
- AC-98 (RF-91): Dado el usuario A con un movimiento y una categoría propia sin movimientos, cuando abre "Añadir Gasto", "Añadir Ingreso", el formulario de edición del movimiento, "Nueva Categoría", el formulario de edición de la categoría y "Editar Cuenta", entonces cada formulario muestra el botón "Guardar".

### Reportes

En estos criterios, "hoy" es el sábado 03/10/2026.

- AC-99 (RF-26): Dado el usuario A con sesión iniciada en la sección Cuenta, cuando presiona "Reportes" en la barra de navegación, entonces se muestra la sección Reportes.
- AC-100 (RF-94, RF-99): Dada una cuenta con gastos en octubre de 2026 de 6000 en "Mercado" y 4000 en "Transporte", y un gasto de 1000 en "Ocio" el 30/09/2026, cuando el usuario entra a Reportes sin cambiar ninguna opción, entonces se muestran "Gastos", el filtro "Mes" con "Octubre 2026" y un gráfico de torta con 60% "Mercado" y 40% "Transporte".
- AC-101 (RF-92, RF-93, RF-95, RF-96, RF-99): Dada una cuenta con ingresos de 5000 en "Ventas", 3000 en "Rendimientos" y 2000 en "Comisiones" registrados entre el lunes 28/09/2026 y hoy, cuando el usuario entra a Reportes, selecciona "Ingresos", filtra por "Semana" y elige el gráfico "Torta", entonces se muestra la semana 28/09/2026 – 04/10/2026 y el gráfico muestra 50% "Ventas", 30% "Rendimientos" y 20% "Comisiones".
- AC-102 (RF-92, RF-93, RF-95, RF-100, RF-101): Dada una cuenta con gastos en octubre de 2026 de 6000 en "Mercado" y 4000 en "Transporte", cuando el usuario entra a Reportes, selecciona "Gastos", filtra por "Mes" y elige el gráfico "Barras", entonces se muestra "Octubre 2026" y el gráfico muestra primero una barra de 6.000,00 para "Mercado" y después una de 4.000,00 para "Transporte".
- AC-103 (RF-92, RF-95, RF-102): Dado el usuario A con categorías de gastos "Salud", "Mercado" y "Transporte" que hoy solo tuvo gastos en "Mercado", cuando entra a Reportes, selecciona "Gastos" y filtra por "Día", entonces el gráfico muestra únicamente "Mercado" con el 100% del gasto y no muestra "Salud" ni "Transporte".
- AC-104 (RF-99): Dada una cuenta con gastos de hoy de 1000 en "Mercado", 1000 en "Transporte" y 1000 en "Salud", cuando el usuario entra a Reportes, selecciona "Gastos", filtra por "Día" y elige el gráfico "Torta", entonces el gráfico muestra 34% para "Mercado", 33% para "Salud" y 33% para "Transporte".
- AC-105 (RF-95): Dada una cuenta con un gasto de 2000 en "Mercado" el 15/01/2026 y uno de 1000 en "Ocio" el 20/12/2025, cuando el usuario entra a Reportes, selecciona "Gastos" y filtra por "Año", entonces se muestra "2026" y el gráfico muestra únicamente "Mercado" con el 100% del gasto.
- AC-106 (RF-97): Dada una cuenta con un único gasto de 1000 en "Mercado" el 22/09/2026, cuando el usuario en Reportes selecciona "Gastos", filtra por "Semana" y presiona una vez el botón de período anterior, entonces se muestra la semana 21/09/2026 – 27/09/2026 y el gráfico muestra "Mercado" con el 100% del gasto, y al presionar el botón de período siguiente vuelve a mostrarse la semana 28/09/2026 – 04/10/2026.
- AC-107 (RF-96, RF-97): Dado el usuario A en Reportes, cuando filtra por "Mes", entonces se muestra "Octubre 2026" y el botón de período siguiente aparece deshabilitado.
- AC-108 (RF-95, RF-103): Dada una cuenta en USD cuyo único ingreso es uno de 3000 registrado el 01/10/2026, cuando el usuario en Reportes selecciona "Ingresos" y filtra por "Día", entonces no se muestra el gráfico, se muestra el título "Ingresos por Categoría (USD) — 03/10/2026" y debajo el mensaje "Sin movimientos en este período.".
- AC-109 (RF-101): Dada una cuenta con gastos de este mes de 2000 en "Transporte", 2000 en "Mercado" y 5000 en "Salud", cuando el usuario en Reportes selecciona "Gastos", filtra por "Mes" y elige el gráfico "Barras", entonces las barras aparecen en este orden: "Salud" 5.000,00, "Mercado" 2.000,00 y "Transporte" 2.000,00.
- AC-110 (RF-98): Dado el usuario A en Reportes con "Gastos" seleccionado, cuando selecciona "Ingresos", entonces el gráfico muestra los ingresos sin que el usuario presione ningún otro botón, y la sección no tiene un botón de aplicar.

### Mensajes

- AC-111 (RF-104): Dado el usuario A con sesión iniciada, cuando registra un gasto, entonces el mensaje "Gasto registrado con éxito." se muestra sin el botón "Aceptar" y se cierra solo a los 3 segundos.
- AC-112 (RF-105): Dado el usuario A con sesión iniciada, cuando intenta guardar un gasto con el monto 0, entonces el mensaje "El monto debe ser mayor a 0." se muestra con el botón "Aceptar".
- AC-113 (RF-105): Dado el usuario A con el mensaje "El monto debe ser mayor a 0." en pantalla, cuando pasan 10 segundos sin que presione "Aceptar" y después lo presiona, entonces el mensaje sigue visible a los 10 segundos y se cierra al presionar "Aceptar".
- AC-128 (RF-104, O-1): Dado el usuario A con el mensaje "Gasto registrado con éxito." todavía en pantalla, cuando presiona "Añadir Gasto", ingresa el monto 500 y presiona "Guardar", entonces el segundo gasto se registra sin que haya tenido que cerrar el primer mensaje, en 3 interacciones.

### No Funcionales

- AC-114 (RNF-01): Dado el usuario A con una cuenta de 5.000 movimientos y las condiciones de medición de los RNF, cuando se cambian las opciones de la sección Reportes 100 veces, entonces el p95 del tiempo hasta que el gráfico se muestra actualizado es menor a 1 segundo.
- AC-115 (RNF-02): Dado el usuario A con una cuenta de 5.000 movimientos y las condiciones de medición de los RNF, cuando se ejecutan 100 altas, 100 ediciones y 100 eliminaciones de movimientos, entonces el p95 de cada tipo de operación, desde que se confirma la acción hasta que la lista y el saldo se muestran actualizados, es menor a 2 segundos.
- AC-116 (RNF-03): Dado el usuario A autenticado y el usuario B con cuenta, categorías y movimientos, cuando A consulta directamente la API de Supabase las cuentas, categorías y movimientos filtrando por los identificadores de B, entonces cada consulta devuelve 0 registros.
- AC-117 (RNF-03): Dado el usuario A autenticado y el usuario B con cuenta, categorías y movimientos, cuando A intenta editar y eliminar mediante la API la cuenta, una categoría y un movimiento de B usando sus identificadores, entonces el sistema rechaza todas las operaciones y los datos de B quedan sin cambios.
- AC-118 (RNF-03): Dado el usuario A autenticado y el usuario B con cuenta y categorías, cuando A intenta crear mediante la API un movimiento en la cuenta de B y otro en su propia cuenta usando una categoría de B, entonces el sistema rechaza ambas operaciones y los saldos de A y de B quedan sin cambios.
- AC-119 (RNF-03): Dado el usuario A autenticado, cuando intenta crear, editar o eliminar una moneda de la lista de monedas mediante la API, entonces el sistema rechaza las tres operaciones y la lista de monedas queda sin cambios.
- AC-120 (RNF-03): Dado el usuario A autenticado y el usuario B con movimientos y categorías propias, cuando A intenta restablecer la cuenta de B mediante la API, entonces el sistema rechaza la operación y los movimientos, las categorías, el saldo, el nombre y la moneda de B quedan sin cambios.
- AC-121 (RNF-04): Dado el usuario A con saldo USD 0,00, cuando registra un ingreso de 0,10 y otro de 0,20, entonces el saldo es exactamente "USD 0,30" y en la base de datos los montos y el saldo se almacenan en columnas de tipo numeric.
- AC-122 (RNF-04): Dado el usuario A con saldo USD 0,00, cuando registra dos ingresos de 999.999.999.999,99, entonces ambos se registran y el saldo es exactamente "USD 1.999.999.999.999,98".
- AC-123 (RNF-05): Dado el usuario A con un saldo actual de USD 10.000,00 que ya incluye un gasto de 3.000, cuando se simula una falla después de escribir el movimiento y antes de actualizar el saldo al dar de alta un gasto de 1000, al editar ese gasto a 2000, al cambiarlo a ingreso o al eliminarlo, entonces en los cuatro casos no aparece ningún movimiento nuevo, la lista sigue mostrando ese gasto con el monto "-3.000,00", el saldo sigue en USD 10.000,00 y se muestra un mensaje de error.
- AC-124 (RNF-05): Dado el usuario A con movimientos, categorías propias, nombre "Cuenta Personal" y moneda ARS, cuando confirma "Restablecer Cuenta" y se simula una falla después de eliminar los movimientos y antes de eliminar las categorías, entonces los movimientos, las categorías, el saldo, el nombre y la moneda quedan como estaban antes de la operación.
- AC-125 (RNF-05): Dado el usuario A con saldo USD 0,00, cuando se ejecuta una secuencia fija, definida en la prueba, de 20 altas, 20 ediciones (10 de ellas con cambio de tipo) y 10 eliminaciones intercaladas, entonces después de cada operación el saldo es igual a la suma de los ingresos menos la suma de los gastos de la cuenta.
- AC-126 (RNF-06): Dado el usuario A con sesión iniciada, cuando usa la aplicación con anchos de viewport de 320px, 768px, 1280px y 1920px, entonces en cada ancho puede completar todas las acciones de las secciones Cuenta, Categorías, Reportes y Perfil sin desplazamiento horizontal.
- AC-127 (RNF-07): Dado el usuario A con sesión iniciada, cuando se simula una falla del servidor en cada una de las operaciones listadas en RNF-07, entonces cada una muestra un mensaje en español, tratando de usted, que no contiene códigos de error internos ni stack traces.
- AC-133 (RNF-08): Dado el usuario A con sesión iniciada, cuando usa solo el teclado para navegar entre las secciones y para añadir, editar y eliminar un movimiento, incluidos el calendario, los selectores, los menús, las confirmaciones y los mensajes, entonces completa todas las acciones, el elemento con foco se distingue visualmente en cada paso y un lector de pantalla anuncia el texto alternativo de los íconos de éxito, de error y de la flecha para volver atrás.

## Fuera de Alcance

- Envío de emails y notificaciones
- Creación de múltiples cuentas
- Eliminar cuenta
- Transferencias entre cuentas
- Utilizar varios tipos de moneda en simultáneo
- Importar el resumen del banco
- Presupuestos
- Cotización de divisas
- Metas de ahorro
- Gastos recurrentes
- Subcategorías
- Alertas de sobregiro o de límites de gasto
- Autenticación con contraseña propia y almacenamiento de credenciales
- Contactar a soporte
- Múltiples idiomas y selección de idioma (la aplicación es solo en español)
- Notas o descripción en los movimientos
- Búsqueda de movimientos
- Exportar reportes
- Adjuntar comprobantes a los movimientos
- Uso sin conexión (la aplicación requiere conexión a internet para autenticarse con Google y acceder a la base de datos)
- Colores o íconos en las categorías
- Movimientos con fecha futura o programados
- Elegir el día de inicio de la semana (la semana siempre va de lunes a domingo)
- Ver el detalle o la lista de movimientos al hacer clic en el gráfico
- Tema oscuro, cambio de tema o personalización de colores (la aplicación tiene un único estilo)
- Filtrar la lista de movimientos por fecha o por categoría
- Seleccionar o eliminar varios movimientos a la vez
- Filtrar los reportes por un rango de fechas personalizado
- Buscar monedas en la lista de monedas
- Alta, edición y eliminación de monedas por parte de los usuarios (la lista se carga desde ISO)

## Riesgos y Dependencias

- Riesgo: inconsistencias en el saldo o estados parciales al crear, editar o eliminar movimientos o al restablecer la cuenta → mitigación: ejecutar cada operación de forma atómica en la base de datos y probarla con fallas simuladas (RF-16, RF-18, RF-45, RF-46, RF-58, RF-59, RF-63, RF-66, RF-68, RNF-05).
- Riesgo: acceso de un usuario a información financiera de otro usuario → mitigación: autenticación y políticas de acceso en Supabase que restrinjan los datos al usuario propietario, verificadas con pruebas directas contra la API (RF-22, RF-23, RNF-03).
- Riesgo: errores en cálculos con valores decimales → mitigación: utilizar tipos de datos apropiados para importes monetarios y realizar pruebas con diferentes valores (RF-43, RNF-04).
- Riesgo: pérdida accidental de datos por restablecimiento de cuenta → mitigación: modal de confirmación explícito con botones "Confirmar"/"Cancelar" antes de ejecutar la acción (RF-15).
- Riesgo: corrimiento de la fecha de un movimiento por conversión de zona horaria → mitigación: guardar la fecha como día calendario (tipo date), calcular "hoy" y deshabilitar los días futuros con la fecha local del dispositivo, sin convertirla a UTC; el servidor, que no conoce la zona del usuario, solo rechaza fechas posteriores a mañana en UTC (RF-34, RF-37, RF-38, RF-95, RF-107).
- Riesgo: límites del plan gratuito de Supabase (pausa del proyecto por inactividad y límite de inicios de sesión por hora) → mitigación: monitorear el uso y evaluar un plan pago antes de abrir la aplicación a usuarios reales.
- Riesgo: indisponibilidad del inicio de sesión con Google → mitigación: mostrar un mensaje de error en la pantalla de inicio de sesión y permitir reintentar (RF-24, RNF-07).
- Dependencia: React · Supabase · PostgreSQL · Google Authentication · lista oficial ISO 4217 de iso.org (se carga una vez en la base de datos y se actualiza a mano si ISO publica cambios).

## Historial de Cambios

- 2026-10-10 — Clarificación de la sección Cuenta y sus movimientos:
  - Doble envío: se agrega RF-106 (AC-129, AC-130).
  - Fecha máxima en el servidor: se agrega RF-107 (AC-131) y se ajusta el riesgo de zona horaria.
  - Uso con teclado y lector de pantalla: se agrega RNF-08 (AC-133).
  - Fecha mínima: se agrega RF-108, sin fecha mínima (AC-132).
  - Error al iniciar la sesión temporal: es un requisito provisorio mientras se usa el inicio de sesión anónimo y no se agrega como RF; se resuelve como un error de RF-105, con "Aceptar" para reintentar, y se reemplaza por RF-24 cuando se incorpore Google.
- 2026-10-24 — Revisión del PRD: los mensajes de éxito ya no usan un botón "Aceptar" y se cierran solos a los 3 segundos, para que el gasto se registre en las 3 interacciones de O-1. RF-104 se divide en RF-104 (éxito) y RF-105 (error, que sigue con "Aceptar"); se ajustan AC-111 a AC-113 y se agrega AC-128.
