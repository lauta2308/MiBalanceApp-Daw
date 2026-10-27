// Diseño responsive (NFR-05, AC-59): en 320, 768, 1280 y 1920 px se ve el saldo y la lista, se
// pagina y se registra un gasto y un ingreso sin desplazamiento horizontal. Edición (FEAT-001b
// NFR-05, AC-28): en esos anchos se abre el menú de una fila, se edita el movimiento y se guarda.
// Eliminación (FEAT-001c NFR-05, AC-14): en esos anchos se abre el menú, se ve la confirmación
// completa y se confirma.

import {
  CargarMovimientos,
  CrearMovimientosAnteriores,
  ObtenerFechaLocal,
  ObtenerFilaPorId,
  ObtenerFilas,
  expect,
  test,
} from './utilidades/fixtures.js';

test.use({ nombreUsuario: 'anchos' });

const anchos = [320, 768, 1280, 1920];
const altoVentana = 800;
// Si se define CAPTURAS_CALENDARIO (un directorio), se guarda una captura del calendario abierto
// con septiembre en cada ancho, para revisar la cabecera a ojo.
const directorioCapturas = process.env.CAPTURAS_CALENDARIO;

// Sin desplazamiento horizontal: ni en el documento ni dentro del calendario (que tiene
// overflow-x: auto y, si no entrara, se desplazaría solo él).
async function MedirDesbordes(pagina) {
  return pagina.evaluate(() => {
    const calendario = document.querySelector('.calendario');
    return {
      anchoVentana: window.innerWidth,
      anchoDocumento: document.documentElement.scrollWidth,
      calendario: calendario
        ? {
            anchoVisible: calendario.clientWidth,
            anchoContenido: calendario.scrollWidth,
            // Margen entre la grilla de días y el borde interno del calendario, y espacio entre
            // las listas de mes y año y los botones de navegación (ambos en px).
            margenGrilla:
              calendario.getBoundingClientRect().right -
              Number.parseFloat(getComputedStyle(calendario).paddingRight) -
              Number.parseFloat(getComputedStyle(calendario).borderRightWidth) -
              calendario.querySelector('.rdp-month_grid').getBoundingClientRect().right,
            espacioEncabezado:
              calendario.querySelector('.rdp-nav').getBoundingClientRect().left -
              calendario.querySelector('.rdp-dropdowns').getBoundingClientRect().right,
          }
        : null,
    };
  });
}

// Cajas (bounding boxes) de las listas de mes y año y de los botones "mes anterior" y "mes
// siguiente" de la cabecera del calendario.
async function MedirCabeceraCalendario(pagina) {
  return pagina.evaluate(() => {
    const calendario = document.querySelector('.calendario');
    const listas = calendario.querySelectorAll('.rdp-dropdown_root');
    const elementos = {
      mes: listas[0],
      anio: listas[1],
      anterior: calendario.querySelector('.rdp-button_previous'),
      siguiente: calendario.querySelector('.rdp-button_next'),
    };
    return Object.fromEntries(
      Object.entries(elementos).map(([nombre, elemento]) => {
        const { left, right, top, bottom } = elemento.getBoundingClientRect();
        return [nombre, { left, right, top, bottom }];
      }),
    );
  });
}

function SeIntersectan(cajaA, cajaB) {
  return (
    cajaA.left < cajaB.right &&
    cajaB.left < cajaA.right &&
    cajaA.top < cajaB.bottom &&
    cajaB.top < cajaA.bottom
  );
}

// Mes, año y flechas de la cabecera no se superponen entre sí.
async function VerificarCabeceraSinSuperposiciones(pagina, paso) {
  const cajas = await MedirCabeceraCalendario(pagina);
  const nombres = Object.keys(cajas);
  const superpuestos = [];
  for (let i = 0; i < nombres.length; i += 1) {
    for (let j = i + 1; j < nombres.length; j += 1) {
      if (SeIntersectan(cajas[nombres[i]], cajas[nombres[j]])) {
        superpuestos.push(`${nombres[i]}/${nombres[j]}`);
      }
    }
  }
  const detalle = Object.entries(cajas)
    .map(([nombre, caja]) => `${nombre} ${caja.left.toFixed(0)}–${caja.right.toFixed(0)}×${caja.top.toFixed(0)}–${caja.bottom.toFixed(0)}`)
    .join(', ');
  expect(superpuestos, `${paso}: cabecera del calendario (${detalle})`).toEqual([]);
  return detalle;
}

async function VerificarSinDesbordes(pagina, paso) {
  const medicion = await MedirDesbordes(pagina);
  expect(medicion.anchoDocumento, `${paso}: ancho del documento`).toBeLessThanOrEqual(
    medicion.anchoVentana,
  );
  if (medicion.calendario) {
    expect(medicion.calendario.anchoContenido, `${paso}: ancho del calendario`).toBeLessThanOrEqual(
      medicion.calendario.anchoVisible,
    );
  }
  return medicion;
}

// El menú de la fila queda entero dentro de la ventana (se abre debajo y alineado a la derecha).
async function VerificarMenuDentroDeVentana(pagina, menu, paso) {
  const caja = await menu.boundingBox();
  const anchoVentana = await pagina.evaluate(() => window.innerWidth);
  const detalle = `${paso}: menú ${caja.x.toFixed(0)}–${(caja.x + caja.width).toFixed(0)} px de ${anchoVentana} px`;
  expect(caja.x, detalle).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width, detalle).toBeLessThanOrEqual(anchoVentana);
  return detalle;
}

// La confirmación y sus dos botones quedan enteros dentro de la ventana y los botones, dentro del
// diálogo.
async function VerificarConfirmacionCompleta(pagina, dialogo, paso) {
  const anchoVentana = await pagina.evaluate(() => window.innerWidth);
  const altoVentanaActual = await pagina.evaluate(() => window.innerHeight);
  const cajaDialogo = await dialogo.boundingBox();
  const detalle = `${paso}: confirmación ${cajaDialogo.x.toFixed(0)}–${(cajaDialogo.x + cajaDialogo.width).toFixed(0)} px de ${anchoVentana} px`;
  expect(cajaDialogo.x, detalle).toBeGreaterThanOrEqual(0);
  expect(cajaDialogo.x + cajaDialogo.width, detalle).toBeLessThanOrEqual(anchoVentana);
  expect(cajaDialogo.y, detalle).toBeGreaterThanOrEqual(0);
  expect(cajaDialogo.y + cajaDialogo.height, detalle).toBeLessThanOrEqual(altoVentanaActual);
  for (const nombre of ['Cancelar', 'Confirmar']) {
    const boton = dialogo.getByRole('button', { name: nombre });
    await expect(boton).toBeVisible();
    const caja = await boton.boundingBox();
    const detalleBoton = `${detalle}; "${nombre}" ${caja.x.toFixed(0)}–${(caja.x + caja.width).toFixed(0)} px`;
    expect(caja.x, detalleBoton).toBeGreaterThanOrEqual(cajaDialogo.x);
    expect(caja.x + caja.width, detalleBoton).toBeLessThanOrEqual(cajaDialogo.x + cajaDialogo.width);
    expect(caja.y + caja.height, detalleBoton).toBeLessThanOrEqual(cajaDialogo.y + cajaDialogo.height);
  }
  await expect(dialogo).toHaveAccessibleName('¿Está seguro que desea eliminar este movimiento?');
  return detalle;
}

async function RegistrarMovimiento(pagina, { nombreBoton, monto, mensaje, ancho }) {
  await pagina.getByRole('button', { name: nombreBoton }).click();
  await expect(pagina.getByRole('heading', { level: 1, name: nombreBoton })).toBeVisible();
  await expect(pagina.getByLabel('Categoría')).toBeEnabled();
  await VerificarSinDesbordes(pagina, `${ancho} px, ${nombreBoton}`);

  // Calendario abierto con septiembre, el mes de nombre más largo.
  await pagina.getByLabel('Fecha').click();
  const calendario = pagina.getByRole('dialog', { name: 'Calendario' });
  await expect(calendario).toBeVisible();
  await calendario.locator('select.rdp-months_dropdown').selectOption({ label: 'septiembre' });
  await expect(calendario.locator('.rdp-caption_label').first()).toHaveText(/septiembre/i);
  if (directorioCapturas) {
    await calendario.screenshot({
      path: `${directorioCapturas}/calendario-septiembre-${ancho}px-${nombreBoton.replace(/\s+/g, '-')}.png`,
    });
  }
  const medicion = await VerificarSinDesbordes(pagina, `${ancho} px, ${nombreBoton}, septiembre`);
  medicion.cabecera = await VerificarCabeceraSinSuperposiciones(
    pagina,
    `${ancho} px, ${nombreBoton}, septiembre`,
  );
  await pagina.keyboard.press('Escape');
  await expect(calendario).toBeHidden();

  await pagina.getByLabel('Monto').fill(monto);
  await pagina.getByRole('button', { name: 'Guardar' }).click();
  await expect(pagina.getByText(mensaje)).toBeVisible();
  await expect(pagina.getByRole('heading', { name: 'Mi Cuenta (USD)' })).toBeVisible();
  return medicion;
}

for (const ancho of anchos) {
  test(`en ${ancho} px se ve el saldo y la lista, se pagina y se registra un gasto y un ingreso sin desplazamiento horizontal (AC-59)`, async ({
    paginaConUsuario: pagina,
    usuario,
  }) => {
    // 60 movimientos de 10,00 intercalados: saldo 0,00 y dos páginas.
    await CargarMovimientos(usuario.idCuenta, [
      { tipo: 'INGRESO', monto: '1000.00', fecha: '2026-01-01' },
      ...CrearMovimientosAnteriores(60),
    ]);
    await pagina.setViewportSize({ width: ancho, height: altoVentana });
    await pagina.goto('/');

    await expect(pagina.getByText('USD 1.000,00', { exact: true })).toBeVisible();
    await expect(ObtenerFilas(pagina)).toHaveCount(50);
    await expect(pagina.getByText('Página 1 de 2')).toBeVisible();
    await VerificarSinDesbordes(pagina, `${ancho} px, Cuenta página 1`);

    await pagina.getByRole('button', { name: 'Siguiente' }).click();
    await expect(pagina.getByText('Página 2 de 2')).toBeVisible();
    await expect(ObtenerFilas(pagina)).toHaveCount(11);
    await VerificarSinDesbordes(pagina, `${ancho} px, Cuenta página 2`);

    const medicionGasto = await RegistrarMovimiento(pagina, {
      nombreBoton: 'Añadir Gasto',
      monto: '1500,50',
      mensaje: 'Gasto registrado con éxito.',
      ancho,
    });
    await expect(pagina.getByText('USD -500,50', { exact: true })).toBeVisible();
    await VerificarSinDesbordes(pagina, `${ancho} px, Cuenta tras el gasto`);

    await RegistrarMovimiento(pagina, {
      nombreBoton: 'Añadir Ingreso',
      monto: '999999999',
      mensaje: 'Ingreso registrado con éxito.',
      ancho,
    });
    await expect(pagina.getByText('USD 999.999.498,50', { exact: true })).toBeVisible();
    await expect(ObtenerFilas(pagina).first()).toHaveText('Pago Ingresado+999.999.999,00');
    await VerificarSinDesbordes(pagina, `${ancho} px, Cuenta tras el ingreso`);

    const resumen = `AC-59 ${ancho} px con septiembre abierto: documento ${medicionGasto.anchoDocumento}/${medicionGasto.anchoVentana} px, calendario ${medicionGasto.calendario.anchoContenido}/${medicionGasto.calendario.anchoVisible} px, margen de la grilla ${medicionGasto.calendario.margenGrilla.toFixed(1)} px, espacio entre mes/año y flechas ${medicionGasto.calendario.espacioEncabezado.toFixed(1)} px; cabecera: ${medicionGasto.cabecera}`;
    console.log(resumen);
    test.info().annotations.push({ type: 'anchos', description: resumen });
  });
}

for (const ancho of anchos) {
  test(`en ${ancho} px se abre el menú de una fila, se edita el movimiento y se guarda sin desplazamiento horizontal (AC-28)`, async ({
    paginaConUsuario: pagina,
    usuario,
  }) => {
    await CargarMovimientos(usuario.idCuenta, [
      { tipo: 'INGRESO', monto: '1000.00', fecha: '2026-01-01' },
      { tipo: 'GASTO', monto: '300.00', fecha: ObtenerFechaLocal(-1) },
    ]);
    await pagina.setViewportSize({ width: ancho, height: altoVentana });
    await pagina.goto('/');
    await expect(pagina.getByText('USD 700,00', { exact: true })).toBeVisible();

    const fila = ObtenerFilas(pagina).first();
    await expect(fila).toHaveText('Pago Realizado-300,00');
    await fila.click();
    const menu = pagina.getByRole('menu');
    await expect(menu).toBeVisible();
    const detalleMenu = await VerificarMenuDentroDeVentana(pagina, menu, `${ancho} px`);
    await VerificarSinDesbordes(pagina, `${ancho} px, menú de la fila abierto`);

    await menu.getByRole('menuitem', { name: 'Editar' }).click();
    await expect(pagina.getByRole('heading', { level: 1, name: 'Editar Movimiento' })).toBeVisible();
    const selectorCategoria = pagina.getByLabel('Categoría');
    await expect(selectorCategoria).toBeEnabled();
    await VerificarSinDesbordes(pagina, `${ancho} px, Editar Movimiento`);

    // Tipo "Ingreso": la categoría pasa a "Pago Ingresado".
    await pagina.getByRole('radio', { name: 'Ingreso', exact: true }).check();
    await expect(selectorCategoria).toBeEnabled();
    await expect(selectorCategoria.locator('option:checked')).toHaveText('Pago Ingresado');

    await pagina.getByLabel('Fecha').click();
    const calendario = pagina.getByRole('dialog', { name: 'Calendario' });
    await expect(calendario).toBeVisible();
    const medicion = await VerificarSinDesbordes(pagina, `${ancho} px, Editar Movimiento, calendario`);
    await pagina.keyboard.press('Escape');
    await expect(calendario).toBeHidden();

    // El monto más largo que se muestra en la fila.
    await pagina.getByLabel('Monto').fill('999999999');
    await expect(pagina.getByLabel('Monto')).toHaveValue('999.999.999');
    await VerificarSinDesbordes(pagina, `${ancho} px, Editar Movimiento con el monto`);
    await pagina.getByRole('button', { name: 'Guardar' }).click();

    await expect(pagina.getByText('Movimiento actualizado con éxito.')).toBeVisible();
    await expect(pagina.getByRole('heading', { name: 'Mi Cuenta (USD)' })).toBeVisible();
    await expect(pagina.getByText('USD 1.000.000.999,00', { exact: true })).toBeVisible();
    await expect(ObtenerFilas(pagina).first()).toHaveText('Pago Ingresado+999.999.999,00');
    await VerificarSinDesbordes(pagina, `${ancho} px, Cuenta tras editar`);

    const resumen = `AC-28 ${ancho} px: ${detalleMenu}; documento con el calendario de la edición ${medicion.anchoDocumento}/${medicion.anchoVentana} px`;
    console.log(resumen);
    test.info().annotations.push({ type: 'anchos', description: resumen });
  });
}

for (const ancho of anchos) {
  test(`en ${ancho} px se abre el menú de una fila, se ve la confirmación completa y se elimina el movimiento sin desplazamiento horizontal (AC-14)`, async ({
    paginaConUsuario: pagina,
    usuario,
  }) => {
    await CargarMovimientos(usuario.idCuenta, [
      { tipo: 'INGRESO', monto: '1000.00', fecha: '2026-01-01' },
      { tipo: 'GASTO', monto: '300.00', fecha: ObtenerFechaLocal(-1) },
    ]);
    await pagina.setViewportSize({ width: ancho, height: altoVentana });
    await pagina.goto('/');
    await expect(pagina.getByText('USD 700,00', { exact: true })).toBeVisible();

    const fila = ObtenerFilas(pagina).first();
    await expect(fila).toHaveText('Pago Realizado-300,00');
    const idMovimiento = await fila.getAttribute('data-id-movimiento');
    await fila.click();
    const menu = pagina.getByRole('menu');
    await expect(menu).toBeVisible();
    const detalleMenu = await VerificarMenuDentroDeVentana(pagina, menu, `${ancho} px`);
    await VerificarSinDesbordes(pagina, `${ancho} px, menú de la fila abierto`);

    await menu.getByRole('menuitem', { name: 'Eliminar' }).click();
    const dialogo = pagina.getByRole('alertdialog');
    await expect(dialogo).toBeVisible();
    const detalleConfirmacion = await VerificarConfirmacionCompleta(pagina, dialogo, `${ancho} px`);
    const medicion = await VerificarSinDesbordes(pagina, `${ancho} px, confirmación abierta`);

    await dialogo.getByRole('button', { name: 'Confirmar' }).click();
    await expect(pagina.getByText('Movimiento eliminado con éxito.')).toBeVisible();
    await expect(dialogo).toBeHidden();
    await expect(pagina.getByText('USD 1.000,00', { exact: true })).toBeVisible();
    await expect(ObtenerFilaPorId(pagina, idMovimiento)).toHaveCount(0);
    await expect(ObtenerFilas(pagina)).toHaveText(['Pago Ingresado+1.000,00']);
    await VerificarSinDesbordes(pagina, `${ancho} px, Cuenta tras eliminar`);

    const resumen = `AC-14 ${ancho} px: ${detalleMenu}; ${detalleConfirmacion}; documento con la confirmación ${medicion.anchoDocumento}/${medicion.anchoVentana} px`;
    console.log(resumen);
    test.info().annotations.push({ type: 'anchos', description: resumen });
  });
}
