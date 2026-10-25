# MiBalance — Interfaz

Complementa a `PRD.md` con los formatos, colores e íconos de la interfaz. La aplicación tiene un único estilo (sin tema oscuro). En los criterios de reportes, "hoy" es el sábado 03/10/2026.

## Reglas

- UI-01: El sistema debe mostrar en la sección Cuenta el nombre de la cuenta seguido del código ISO 4217 de su moneda entre paréntesis (ej. "Mi Cuenta (USD)").
- UI-02: El sistema debe mostrar en la sección Cuenta el saldo de la cuenta precedido por el código ISO 4217 de su moneda (ej. "USD 10.000,00").
- UI-03: El sistema debe mostrar el saldo en color verde cuando sea mayor a 0, en color rojo cuando sea menor a 0 y en el color normal del texto cuando sea 0.
- UI-04: El sistema debe agregar automáticamente el punto como separador de miles en el campo de monto de un movimiento mientras el usuario escribe (ej. al escribir "1500000" el campo muestra "1.500.000").
- UI-05: El sistema debe agrupar los movimientos de la lista por fecha, mostrando la fecha en formato DD/MM/AAAA como encabezado de cada grupo.
- UI-06: El sistema debe mostrar cada movimiento de la lista con su categoría a la izquierda y su monto a la derecha, sin mostrar el tipo de movimiento (ej. "Café -800,00").
- UI-07: El sistema debe mostrar el monto de cada movimiento de la lista sin código de moneda (ej. "-1.500,00").
- UI-08: El sistema debe mostrar en la lista el monto de cada gasto precedido por el signo "-" y el de cada ingreso precedido por el signo "+" (ej. "-1.500,00", "+1.000,00").
- UI-09: El sistema debe mostrar en la lista el monto de los gastos en color rojo y el de los ingresos en color verde.
- UI-10: El sistema debe mostrar todos los montos y saldos con dos decimales en formato argentino: punto como separador de miles y coma como separador decimal (ej. "1.000,50").
- UI-11: El sistema debe mostrar el monto en el formulario de edición de un movimiento sin signo (ej. "1.500,00").
- UI-12: El sistema debe mostrar sobre el gráfico un título con el tipo de movimiento, el código ISO 4217 de la moneda de la cuenta y el período filtrado, con el formato "<Gastos o Ingresos> por Categoría (<código>) — <período>" (ej. "Gastos por Categoría (USD) — Octubre 2026").
- UI-13: El sistema debe mostrar el período del título del reporte con este formato: día "DD/MM/AAAA"; semana "DD/MM/AAAA – DD/MM/AAAA"; mes "<Mes> AAAA" (ej. "Octubre 2026"); y año "AAAA".
- UI-14: El sistema debe mostrar cada mensaje de éxito acompañado de un ícono de tic en color verde.
- UI-15: El sistema debe mostrar cada mensaje de error, incluidos los de validación, acompañado de un ícono de cruz en color rojo.
- UI-16: El 100% de los textos de la interfaz (incluidos los montos y el saldo en rojo y verde, los mensajes, los botones y los textos de los gráficos) debe tener una relación de contraste con su fondo de al menos 4,5:1, o 3:1 para texto grande (24 px o más, o 18,66 px o más en negrita), según WCAG 2.1 nivel AA, y los íconos de éxito y de error deben tener un contraste de al menos 3:1. Verificado con axe DevTools en todas las pantallas y ventanas.

## Criterios de Aceptación

- AC-UI-01 (UI-02, UI-10): Dado el usuario A con una cuenta en USD y un saldo de 10000, cuando accede a la sección Cuenta, entonces ve el saldo "USD 10.000,00".
- AC-UI-02 (UI-03): Dado el usuario A con saldo de USD 8.500,00, de USD -1.000,00 o de USD 0,00, cuando accede a la sección Cuenta, entonces el saldo se muestra en verde, en rojo o en el color normal del texto, respectivamente.
- AC-UI-03 (UI-04): Dado el usuario A en "Añadir Gasto", cuando escribe "1500000" o "1500,50" en el campo de monto, entonces el campo muestra "1.500.000" o "1.500,50", respectivamente.
- AC-UI-04 (UI-07, UI-08, UI-10): Dado el usuario A con un gasto de 1.500 en "Mercado" y dos ingresos de 520,50 y 1000 en "Sueldo", cuando accede a la sección Cuenta, entonces la lista muestra "-1.500,00", "+520,50" y "+1.000,00", sin código de moneda.
- AC-UI-05 (UI-09): Dado el usuario A con un gasto de 1.500 en "Mercado" y un ingreso de 1.000 en "Sueldo", cuando accede a la sección Cuenta, entonces "-1.500,00" se muestra en rojo y "+1.000,00" se muestra en verde.
- AC-UI-06 (UI-11): Dado el usuario A con un gasto de 1.500 que la lista muestra como "-1.500,00", cuando elige "Editar" en el menú de la fila de ese movimiento, entonces el campo de monto del formulario muestra "1.500,00" sin signo.
- AC-UI-07 (UI-12, UI-13): Dado el usuario A con una cuenta en USD, cuando entra a Reportes sin cambiar ninguna opción, entonces el título del reporte es "Gastos por Categoría (USD) — Octubre 2026".
- AC-UI-08 (UI-12, UI-13): Dado el usuario A con una cuenta en ARS, cuando en Reportes selecciona "Ingresos" y filtra por "Semana", entonces el título del reporte es "Ingresos por Categoría (ARS) — 28/09/2026 – 04/10/2026".
- AC-UI-09 (UI-13): Dado el usuario A con una cuenta en USD en Reportes con "Gastos" seleccionado, cuando filtra por "Día" y después por "Año", entonces el título del reporte es primero "Gastos por Categoría (USD) — 03/10/2026" y después "Gastos por Categoría (USD) — 2026".
- AC-UI-10 (UI-13): Dado el usuario A con una cuenta en USD en Reportes con "Gastos" y el filtro "Semana" seleccionados, cuando presiona una vez el botón de período anterior, entonces el título del reporte es "Gastos por Categoría (USD) — 21/09/2026 – 27/09/2026".
- AC-UI-11 (UI-12): Dada una cuenta en USD con gastos en octubre de 2026 de 6000 en "Mercado" y 4000 en "Transporte", cuando el usuario en Reportes selecciona "Gastos", filtra por "Mes" y elige el gráfico "Barras", entonces las barras muestran "6.000,00" y "4.000,00" sin código de moneda, y "USD" aparece únicamente en el título "Gastos por Categoría (USD) — Octubre 2026".
- AC-UI-12 (UI-16): Dado el usuario A con sesión iniciada, cuando se analizan con axe DevTools todas las pantallas y ventanas (inicio de sesión, Cuenta, Editar Cuenta, formularios de movimientos y de categorías, Categorías, Reportes con ambos gráficos, Perfil, barra de navegación, menús, desplegables, confirmaciones y mensajes), entonces el 100% de los textos tiene un contraste de al menos 4,5:1, o 3:1 para texto grande, y los íconos de éxito y de error tienen un contraste de al menos 3:1.
- AC-UI-13 (UI-01): Dado el usuario A con la cuenta "Mi Cuenta" en USD, cuando accede a la sección Cuenta, entonces el encabezado muestra "Mi Cuenta (USD)".
- AC-UI-14 (UI-05, UI-06): Dado el usuario A con un gasto de 1.500 en "Mercado" del 17/09/2026, cuando accede a la sección Cuenta, entonces la lista muestra el encabezado "17/09/2026" y debajo una fila con "Mercado" a la izquierda y "-1.500,00" a la derecha, sin el tipo de movimiento.
- AC-UI-15 (UI-14, UI-15): Dado el usuario A con sesión iniciada, cuando registra un gasto y después intenta guardar otro con el monto 0, entonces el mensaje "Gasto registrado con éxito." se muestra con un ícono de tic en verde y el mensaje "El monto debe ser mayor a 0." con un ícono de cruz en rojo.
